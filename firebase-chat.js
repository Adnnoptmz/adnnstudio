/*
  firebase-chat.js
  New ADNN chat runtime. Drop-in replacement for the older firebase-chat file.

  Required before this module loads:
    window.ADNN_FIREBASE_CONFIG = { ...firebase web config... }

  Optional overrides:
    window.ADNN_CHAT_CONFIG = {
      adminEmail: "getavcollab@gmail.com",
      adminAliasUid: "adnn-admin",
      homeUrl: "/",
      firebaseVersion: "10.8.0",
      msgLimit: 180,
      maxFiles: 10,
      maxFileSizeMb: 40,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
        // Add your TURN servers here for production-grade calls.
      ],
      theme: {
        primary: "#272dcf",
        primary2: "#161bba",
        danger: "#ff2602",
        success: "#25d366",
        bg: "#050506",
        panel: "#0b0b10"
      }
    }

  Expected Firestore structure used by this runtime:
    chats/{chatId}
    chats/{chatId}/messages/{messageId}
    chats/{chatId}/typing/{uid}
    presence/{uid}
    calls/{callId}
    calls/{callId}/offerCandidates/{candidateId}
    calls/{callId}/answerCandidates/{candidateId}
    callInbox/{uid}

  Existing mount IDs kept:
    #directChatMount, #clientChatMount, #adminChatMount, #chats_view
*/

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  deleteField,
  enableMultiTabIndexedDbPersistence,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";



const DEFAULT_CONFIG = {
  adminEmail: "getavcollab@gmail.com",
  adminAliasUid: "adnn-admin",
  brandName: "AdnnStudio",
  supportTitle: "AdnnStudio Support",
  homeUrl: "/",
  msgLimit: 180,
  maxFiles: 10,
  maxFileSizeMb: 40,
  typingIdleMs: 1400,
  presenceMs: 25000,
  presenceOnlineMs: 78000,
  callRingTimeoutMs: 60000,
  callSignalCleanupDelayMs: 4000,
  snapshotBaseRetryMs: 900,
  snapshotMaxRetryMs: 30000,
  uploadChunkLabelEveryPct: 5,
  deleteStorageOnDeleteForAll: false,
  messageToneFile: "Message Notification.wav",
  outgoingCallToneFile: "",
  incomingCallToneFile: "",
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ],
  mounts: {
    direct: "directChatMount",
    support: "clientChatMount",
    admin: "adminChatMount",
    adminFallback: "chats_view"
  },
  theme: {
    primary: "#272dcf",
    primary2: "#161bba",
    danger: "#ff2602",
    success: "#25d366",
    bg: "#050506",
    panel: "#0b0b10",
    soft: "rgba(255,255,255,.075)",
    line: "rgba(255,255,255,.09)",
    text: "#ffffff",
    muted: "rgba(255,255,255,.56)"
  }
};

const CHAT_CONFIG = deepMerge(DEFAULT_CONFIG, window.ADNN_CHAT_CONFIG || {});
const ADMIN_EMAIL = emailKey(CHAT_CONFIG.adminEmail);
const ADMIN_ALIAS_UID = CHAT_CONFIG.adminAliasUid;
const db = getFirestore(initializeApp(window.ADNN_FIREBASE_CONFIG));
const COLLECTIONS = {
  chats: "chats",
  messages: "messages",
  typing: "typing",
  presence: "presence",
  calls: "calls",
  offerCandidates: "offerCandidates",
  answerCandidates: "answerCandidates",
  callInbox: "callInbox"
};

let currentUser = null;
let activeCall = null;
let callTimer = null;
let incomingRingAudio = null;
let outgoingDialAudio = null;
let presenceTimer = null;
let incomingCallUnsub = null;
const globalUnsubs = [];
const liveSnapshotKeys = new Map();
const pendingToastKeys = new Map();
const threadUnreadCache = new Map();
const threadNotifyState = new Map();
let notificationPermissionAsked = false;
let chatSettingsEventsBound = false;
const CHAT_THEME_STORAGE_KEY = "adnn_chat_light_mode";
const CHAT_INAPP_NOTIFICATION_KEY = "adnn_inapp_notifications";
const CHAT_BROWSER_NOTIFICATION_KEY = "adnn_browser_notifications";
const CHAT_SOUND_KEY = "adnn_message_sounds";
const CHAT_SOUND_CONFIRMED_KEY = "adnn_sound_user_confirmed";
const CHAT_REDUCE_MOTION_KEY = "adnn_reduce_motion";
const CHAT_PAGE_LOAD_AT_MS = Date.now();
const CHAT_REFRESH_AUDIO_MUTE_MS = 18000;
const CHAT_TOTAL_UNREAD_STORAGE_KEY = "adnn_chat_unread_total";
const PINNED_CHAT_STORAGE_KEY = "adnn_pinned_chat_ids";
const NAV_ORDER_STORAGE_KEY = "adnn_sidebar_nav_order";

const ICON = {
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 3 7 7-3 1-4 4v5l-2 2-3-7-7-3 2-2h5l4-4 1-3Z"/></svg>`,
  pinFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m14 2.8 7.2 7.2-3.28 1.1-3.62 3.62v5.17l-2.32 2.32-3.28-7.65-7.65-3.28 2.32-2.32h5.17l3.62-3.62L14 2.8Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v2.4a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.63 2 2 0 0 1 4.11 1.5h2.4a2 2 0 0 1 2 1.72c.13.96.35 1.9.67 2.8a2 2 0 0 1-.45 2.1L7.7 9.16a16 16 0 0 0 7.14 7.14l1.04-1.03a2 2 0 0 1 2.1-.45c.9.32 1.84.54 2.8.67A2 2 0 0 1 22 16.92Z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>`,
  videoOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5H13a3 3 0 0 1 3 3v2.3l5-3v9.4l-2.1-1.26M16 16.5A3 3 0 0 1 13 19H6a3 3 0 0 1-3-3V8a3 3 0 0 1 2-2.83"/><path d="m3 3 18 18"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.35V6a3 3 0 0 0-5.68-1.33"/><path d="M19 11a7 7 0 0 1-1.3 4.06M5 11a7 7 0 0 0 9.76 6.43"/><path d="M12 18v3"/></svg>`,
  hang: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5.7 15.6c4.2-3.5 8.4-3.5 12.6 0l1.7-1.7c.7-.7.7-1.8 0-2.5-4.9-4.4-11.1-4.4-16 0-.7.7-.7 1.8 0 2.5l1.7 1.7Z"/></svg>`,
  hold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 5v14M16 5v14"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z"/></svg>`,
  clip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5 22 12 3 3.5v6.6L15.7 12 3 13.9v6.6Z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  smile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 15c1.8 1.7 5.2 1.7 7 0"/></svg>`,
  reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5M9 13h6M9 17h6M9 9h1"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5 7.5 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.5L15 5Z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>`,
  doubleCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 13 4 4L16.5 7"/><path d="m9 13 4 4L21 7"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 21h16"/></svg>`
};

let activeUser = null;
let activeProfile = null;
let snapshotBaseRetryMs = 900;
let sessionStarted = false;
let notificationsReadyAtMs = Date.now() + 2600;
let chatAudioReadyAtMs = Number.POSITIVE_INFINITY;
let offlinePersistenceState = "unknown";
let lastConnectivityLabel = "";

const rooms = new Map();
const listWatchers = new Map();
const objectUrls = new Set();

bootChatRuntime();

async function bootChatRuntime() {
  enforceSilentSoundMigration();
  installSilentAudioGuard();
  injectChatStyles();
  syncChatSettingsFromStorage();
  bindChatSettingsEvents();
  bindGlobalDismissers();
  bindConnectivitySignals();
  bindNotificationPermissionPrimer();
  setupSidebarReorder();
  ensureSidebarBadges();

  if (!FIREBASE_CONFIG) {
    renderSignedOutShell("Firebase config is missing. Define window.ADNN_FIREBASE_CONFIG before loading firebase-chat.js.");
    publishConnectionState("Firebase config missing", "bad");
    return;
  }

  try {
    app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    enableOfflinePersistence();

    // === CRITICAL AUTOMATED BACKGROUND AUTHENTICATION BRIDGE ===
    try {
      const localUser = JSON.parse(localStorage.getItem("adhnanPortfolioUser") || "null");
      const googleToken = sessionStorage.getItem("adnnGoogleAccessToken");
      if (localUser && googleToken && !auth.currentUser) {
        const { signInWithCredential, GoogleAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
        const credential = GoogleAuthProvider.credential(null, googleToken);
        await signInWithCredential(auth, credential);
      }
    } catch (bridgeError) {
      console.warn("ADNN Chat background auth bridge failed:", bridgeError);
    }
    // ============================================================

    onAuthStateChanged(auth, handleAuthState, (error) => {
      renderSignedOutShell("Could not verify chat login.");
      showToast(error?.message || "Auth connection failed.", "bad");
    });
  } catch (error) {
    renderSignedOutShell("Firebase failed to initialize. Check your Firebase web config and allowed domains.");
    showToast(error?.message || "Firebase failed to initialize.", "bad");
  }
}

async function enableOfflinePersistence() {
  if (!db) return;
  try {
    await enableMultiTabIndexedDbPersistence(db);
    offlinePersistenceState = "enabled";
  } catch (error) {
    offlinePersistenceState = "memory-only";
  }
}

async function handleAuthState(user) {
  cleanupSession({ keepFirebase: true });
  activeUser = user || null;

  if (!activeUser) {
    renderSignedOutShell(location.pathname.includes("admin.html")
      ? "Sign in with the tagged admin Google account to activate chats."
      : "Sign in to use chat.");
    publishConnectionState("Signed out", "warn");
    return;
  }

  publishConnectionState("Connecting chat...", "warn");
  activeProfile = await getProfile(activeUser.uid, activeUser.email).catch(() => ({
    uid: activeUser.uid,
    email: activeUser.email,
    role: isAdminEmail(activeUser.email) ? "admin" : "client",
    name: activeUser.displayName || emailKey(activeUser.email).split("@")[0] || "User",
    photoURL: activeUser.photoURL || ""
  }));
  const localDesignerProfile = location.pathname.includes("designer-account.html") ? readLocalDesignerProfile() : null;
  if (localDesignerProfile) {
    activeProfile = {
      ...(activeProfile || {}),
      ...localDesignerProfile,
      uid: activeUser.uid,
      email: localDesignerProfile.email || localDesignerProfile.authEmail || activeUser.email || activeProfile?.email,
      authEmail: localDesignerProfile.authEmail || localDesignerProfile.email || activeUser.email || activeProfile?.authEmail,
      designerid: localDesignerProfile.designerid || localDesignerProfile.designerId || activeProfile?.designerid || activeProfile?.designerId,
      designerId: localDesignerProfile.designerId || localDesignerProfile.designerid || activeProfile?.designerId || activeProfile?.designerid,
      role: "designer"
    };
  }

  sessionStarted = true;
  notificationsReadyAtMs = Date.now() + 12000;
  chatAudioReadyAtMs = Date.now() + 12000;
  threadUnreadCache.clear();
  threadNotifyState.clear();
  startPresence(activeUser);
  watchIncomingCalls();
  watchGlobalThreadBadges();

  if (location.pathname.includes("admin.html")) buildAdminChatPortal();
  else buildUserChatPortals();
  setupProfileNameConfirmEditor();

  publishConnectionState(navigator.onLine === false ? "Offline mode" : "Connected", navigator.onLine === false ? "warn" : "ok");
}

function buildUserChatPortals() {
  const directMount = document.getElementById(CHAT_CONFIG.mounts.direct);
  const supportMount = document.getElementById(CHAT_CONFIG.mounts.support);

  if (directMount) {
    directMount.className = "adnn-chat-app";
    directMount.innerHTML = appFrameMarkup({
      title: "User Chats",
      subtitle: "Messages, calls, files, replies, and voice notes",
      listId: "directThreads",
      roomId: "directRoom",
      searchable: true,
      single: false
    });
    bindFrameChrome(directMount, "directThreads", "directRoom");
    watchChatThreads("user", "directThreads", "directRoom", { excludeSupport: true });
    if (isAccountClientPage()) {
      ensureLegacyAccountDirectChat().catch((error) => {
        console.warn("Could not prepare account chat", error);
      });
    }
  }

  if (supportMount) {
    supportMount.className = "adnn-chat-app";
    supportMount.innerHTML = appFrameMarkup({
      title: "Admin Support",
      subtitle: "Messages, calls, files, replies, and voice notes",
      listId: "supportThreads",
      roomId: "supportRoom",
      searchable: false,
      single: false
    });
    bindFrameChrome(supportMount, "supportThreads", "supportRoom");
    ensureSupportChat()
      .then((chat) => {
        const list = document.getElementById("supportThreads");
        if (list) {
          renderThreadList([chat], list, "supportRoom", "support");
          list.querySelector(".adnn-thread")?.classList.add("is-active");
        }
        openRoom(chat.id, chat, "supportRoom");
      })
      .catch(() => {
        const list = document.getElementById("supportThreads");
        if (list) list.innerHTML = `<div class="adnn-chat-empty">Support chat is being prepared.</div>`;
        renderPassiveRoom("supportRoom", CHAT_CONFIG.supportTitle, "Support chat is being prepared.", "Message support");
      });
  }
}

function isAccountClientPage() {
  return location.pathname.includes("account.html") && activeUser && !isAdminEmail(activeUser.email) && activeProfile?.role !== "designer";
}

async function ensureLegacyAccountDirectChat() {
  if (!db || !isAccountClientPage()) return null;
  const chatId = `support_${activeUser.uid}`;
  const chatRef = doc(db, COLLECTIONS.chats, chatId);
  const snap = await getDoc(chatRef).catch(() => null);
  const exists = Boolean(snap?.exists?.());
  const clientEmail = emailKey(activeUser.email);
  const clientName = ownDisplayName();
  const now = Date.now();
  const payload = {
    type: "direct",
    legacySupport: true,
    title: `${clientName} / ${CHAT_CONFIG.brandName}`,
    clientUid: activeUser.uid,
    clientEmail,
    clientName,
    clientPhoto: ownPhotoUrl(),
    adminEmail: ADMIN_EMAIL,
    participantUids: uniqueClean([activeUser.uid, ADMIN_ALIAS_UID]),
    participantEmailKeys: uniqueClean([clientEmail, ADMIN_EMAIL]),
    participantEmails: uniqueClean([clientEmail, ADMIN_EMAIL]),
    participantNames: {
      [activeUser.uid]: clientName,
      [ADMIN_ALIAS_UID]: CHAT_CONFIG.brandName
    },
    participantPhotos: {
      [activeUser.uid]: ownPhotoUrl(),
      [ADMIN_ALIAS_UID]: CHAT_CONFIG.adminPhotoURL || ""
    },
    participantEmailMap: {
      [activeUser.uid]: clientEmail,
      [ADMIN_ALIAS_UID]: ADMIN_EMAIL
    },
    deletedFor: []
  };
  if (!exists) {
    Object.assign(payload, {
      lastMessage: "Chat ready",
      lastMessageKind: "system",
      unreadForClient: 0,
      unreadForAdmin: 0,
      unreadBy: { [activeUser.uid]: 0, [ADMIN_ALIAS_UID]: 0 },
      createdAt: serverTimestamp(),
      createdAtMs: now,
      updatedAt: serverTimestamp(),
      updatedAtMs: now
    });
  }
  await setDoc(chatRef, payload, { merge: true });
  return { id: chatId, ...payload };
}

function buildAdminChatPortal() {
  const target = document.getElementById(CHAT_CONFIG.mounts.admin) || document.getElementById(CHAT_CONFIG.mounts.adminFallback);
  if (!target) return;
  target.className = "adnn-chat-app";
  target.innerHTML = appFrameMarkup({
    title: "Studio Chats",
    subtitle: "Admin inbox, client support, direct chat, calls",
    listId: "adminThreads",
    roomId: "adminRoom",
    searchable: true,
    single: false,
    admin: true
  });
  bindFrameChrome(target, "adminThreads", "adminRoom");
  if (!isAdminEmail(activeUser?.email)) {
    const list = document.getElementById("adminThreads");
    if (list) list.innerHTML = `<div class="adnn-chat-empty">This inbox is available only to the studio admin.</div>`;
    renderPassiveRoom("adminRoom", "Admin chat", "This inbox is available only to the studio admin.", "Admin access required");
    return;
  }
  watchAdminChatThreads("adminThreads", "adminRoom");
}

function renderSignedOutShell(message) {
  const mounts = [
    document.getElementById(CHAT_CONFIG.mounts.direct),
    document.getElementById(CHAT_CONFIG.mounts.support),
    document.getElementById(CHAT_CONFIG.mounts.admin) || document.getElementById(CHAT_CONFIG.mounts.adminFallback)
  ].filter(Boolean);
  mounts.forEach((target, index) => {
    target.className = "adnn-chat-app";
    const roomId = `signedOutRoom${index}`;
    target.innerHTML = appFrameMarkup({
      title: "Chat",
      subtitle: "Secure messenger",
      listId: `signedOutList${index}`,
      roomId,
      searchable: false,
      single: true
    });
    bindFrameChrome(target, `signedOutList${index}`, roomId);
    renderPassiveRoom(roomId, "Chat unavailable", message, "Sign in required");
  });
}

function appFrameMarkup({ title, subtitle, listId, roomId, searchable = false, single = false, admin = false }) {
  const listMarkup = single ? "" : `
    <aside class="adnn-chat-thread-panel" data-thread-panel>
      <div class="adnn-chat-thread-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(subtitle || "")}</small>
        </div>
        ${searchable ? `<label class="adnn-chat-search"><span>${ICON.search}</span><input id="${escapeAttr(listId)}Search" placeholder="Search chats, names, emails"></label>` : ""}
      </div>
      <div class="adnn-chat-thread-list" id="${escapeAttr(listId)}"><div class="adnn-chat-empty">Loading chats...</div></div>
    </aside>
  `;
  return `
    <div class="adnn-chat-shell" data-chat-shell>
      <div class="adnn-chat-layout ${single ? "is-single" : ""} ${admin ? "is-admin" : ""}" data-chat-layout>
        ${listMarkup}
        ${single ? "" : `<button type="button" class="adnn-chat-resizer" data-chat-resizer aria-label="Resize chat panels"></button>`}
        <section class="adnn-chat-room" id="${escapeAttr(roomId)}"></section>
      </div>
    </div>
  `;
}

function bindFrameChrome(root, listId, roomId) {
  bindChatResizer(root);
  root.querySelector("[data-chat-home]")?.addEventListener("click", goHome);
  root.querySelector("[data-chat-refresh]")?.addEventListener("click", refreshAllConnections);
  root.querySelector("[data-chat-menu]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = root.querySelector("[data-outer-menu]");
    if (menu) menu.hidden = !menu.hidden;
  });
  root.querySelector("[data-outer-menu]")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-menu-action]");
    if (!btn) return;
    const action = btn.dataset.menuAction;
    if (action === "refresh") refreshAllConnections();
    if (action === "close-room") closeRoomOnMobile(roomId);
    root.querySelector("[data-outer-menu]").hidden = true;
  });

  const search = document.getElementById(`${listId}Search`);
  search?.addEventListener("input", () => filterThreadList(listId, search.value));
}

function bindChatResizer(root) {
  const layout = root.querySelector("[data-chat-layout]");
  const handle = root.querySelector("[data-chat-resizer]");
  if (!layout || !handle || layout.classList.contains("is-single")) return;
  const storageKey = "adnn_chat_thread_width";
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (saved) layout.style.setProperty("--thread-w", `${clamp(saved, 260, 620)}px`);
  } catch (_) {}
  let dragging = false;
  const onMove = (event) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    const width = clamp(event.clientX - rect.left, 260, Math.min(620, rect.width - 360));
    layout.style.setProperty("--thread-w", `${width}px`);
    try { localStorage.setItem(storageKey, String(Math.round(width))); } catch (_) {}
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("adnn-resizing-chat");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
  handle.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 760px)").matches) return;
    dragging = true;
    document.body.classList.add("adnn-resizing-chat");
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    event.preventDefault();
  });
}

async function ensureSupportChat() {
  const chatId = `support_${activeUser.uid}`;
  const chatRef = doc(db, COLLECTIONS.chats, chatId);
  const displayName = ownDisplayName();
  const payload = {
    type: "support",
    title: CHAT_CONFIG.supportTitle,
    clientUid: activeUser.uid,
    clientName: displayName,
    clientEmail: emailKey(activeUser.email),
    clientPhotoURL: ownPhotoUrl(),
    participantUids: uniqueClean([activeUser.uid, ADMIN_ALIAS_UID]),
    participantNames: { [activeUser.uid]: displayName, [ADMIN_ALIAS_UID]: `${CHAT_CONFIG.brandName} Admin` },
    participantPhotos: { [activeUser.uid]: ownPhotoUrl(), [ADMIN_ALIAS_UID]: CHAT_CONFIG.adminPhotoURL || "" },
    participantEmailMap: { [activeUser.uid]: emailKey(activeUser.email), [ADMIN_ALIAS_UID]: ADMIN_EMAIL },
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  };

  const snap = await withRetry(() => getDoc(chatRef), { label: "open support chat" }).catch(() => null);
  if (!snap?.exists()) {
    await withRetry(() => setDoc(chatRef, {
      ...payload,
      lastMessage: "Support channel ready.",
      lastMessageKind: "system",
      unreadForAdmin: 0,
      unreadForClient: 0,
      unreadBy: {},
      createdAt: serverTimestamp(),
      createdAtMs: Date.now()
    }, { merge: true }), { label: "create support chat" });
  } else {
    await withRetry(() => setDoc(chatRef, payload, { merge: true }), { label: "sync support chat" }).catch(() => {});
  }
  const fresh = await withRetry(() => getDoc(chatRef), { label: "load support chat" });
  return { id: chatId, ...fresh.data() };
}

function watchChatThreads(scope, listId, roomId, options = {}) {
  stopListWatcher(listId);
  const list = document.getElementById(listId);
  if (!list || !activeUser) return;

  const owner = [];
  const sources = new Map();
  const renderMergedThreads = () => {
    let chats = Array.from(sources.values()).flatMap((items) => Array.from(items.values()));
    const unique = new Map();
    chats.forEach((chat) => unique.set(chat.id, { ...(unique.get(chat.id) || {}), ...chat }));
    chats = Array.from(unique.values()).filter(isChatVisibleForCurrentUser);
    if (scope === "admin") chats = chats.filter(isVisibleToAdminInbox);
    if (options.directOnly || options.excludeSupport) chats = chats.filter((chat) => chat.type !== "support");
    chats.sort((a, b) => toMillis(b.updatedAt || b.createdAt || b.updatedAtMs) - toMillis(a.updatedAt || a.createdAt || a.updatedAtMs));
    renderThreadList(chats, list, roomId, scope);
  };

  const listen = (key, refOrQuery, quiet = false) => resilientSnapshot(`threads:${listId}:${key}`, refOrQuery, (snapshot) => {
    sources.set(key, new Map(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data(), __pending: item.metadata.hasPendingWrites }])));
    renderMergedThreads();
  }, (error) => {
    if (quiet) {
      renderMergedThreads();
      return;
    }
    if (!sources.size) {
      list.innerHTML = `<div class="adnn-chat-empty">${escapeHtml(readableFirebaseError(error))}</div>`;
      renderPassiveRoom(roomId, "Chats unavailable", "Chats are not available right now.", "Waiting for chat");
    } else {
      renderMergedThreads();
    }
  }, owner);

  if (scope === "admin") {
    listen("support", query(collection(db, COLLECTIONS.chats), where("type", "==", "support")));
    listen("admin-participant", query(collection(db, COLLECTIONS.chats), where("participantUids", "array-contains", ADMIN_ALIAS_UID)));
    selfEmailKeyList().forEach((mail, index) => {
      listen(`admin-email-${index}`, query(collection(db, COLLECTIONS.chats), where("participantEmailKeys", "array-contains", mail)));
    });
  } else {
    if (activeProfile?.role === "designer") {
      const primaryUids = new Set(uniqueClean([activeUser.uid, ownCallUid()]));
      const primaryEmail = emailKey(activeUser.email);
      Array.from(selfUidSet()).forEach((uid, index) => {
        if (!uid || !String(uid).trim()) return;
        listen(`participant-${index}`, query(collection(db, COLLECTIONS.chats), where("participantUids", "array-contains", uid)), !primaryUids.has(uid));
      });
      selfEmailKeyList().forEach((mail, index) => {
        if (!mail || !String(mail).trim()) return;
        listen(`participant-email-${index}`, query(collection(db, COLLECTIONS.chats), where("participantEmailKeys", "array-contains", mail)), mail !== primaryEmail);
      });
      listen("designer-room", query(collection(db, COLLECTIONS.chats), where("type", "==", "designer-room")));
      listen("designer-direct-scan", query(collection(db, COLLECTIONS.chats), where("type", "==", "direct")), true);
      listen("designer-group-scan", query(collection(db, COLLECTIONS.chats), where("type", "==", "group")), true);
    } else {
      listen("participant", query(collection(db, COLLECTIONS.chats), where("participantUids", "array-contains", activeUser.uid)));
    }
  }

  listWatchers.set(listId, () => {
    owner.forEach((fn) => fn?.());
  });
}

function watchAdminChatThreads(listId, roomId) {
  watchChatThreads("admin", listId, roomId);
}

function stopListWatcher(listId) {
  const old = listWatchers.get(listId);
  old?.();
  listWatchers.delete(listId);
}

function isVisibleToAdminInbox(chat) {
  if (!chat) return false;
  if (chat.type === "support") return true;
  const participants = Array.isArray(chat.participantUids) ? chat.participantUids : [];
  const emails = Array.isArray(chat.participantEmailKeys) ? chat.participantEmailKeys.map(emailKey) : [];
  const mine = selfEmailKeySet();
  return participants.includes(ADMIN_ALIAS_UID) || participants.includes(activeUser?.uid) || emails.some((mail) => mine.has(mail));
}

function isChatVisibleForCurrentUser(chat) {
  if (!chat) return false;
  const deletedFor = Array.isArray(chat.deletedFor) ? chat.deletedFor : [];
  if (deletedFor.some((uid) => selfUidSet().has(uid))) return false;
  if (isAdminEmail(activeUser?.email)) return true;
  if (chat.type === "support") {
    const adminOnly = [ADMIN_ALIAS_UID, ADMIN_EMAIL].includes(String(chat.id || "").toLowerCase());
    if (adminOnly) return false;
    return chatBelongsToCurrentUser(chat);
  }
  if (chat.type === "designer-room") return activeProfile?.role === "designer";
  return chatBelongsToCurrentUser(chat);
}

function chatBelongsToCurrentUser(chat) {
  const uids = selfUidSet();
  const emails = selfEmailKeySet();
  const participantUids = Array.isArray(chat?.participantUids) ? chat.participantUids.map(String) : [];
  if (participantUids.some((uid) => uids.has(uid))) return true;

  const participantEmailKeys = Array.isArray(chat?.participantEmailKeys)
    ? chat.participantEmailKeys.map(emailKey)
    : [];
  if (participantEmailKeys.some((mail) => emails.has(mail))) return true;

  const maps = [chat?.participantEmailMap, chat?.participantEmails, chat?.participants, chat?.participantNames];
  return maps.some((map) => Object.entries(map || {}).some(([key, value]) => {
    if (uids.has(String(key))) return true;
    if (emails.has(emailKey(key))) return true;
    if (typeof value === "string" && emails.has(emailKey(value))) return true;
    if (value && typeof value === "object") {
      return uids.has(String(value.uid || value.id || "")) ||
        emails.has(emailKey(value.email || value.authEmail || value.displayEmail || ""));
    }
    return false;
  }));
}

function isChatBlockedForMe(chat) {
  const blockedBy = Array.isArray(chat?.blockedBy) ? chat.blockedBy : [];
  return blockedBy.some((uid) => selfUidSet().has(uid));
}

function isBlockedByRemote(chat) {
  const blockedBy = Array.isArray(chat?.blockedBy) ? chat.blockedBy : [];
  return blockedBy.some((uid) => !selfUidSet().has(uid));
}

function updateRoomBlockUi(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const btn = shell.querySelector('[data-block-label]');
  if (btn) btn.textContent = isChatBlockedForMe(state.chatData) ? 'Unblock' : 'Block';
  shell.classList.toggle('is-blocked-by-me', isChatBlockedForMe(state.chatData));
  shell.classList.toggle('is-blocked-by-remote', isBlockedByRemote(state.chatData));
}

async function toggleBlockChat(state) {
  if (!state || state.chatId.startsWith('passive_')) return;
  const self = ownCallUid();
  const blocked = isChatBlockedForMe(state.chatData);
  const current = Array.isArray(state.chatData.blockedBy) ? state.chatData.blockedBy : [];
  const next = blocked ? current.filter((uid) => uid !== self && uid !== activeUser?.uid) : uniqueClean([...current, self]);
  await withRetry(() => updateDoc(doc(db, COLLECTIONS.chats, state.chatId), {
    blockedBy: next,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }), { label: blocked ? 'unblock chat' : 'block chat' })
    .then(() => showToast(blocked ? 'Chat unblocked.' : 'Chat blocked.', blocked ? 'ok' : 'warn'))
    .catch((error) => showToast(readableFirebaseError(error), 'bad'));
}

async function deleteChatForMe(state) {
  if (!state || state.chatId.startsWith('passive_')) return;
  const ok = await confirmDanger('Delete chat?', 'This removes this conversation from your chat list on this device/account. The other user keeps their copy.', 'Delete chat');
  if (!ok) return;
  await withRetry(() => updateDoc(doc(db, COLLECTIONS.chats, state.chatId), {
    deletedFor: arrayUnion(...Array.from(selfUidSet())),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }), { label: 'delete chat' })
    .then(() => {
      showToast('Chat deleted from your list.', 'ok');
      closeRoomOnMobile(state.roomId);
      const room = document.getElementById(state.roomId);
      if (room) room.innerHTML = '';
    })
    .catch((error) => showToast(readableFirebaseError(error), 'bad'));
}

function renderThreadList(chats, list, roomId, scope) {
  list.innerHTML = "";
  updateChatNavigationBadges(chats, scope);
  if (!chats.length) {
    list.innerHTML = `<div class="adnn-chat-empty">No conversations yet.</div>`;
    renderPassiveRoom(roomId, scope === "admin" ? "No client chats yet" : "No direct chats yet", "Conversations will appear here as soon as they are created.", "Waiting for chat");
    if (scope !== "admin") renderStartableUserDirectory(list, roomId);
    return;
  }

  const currentState = rooms.get(roomId);
  let currentRow = null;
  const pinnedChats = getPinnedChats();

  const sortedChats = chats.slice().sort((a, b) => {
    const aPinned = pinnedChats.has(a.id) ? 1 : 0;
    const bPinned = pinnedChats.has(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return toMillis(b.updatedAt || b.createdAt || b.updatedAtMs) - toMillis(a.updatedAt || a.createdAt || a.updatedAtMs);
  });

  sortedChats.forEach((chat) => {
    const title = getChatTitle(chat, scope);
    const unread = getUnreadCount(chat, scope);
    const pinned = pinnedChats.has(chat.id);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `adnn-thread ${pinned ? "is-pinned" : ""}`;
    row.dataset.chatId = chat.id;
    row.dataset.filterText = `${title} ${chat.clientEmail || ""} ${chat.lastMessage || ""}`.toLowerCase();

    const presenceDot = chat.__pending ? "is-pending" : "";
    const preview = normalizeLastMessage(chat);
    const stamp = formatCompactDate(chat.updatedAt || chat.createdAt || chat.updatedAtMs);
    row.innerHTML = `
      ${avatarMarkup(title, getChatPhoto(chat, scope), presenceDot)}
      <span class="adnn-thread-copy">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(preview)}</small>
      </span>
      <span class="adnn-thread-side">
        <button type="button" class="adnn-pin-chat" data-pin-chat="${escapeAttr(chat.id)}" title="${pinned ? "Unpin chat" : "Pin chat"}" aria-label="${pinned ? "Unpin chat" : "Pin chat"}">${pinned ? ICON.pinFilled : ICON.pin}</button>
        <time>${escapeHtml(stamp)}</time>
        ${unread > 0 ? `<b>${unread > 99 ? "99+" : unread}</b>` : ""}
      </span>
    `;
    hydrateThreadAvatar(row, chat, scope, title);
    row.querySelector("[data-pin-chat]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePinnedChat(chat.id);
      renderThreadList(chats, list, roomId, scope);
    });
    row.addEventListener("click", () => {
      list.querySelectorAll(".adnn-thread").forEach((item) => item.classList.remove("is-active"));
      row.classList.add("is-active");
      openRoom(chat.id, chat, roomId);
      row.closest(".adnn-chat-layout")?.classList.add("is-room-open");
      document.body.classList.toggle("adnn-chat-mobile-lock", window.matchMedia("(max-width: 760px)").matches);
    });

    if (currentState?.chatId === chat.id) {
      row.classList.add("is-active");
      currentRow = row;
    }
    list.appendChild(row);
  });

  const shouldAutoOpen = scope === "admin" && !currentRow && sortedChats[0] && !window.matchMedia("(max-width: 760px)").matches;
  if (shouldAutoOpen) {
    const firstRow = list.querySelector(".adnn-thread");
    firstRow?.classList.add("is-active");
    openRoom(sortedChats[0].id, sortedChats[0], roomId);
  }
}

async function renderStartableUserDirectory(list, roomId) {
  if (!db || !activeUser || !list || list.dataset.directoryLoading === "1") return;
  list.dataset.directoryLoading = "1";
  try {
    const rows = [];
    const collections = ["clients", "designers"];
    for (const name of collections) {
      const snap = await getDocs(collection(db, name)).catch(() => null);
      snap?.forEach((item) => {
        const data = item.data() || {};
        const email = emailKey(data.email || data.authEmail || data.clientEmail || data.designerEmail || "");
        const ids = uniqueClean([item.id, data.uid, data.designerid, data.designerId]);
        const isSelf = ids.some((id) => selfUidSet().has(id)) || selfEmailKeySet().has(email);
        if (!isSelf && (email || ids.length)) {
          rows.push({
            uid: ids[0] || email,
            email,
            name: data.name || data.displayName || data.clientName || data.designerName || email || "User",
            role: name === "designers" ? "designer" : "client",
            photoURL: data.photoURL || data.avatarURL || data.picture || ""
          });
        }
      });
    }
    const unique = new Map();
    rows.forEach((row) => unique.set(row.email || row.uid, row));
    const users = Array.from(unique.values()).sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, 80);
    if (!users.length || !list.isConnected || list.querySelector(".adnn-thread")) return;
    list.innerHTML = `<div class="adnn-chat-empty is-compact">Start a conversation</div>`;
    users.forEach((user) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "adnn-thread adnn-thread-suggestion";
      row.dataset.filterText = `${user.name} ${user.email} ${user.role}`.toLowerCase();
      row.innerHTML = `
        ${avatarMarkup(user.name, user.photoURL)}
        <span class="adnn-thread-copy">
          <strong>${escapeHtml(user.name)}</strong>
          <small>${escapeHtml(user.email || user.role)}</small>
        </span>
        <span class="adnn-thread-side"><b>+</b></span>
      `;
      row.addEventListener("click", () => createOrOpenDirectChat(user, roomId, row));
      list.appendChild(row);
    });
  } finally {
    delete list.dataset.directoryLoading;
  }
}

async function createOrOpenDirectChat(other, roomId, row = null) {
  if (!db || !activeUser || !other?.uid) return;
  row?.setAttribute("disabled", "true");
  const ownPrimary = activeUser.uid;
  const otherUid = String(other.uid);
  const keyParts = uniqueClean([ownPrimary, otherUid].sort()).join("_");
  const chatId = `direct_${keyParts.replace(/[^a-z0-9_-]/gi, "_").slice(0, 120)}`;
  const participantUids = uniqueClean([ownPrimary, ownCallUid(), ...designerIdVariants(), otherUid]);
  const participantEmailKeys = uniqueClean([...selfEmailKeyList(), other.email].map(emailKey));
  const payload = {
    type: "direct",
    createdBy: activeUser.uid,
    createdByEmail: emailKey(activeUser.email),
    participantUids,
    participantEmailKeys,
    participantNames: {
      [ownPrimary]: ownDisplayName(),
      [ownCallUid()]: ownDisplayName(),
      [otherUid]: other.name || other.email || "User"
    },
    participantPhotos: {
      [ownPrimary]: ownPhotoUrl(),
      [ownCallUid()]: ownPhotoUrl(),
      [otherUid]: other.photoURL || ""
    },
    participantEmailMap: {
      [ownPrimary]: emailKey(activeUser.email),
      [ownCallUid()]: emailKey(activeUser.email),
      [otherUid]: other.email || ""
    },
    lastMessage: "Channel connected.",
    lastMessageKind: "system",
    unreadBy: {},
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    createdAtMs: Date.now()
  };
  await withRetry(() => setDoc(doc(db, COLLECTIONS.chats, chatId), payload, { merge: true }), { label: "create direct chat" })
    .then(() => {
      openRoom(chatId, { id: chatId, ...payload }, roomId);
      row?.closest(".adnn-chat-layout")?.classList.add("is-room-open");
      document.body.classList.toggle("adnn-chat-mobile-lock", window.matchMedia("(max-width: 760px)").matches);
    })
    .catch((error) => showToast(readableFirebaseError(error), "bad"))
    .finally(() => row?.removeAttribute("disabled"));
}

function filterThreadList(listId, rawValue) {
  const list = document.getElementById(listId);
  if (!list) return;
  const needle = String(rawValue || "").toLowerCase().trim();
  list.querySelectorAll(".adnn-thread").forEach((row) => {
    row.hidden = !!needle && !row.dataset.filterText?.includes(needle);
  });
}

function getPinnedChats() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PINNED_CHAT_STORAGE_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}

function togglePinnedChat(chatId) {
  const pinned = getPinnedChats();
  if (pinned.has(chatId)) pinned.delete(chatId);
  else pinned.add(chatId);
  try { localStorage.setItem(PINNED_CHAT_STORAGE_KEY, JSON.stringify(Array.from(pinned))); } catch (_) {}
}

async function hydrateThreadAvatar(row, chat, scope, title) {
  if (!row || getChatPhoto(chat, scope)) return;
  const uid = getRemoteUid(chat);
  if (!uid) return;
  const info = await getPresenceInfo(uid).catch(() => null);
  const photo = info?.data?.photoURL;
  if (photo && row.isConnected) setAvatarNode(row.querySelector(".adnn-avatar"), title, photo);
}

function renderPassiveRoom(roomId, title, message, placeholder) {
  const target = document.getElementById(roomId);
  if (!target) return;

  const old = rooms.get(roomId);
  cleanupRoomState(old);

  const state = createRoomState(roomId, `passive_${roomId}`, { id: `passive_${roomId}`, type: "passive", title });
  rooms.set(roomId, state);
  target.innerHTML = passiveRoomMarkup(roomId, title, message, placeholder);
  bindRoomControls(state);
  updateConnectionLabels();
}

function passiveRoomMarkup(roomId, title, message, placeholder) {
  return `
    <div class="adnn-room-shell is-passive" data-room="${escapeAttr(roomId)}">
      <header class="adnn-room-head" role="toolbar" aria-label="Chat status">
        <button type="button" class="adnn-back-btn" data-chat-back>${ICON.back}</button>
        ${avatarMarkup(title)}
        <div class="adnn-room-title">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(message)}</small>
        </div>
      </header>
      <main class="adnn-message-scroll" data-message-scroll>
        <div class="adnn-chat-empty">${escapeHtml(message)}</div>
      </main>
      <footer class="adnn-composer-wrap">
        <form class="adnn-composer" data-composer>
          <button type="button" class="adnn-attach-btn" disabled>${ICON.clip}</button>
          <textarea data-text rows="1" maxlength="1800" placeholder="${escapeAttr(placeholder)}" disabled></textarea>
          <button type="button" class="adnn-voice-btn" disabled>${ICON.mic}</button>
        </form>
      </footer>
    </div>
  `;
}

function openRoom(chatId, chatData, roomId) {
  const target = document.getElementById(roomId);
  if (!target || !chatId || !activeUser) return;

  const old = rooms.get(roomId);
  cleanupRoomState(old);

  const state = createRoomState(roomId, chatId, { ...chatData, id: chatId });
  state.suppressNotifyUntilMs = Date.now() + 1400;
  rooms.set(roomId, state);
  target.innerHTML = roomMarkup(roomId);
  document.body.classList.toggle("adnn-chat-mobile-lock", window.matchMedia("(max-width: 760px)").matches);

  bindRoomControls(state);
  watchRoomMeta(state);
  watchMessages(state);
  watchTyping(state);
  resetUnread(state.chatData);
  updateConnectionLabels();
}

function createRoomState(roomId, chatId, chatData) {
  return {
    roomId,
    chatId,
    chatData: chatData || {},
    files: [],
    fileInputMode: "all",
    replyTo: null,
    voice: null,
    recorder: null,
    recordStream: null,
    chunks: [],
    seconds: 0,
    recordTimer: null,
    typingTimer: null,
    uploadProgress: new Map(),
    lastRenderSignature: "",
    messages: [],
    unsubs: [],
    localPendingIds: new Set(),
    menuMessageId: "",
    presenceUnsub: null,
    notifiedMessageIds: new Set(),
    messagesHydrated: false,
    suppressNotifyUntilMs: Date.now() + 1400
  };
}

function cleanupRoomState(state) {
  if (!state) return;
  state.unsubs?.forEach((unsub) => unsub?.());
  state.unsubs = [];
  if (state.typingTimer) clearTimeout(state.typingTimer);
  if (state.recordTimer) clearInterval(state.recordTimer);
  try { state.recorder?.state !== "inactive" && state.recorder?.stop?.(); } catch (_) {}
  state.recordStream?.getTracks?.().forEach((track) => track.stop());
  state.files?.forEach((item) => revokeObjectUrl(item.url));
  if (state.voice?.url) revokeObjectUrl(state.voice.url);
}

function roomMarkup(roomId) {
  return `
    <div class="adnn-room-shell" data-room="${escapeAttr(roomId)}">
      <header class="adnn-room-head" role="toolbar" aria-label="Chat tools">
        <button type="button" class="adnn-back-btn" data-chat-back aria-label="Back">${ICON.back}</button>
        <span class="adnn-avatar" data-chat-avatar>AD</span>
        <div class="adnn-room-title">
          <strong data-chat-title>Opening chat...</strong>
          <small data-chat-presence>Checking status...</small>
        </div>
        <div class="adnn-room-actions">
          <button type="button" class="adnn-call-btn" data-call="audio" title="Audio call" aria-label="Audio call">${ICON.phone}</button>
          <button type="button" class="adnn-call-btn" data-call="video" title="Video call" aria-label="Video call">${ICON.video}</button>
          <button type="button" class="adnn-call-btn" data-room-search title="Search messages" aria-label="Search messages">${ICON.search}</button>
          <button type="button" class="adnn-call-btn" data-room-menu-trigger title="Chat menu" aria-label="Chat menu">${ICON.more}</button>
        </div>
        <div class="adnn-room-menu" data-room-menu hidden>
          <button type="button" data-room-menu-action="scroll-bottom">Go to latest</button>
          <button type="button" data-room-menu-action="block" data-block-label>Block</button>
          <button type="button" data-room-menu-action="delete-chat" class="is-danger">Delete chat</button>
        </div>
      </header>
      <div class="adnn-room-searchbar" data-room-searchbar hidden>
        <input type="search" data-message-search placeholder="Search in this chat">
        <button type="button" data-close-search>${ICON.x}</button>
      </div>
      <main class="adnn-message-scroll" data-message-scroll>
        <div class="adnn-chat-empty">Loading messages...</div>
      </main>
      <button type="button" class="adnn-scroll-bottom" data-scroll-bottom hidden>${ICON.back}</button>
      <div class="adnn-drop-layer" data-drop-layer>Drop files to attach</div>
      <footer class="adnn-composer-wrap">
        <div class="adnn-typing-line" data-typing-line hidden></div>
        <div class="adnn-reply-bar" data-reply-bar hidden>
          <span></span>
          <button type="button" data-clear-reply>${ICON.x}</button>
        </div>
        <div class="adnn-file-preview" data-file-preview hidden></div>
        <div class="adnn-voice-preview" data-voice-preview hidden></div>
        <div class="adnn-composer-panel" data-composer-panel hidden>
          <label><span>${ICON.doc}</span><b>Document</b><input type="file" data-panel-file multiple></label>
          <label><span>${ICON.image}</span><b>Photo/Video</b><input type="file" data-panel-media accept="image/*,video/*" multiple></label>
          <label><span>${ICON.camera}</span><b>Camera</b><input type="file" data-panel-camera accept="image/*,video/*" capture="environment"></label>
          <label><span>${ICON.mic}</span><b>Audio file</b><input type="file" data-panel-audio accept="audio/*" multiple></label>
        </div>
        <form class="adnn-composer" data-composer>
          <button type="button" class="adnn-plus-btn" data-toggle-panel aria-label="Open composer panel">${ICON.plus}</button>
          <label class="adnn-attach-btn" title="Attach files" aria-label="Attach files">
            ${ICON.clip}
            <input type="file" data-file-input multiple>
          </label>
          <button type="button" class="adnn-emoji-btn" data-emoji-trigger aria-label="Emoji reactions">${ICON.smile}</button>
          <textarea data-text rows="1" maxlength="2400" placeholder="Message"></textarea>
          <button type="button" class="adnn-voice-btn" data-voice aria-label="Record voice message">${ICON.mic}</button>
          <button type="submit" class="adnn-send-btn" data-send hidden aria-label="Send message">${ICON.send}</button>
        </form>
        <div class="adnn-emoji-panel" data-emoji-panel hidden>${REACTION_SET.map((emoji) => `<button type="button" data-insert-emoji="${escapeAttr(emoji)}">${escapeHtml(emoji)}</button>`).join("")}</div>
      </footer>
    </div>
  `;
}

function bindRoomControls(state) {
  const shell = roomShell(state);
  if (!shell) return;

  const text = shell.querySelector("[data-text]");
  const form = shell.querySelector("[data-composer]");
  const fileInput = shell.querySelector("[data-file-input]");
  const voiceBtn = shell.querySelector("[data-voice]");
  const scroller = shell.querySelector("[data-message-scroll]");
  bindMessageScrollEscape(scroller, state);

  shell.querySelector("[data-chat-back]")?.addEventListener("click", () => closeRoomOnMobile(state.roomId));
  shell.querySelectorAll("[data-call]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.chatId.startsWith("passive_")) return showToast("Please select an active conversation first.", "warn");
      startCall(btn.dataset.call, state.chatId, state.chatData);
    });
  });

  shell.querySelector("[data-room-menu-trigger]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = shell.querySelector("[data-room-menu]");
    if (menu) menu.hidden = !menu.hidden;
  });

  shell.querySelector("[data-room-menu]")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-room-menu-action]");
    if (!btn) return;
    const action = btn.dataset.roomMenuAction;
    if (action === "scroll-bottom") scrollToBottom(state, true);
    if (action === "block") toggleBlockChat(state);
    if (action === "delete-chat") deleteChatForMe(state);
    shell.querySelector("[data-room-menu]").hidden = true;
  });

  shell.querySelector("[data-room-search]")?.addEventListener("click", () => {
    const bar = shell.querySelector("[data-room-searchbar]");
    if (!bar) return;
    bar.hidden = !bar.hidden;
    bar.querySelector("input")?.focus();
  });
  shell.querySelector("[data-close-search]")?.addEventListener("click", () => {
    const bar = shell.querySelector("[data-room-searchbar]");
    if (bar) bar.hidden = true;
    filterMessages(state, "");
  });
  shell.querySelector("[data-message-search]")?.addEventListener("input", (event) => filterMessages(state, event.target.value));

  text?.addEventListener("input", () => {
    autoSizeTextArea(text);
    if (!state.chatId.startsWith("passive_")) setTyping(state, text.value.trim().length > 0);
    refreshComposerMode(state);
  });

  text?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form?.requestSubmit();
    }
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.chatId.startsWith("passive_")) return showToast("Please select an active conversation first.", "warn");
    sendCurrentMessage(state);
  });

  fileInput?.addEventListener("change", () => {
    addFilesToState(state, Array.from(fileInput.files || []));
    fileInput.value = "";
  });

  shell.querySelectorAll("[data-panel-file], [data-panel-media], [data-panel-camera], [data-panel-audio]").forEach((input) => {
    input.addEventListener("change", () => {
      addFilesToState(state, Array.from(input.files || []));
      input.value = "";
      const panel = shell.querySelector("[data-composer-panel]");
      if (panel) panel.hidden = true;
    });
  });

  shell.querySelector("[data-toggle-panel]")?.addEventListener("click", () => {
    const panel = shell.querySelector("[data-composer-panel]");
    if (panel) panel.hidden = !panel.hidden;
  });

  shell.querySelector("[data-emoji-trigger]")?.addEventListener("click", () => {
    const panel = shell.querySelector("[data-emoji-panel]");
    if (panel) panel.hidden = !panel.hidden;
  });

  shell.querySelector("[data-emoji-panel]")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-insert-emoji]");
    if (!btn || !text) return;
    insertAtCursor(text, btn.dataset.insertEmoji);
    autoSizeTextArea(text);
    refreshComposerMode(state);
    text.focus();
  });

  shell.querySelector("[data-clear-reply]")?.addEventListener("click", () => {
    state.replyTo = null;
    renderReplyBar(state);
  });

  voiceBtn?.addEventListener("click", () => toggleVoiceRecording(state));

  scroller?.addEventListener("scroll", () => {
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;
    const btn = shell.querySelector("[data-scroll-bottom]");
    if (btn) btn.hidden = nearBottom;
  });
  shell.querySelector("[data-scroll-bottom]")?.addEventListener("click", () => scrollToBottom(state, true));

  ["dragenter", "dragover"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      if (state.chatId.startsWith("passive_")) return;
      shell.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "drop" && !state.chatId.startsWith("passive_")) addFilesToState(state, Array.from(event.dataTransfer?.files || []));
      shell.classList.remove("is-dragging");
    });
  });
}

function watchRoomMeta(state) {
  const ref = doc(db, COLLECTIONS.chats, state.chatId);
  resilientSnapshot(`room:${state.roomId}:${state.chatId}`, ref, (snapshot) => {
    if (!snapshot.exists()) return;
    state.chatData = { id: state.chatId, ...snapshot.data(), __pending: snapshot.metadata.hasPendingWrites };
    const shell = roomShell(state);
    if (!shell) return;
    const scope = isAdminEmail(activeUser?.email) ? "admin" : "user";
    const title = getChatTitle(state.chatData, scope);
    const avatar = shell.querySelector("[data-chat-avatar]");
    const titleNode = shell.querySelector("[data-chat-title]");
    if (avatar) setAvatarNode(avatar, title, getChatPhoto(state.chatData, scope));
    if (titleNode) titleNode.textContent = title;
    updateRoomBlockUi(state);
    watchPresence(state);
  }, (error) => showRoomConnection(state, readableFirebaseError(error), "bad"), state.unsubs);
}

function watchPresence(state) {
  const remoteUid = getRemoteUid(state.chatData);
  const shell = roomShell(state);
  if (!shell) return;
  const status = shell.querySelector("[data-chat-presence]");
  state.presenceUnsub?.();
  state.presenceUnsub = null;

  if (!remoteUid || !status) {
    if (status) status.textContent = "Available";
    return;
  }

  const unsub = resilientSnapshot(`presence:${state.roomId}:${remoteUid}`, doc(db, COLLECTIONS.presence, remoteUid), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const seen = toMillis(data.lastSeen || data.updatedAt || data.lastActiveAt);
    const active = data.online !== false && data.active !== false && seen && Date.now() - seen < CHAT_CONFIG.presenceOnlineMs;
    const online = data.online !== false && seen && Date.now() - seen < CHAT_CONFIG.presenceOnlineMs;
    status.textContent = active ? "Online now" : online ? "Online" : seen ? `Last seen ${relativeTime(seen)}` : "Offline";
    status.classList.toggle("is-online", !!online);
    const title = getChatTitle(state.chatData, isAdminEmail(activeUser?.email) ? "admin" : "user");
    const avatar = shell.querySelector("[data-chat-avatar]");
    if (avatar && data.photoURL) setAvatarNode(avatar, title, data.photoURL);
  }, () => {
    if (status) status.textContent = "Status unavailable";
  }, state.unsubs);

  state.presenceUnsub = unsub;
}

function watchTyping(state) {
  const typingRef = collection(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.typing);
  resilientSnapshot(`typing:${state.roomId}:${state.chatId}`, typingRef, (snapshot) => {
    const typing = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => !selfUidSet().has(item.id) && item.isTyping && Date.now() - Number(item.updatedAt || 0) < 5200);
    const shell = roomShell(state);
    if (!shell) return;
    const line = shell.querySelector("[data-typing-line]");
    const status = shell.querySelector("[data-chat-presence]");
    if (line) {
      line.hidden = typing.length === 0;
      line.innerHTML = typing.length
        ? `<span></span><span></span><span></span> ${escapeHtml(typing[0].name || "User")} is typing`
        : "";
    }
    if (status && typing.length) status.textContent = "Typing...";
  }, () => {}, state.unsubs);
}

function watchMessages(state) {
  const q = query(
    collection(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.messages),
    orderBy("createdAt", "asc"),
    limit(CHAT_CONFIG.msgLimit)
  );
  resilientSnapshot(`messages:${state.roomId}:${state.chatId}`, q, (snapshot) => {
    state.messages = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      __pending: item.metadata.hasPendingWrites
    }));
    renderMessages(state, state.messages);
    markMessagesRead(state, state.messages);
    notifyIncomingMessages(state, state.messages);
  }, (error) => {
    const shell = roomShell(state);
    if (shell) shell.querySelector("[data-message-scroll]").innerHTML = `<div class="adnn-chat-empty">${escapeHtml(readableFirebaseError(error))}</div>`;
  }, state.unsubs);
}

function renderMessages(state, messages) {
  const shell = roomShell(state);
  if (!shell) return;
  const scroller = shell.querySelector("[data-message-scroll]");
  if (!scroller) return;

  const visible = messages.filter((message) => shouldShowMessage(message));
  const signature = visible.map((msg) => `${msg.id}:${msg.updatedAtMs || toMillis(msg.updatedAt) || toMillis(msg.createdAt)}:${msg.__pending ? 1 : 0}:${JSON.stringify(msg.reactions || {})}:${JSON.stringify(msg.readBy || [])}:${msg.deletedForAll ? 1 : 0}:${JSON.stringify(msg.deletedFor || [])}`).join("|");
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 220;
  if (signature === state.lastRenderSignature) return;
  state.lastRenderSignature = signature;

  scroller.innerHTML = "";
  const dateTrack = document.createElement("div");
  dateTrack.className = "adnn-date-track";
  dateTrack.dataset.dateTrack = "";
  dateTrack.hidden = true;
  scroller.appendChild(dateTrack);
  ensureDateTrack(scroller);
  if (!visible.length) {
    scroller.innerHTML = `<div class="adnn-chat-empty">No messages yet. Say hello.</div>`;
    return;
  }

  let lastDateKey = "";
  visible.forEach((message) => {
    const dateKey = dateSeparatorKey(message.createdAt || message.createdAtMs);
    if (dateKey && dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      const sep = document.createElement("div");
      sep.className = "adnn-date-separator";
      sep.textContent = formatDateSeparator(message.createdAt || message.createdAtMs);
      scroller.appendChild(sep);
    }

    const row = document.createElement("div");
    const callEvent = isCallEventMessage(message);
    const mine = callEvent ? isOutgoingCallEvent(message) : isMineMessage(message);
    row.className = `adnn-message-row ${callEvent ? "is-call" : mine ? "is-mine" : "is-peer"}`;
    row.dataset.messageId = message.id;

    const bubble = document.createElement("article");
    bubble.className = "adnn-message";
    bubble.tabIndex = 0;
    bubble.dataset.messageId = message.id;
    bubble.innerHTML = renderMessageBubble(message, mine);
    bindMessageGestures(bubble, state, message);
    bubble.addEventListener("click", (event) => handleMessageAction(event, state, message));
    row.appendChild(bubble);
    scroller.appendChild(row);
  });

  filterMessages(state, shell.querySelector("[data-message-search]")?.value || "");
  bindReplyPreviewJumps(scroller);
  if (nearBottom) scrollToBottom(state);
  updateDateTrack(scroller);
}

function bindReplyPreviewJumps(scroller) {
  if (!scroller) return;
  scroller.querySelectorAll("[data-scroll-reply]").forEach((button) => {
    if (button.dataset.jumpBound === "true") return;
    button.dataset.jumpBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.scrollReply;
      if (!id) return;
      const target = scroller.querySelector(`.adnn-message[data-message-id="${cssAttr(id)}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("is-reply-jump");
      setTimeout(() => target.classList.remove("is-reply-jump"), 1300);
    });
  });
}

function ensureDateTrack(scroller) {
  if (!scroller || scroller.dataset.dateTrackBound) return;
  scroller.dataset.dateTrackBound = "1";
  let hideTimer = null;
  scroller.addEventListener("scroll", () => {
    updateDateTrack(scroller);
    const pill = scroller.querySelector("[data-date-track]");
    if (pill) pill.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (pill) pill.hidden = true; }, 1150);
  }, { passive: true });
}

function updateDateTrack(scroller) {
  const pill = scroller?.querySelector("[data-date-track]");
  if (!pill) return;
  const seps = Array.from(scroller.querySelectorAll(".adnn-date-separator"));
  if (!seps.length) { pill.hidden = true; return; }
  const top = scroller.getBoundingClientRect().top + 18;
  let active = seps[0];
  for (const sep of seps) {
    if (sep.getBoundingClientRect().top <= top) active = sep;
    else break;
  }
  pill.textContent = active.textContent || "Today";
}

function renderMessageBubble(message, mine) {
  if (isCallEventMessage(message)) return renderCallMessageBubble(message);
  if (message.deletedForAll) {
    return `
      ${!mine ? `<strong class="adnn-message-name">${escapeHtml(message.senderName || "User")}</strong>` : ""}
      <p class="adnn-deleted-message">This message was deleted.</p>
      <div class="adnn-message-meta"><time>${formatTime(message.createdAt || message.createdAtMs)}</time>${mine ? renderTicks(message) : ""}</div>
      <button type="button" class="adnn-message-action-trigger" data-action="toggle-actions" aria-label="Message actions">${ICON.more}</button>
      ${renderMessageMenu(message, mine, true)}
    `;
  }

  return `
    ${!mine ? `<strong class="adnn-message-name">${escapeHtml(message.senderName || "User")}</strong>` : ""}
    ${renderReplyPreview(message)}
    ${renderAttachments(message)}
    ${message.text ? `<p>${linkifyText(message.text)}</p>` : ""}
    ${renderReactions(message)}
    <div class="adnn-message-meta">
      <time>${formatTime(message.createdAt || message.createdAtMs)}</time>
      ${mine ? renderTicks(message) : ""}
    </div>
    <button type="button" class="adnn-message-action-trigger" data-action="toggle-actions" aria-label="Message actions">${ICON.more}</button>
    ${renderMessageMenu(message, mine, false)}
  `;
}

function renderMessageMenu(message, mine, deleted) {
  const canDeleteForAll = mine && !deleted;
  return `
    <div class="adnn-message-actions" data-message-menu>
      <button type="button" data-action="reply" title="Reply">${ICON.reply}<span>Reply</span></button>
      ${!deleted ? `<button type="button" data-action="open-react" title="React">${ICON.smile}<span>React</span></button>` : ""}
      ${message.text && !deleted ? `<button type="button" data-action="copy" title="Copy">${ICON.copy}<span>Copy</span></button>` : ""}
      <button type="button" data-action="delete-me" class="is-warn" title="Delete for me">${ICON.trash}<span>Me</span></button>
      ${canDeleteForAll ? `<button type="button" data-action="delete-all" class="is-danger" title="Delete for everyone">${ICON.trash}<span>All</span></button>` : ""}
      <div class="adnn-reaction-palette" data-reaction-palette hidden>
        ${REACTION_SET.map((emoji) => `<button type="button" data-action="react" data-emoji="${escapeAttr(emoji)}">${escapeHtml(emoji)}</button>`).join("")}
      </div>
    </div>
  `;
}

function bindMessageGestures(bubble, state, message) {
  let timer = null;
  let moved = false;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  bubble.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a,button,audio,video")) return;
    moved = false;
    timer = setTimeout(() => openMessageMenu(bubble, state, message), 460);
  });
  bubble.addEventListener("pointermove", () => { moved = true; if (moved) clear(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => bubble.addEventListener(type, clear));
  bubble.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMessageMenu(bubble, state, message);
  });
}

function openMessageMenu(bubble, state, message) {
  closeMessageMenus();
  state.menuMessageId = message.id;
  bubble.classList.add("is-menu-open");
}

function handleMessageAction(event, state, message) {
  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) {
    if (event.target.closest("a,audio,video")) return;
    openMessageMenu(event.currentTarget, state, message);
    return;
  }

  event.stopPropagation();
  const action = actionBtn.dataset.action;
  if (action === "toggle-actions") {
    const bubble = event.currentTarget;
    if (bubble.classList.contains("is-menu-open")) bubble.classList.remove("is-menu-open");
    else openMessageMenu(bubble, state, message);
    return;
  }
  if (action === "reply") startReply(state, message);
  if (action === "open-react") openReactionSheet(actionBtn, state, message);
  if (action === "react") toggleReaction(state.chatId, message, actionBtn.dataset.emoji);
  if (action === "copy") copyMessageText(message);
  if (action === "delete-me") deleteMessageForMe(state, message);
  if (action === "delete-all") deleteMessageForEveryone(state, message);
}

function toggleReactionPalette(menu) {
  if (!menu) return;
  const palette = menu.querySelector("[data-reaction-palette]");
  if (palette) palette.hidden = !palette.hidden;
}

function openReactionSheet(anchor, state, message) {
  if (!anchor || !state || !message) return;
  closeFloatingReactionSheet();
  const sheet = document.createElement("div");
  sheet.className = "adnn-floating-reaction-sheet";
  sheet.dataset.floatingReaction = "1";
  sheet.innerHTML = REACTION_SET.map((emoji) => `<button type="button" data-emoji="${escapeAttr(emoji)}">${escapeHtml(emoji)}</button>`).join("");
  document.body.appendChild(sheet);

  const gap = 8;
  const viewportW = Math.max(280, window.innerWidth || document.documentElement.clientWidth || 320);
  const viewportH = Math.max(360, window.innerHeight || document.documentElement.clientHeight || 480);
  sheet.style.maxWidth = `${Math.max(220, viewportW - gap * 2)}px`;

  if (viewportW <= 760) {
    sheet.style.left = `${gap}px`;
    sheet.style.right = `${gap}px`;
    sheet.style.bottom = `calc(${gap}px + env(safe-area-inset-bottom))`;
    sheet.style.top = "auto";
    sheet.style.justifyContent = "center";
  } else {
    const rect = anchor.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const width = Math.min(sheetRect.width || 360, viewportW - gap * 2);
    const height = Math.min(sheetRect.height || 54, viewportH - gap * 2);
    const preferredLeft = rect.left + rect.width / 2 - width / 2;
    const left = clamp(preferredLeft, gap, viewportW - width - gap);
    const above = rect.top - height - gap;
    const top = above > gap ? above : clamp(rect.bottom + gap, gap, viewportH - height - gap);
    sheet.style.left = `${left}px`;
    sheet.style.right = "auto";
    sheet.style.top = `${top}px`;
    sheet.style.bottom = "auto";
  }

  sheet.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleReaction(state.chatId, message, btn.dataset.emoji);
    });
  });
}

function closeFloatingReactionSheet() {
  document.querySelectorAll("[data-floating-reaction]").forEach((node) => node.remove());
}

function startReply(state, message) {
  state.replyTo = {
    id: message.id,
    senderName: message.senderName || (isMineMessage(message) ? "You" : "User"),
    text: message.text || firstAttachmentName(message) || (message.attachments?.some((item) => item.voice) ? "Voice message" : "Attachment"),
    senderUid: message.senderUid || ""
  };
  renderReplyBar(state);
  const text = roomShell(state)?.querySelector("[data-text]");
  text?.focus();
  closeMessageMenus();
}

async function copyMessageText(message) {
  if (!message.text) return;
  try {
    await navigator.clipboard.writeText(message.text);
    showToast("Message copied.", "ok");
  } catch (_) {
    showToast("Copy is blocked by this browser.", "warn");
  }
  closeMessageMenus();
}

async function deleteMessageForMe(state, message) {
  const keys = Array.from(selfUidSet());
  await withRetry(() => updateDoc(doc(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.messages, message.id), {
    deletedFor: arrayUnion(...keys),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }), { label: "delete for me" }).catch((error) => showToast(readableFirebaseError(error), "bad"));
  closeMessageMenus();
}

async function deleteMessageForEveryone(state, message) {
  if (!isMineMessage(message)) return showToast("You can delete only your own sent messages for everyone.", "warn");
  const ok = await confirmDanger("Delete for everyone?", "This will remove the message for everyone in this chat. This action cannot be undone.", "Delete for everyone");
  if (!ok) return closeMessageMenus();
  const messageRef = doc(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.messages, message.id);
  const update = {
    text: "",
    attachments: [],
    deletedForAll: true,
    deletedByUid: ownCallUid(),
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
    mediaUrl: deleteField(),
    mediaName: deleteField(),
    mediaType: deleteField()
  };
  await withRetry(() => updateDoc(messageRef, update), { label: "delete for everyone" })
    .then(() => updateChatAfterDelete(state, message))
    .catch((error) => showToast(readableFirebaseError(error), "bad"));

  if (CHAT_CONFIG.deleteStorageOnDeleteForAll && Array.isArray(message.attachments)) {
    message.attachments.forEach((item) => {
      if (item.path) deleteObject(storageRef(storage, item.path)).catch(() => {});
    });
  }
  closeMessageMenus();
}

async function updateChatAfterDelete(state, message) {
  const chatRef = doc(db, COLLECTIONS.chats, state.chatId);
  const lastTime = toMillis(state.chatData.updatedAt || state.chatData.updatedAtMs);
  const msgTime = toMillis(message.createdAt || message.createdAtMs);
  if (!lastTime || msgTime >= lastTime - 3000) {
    await setDoc(chatRef, {
      lastMessage: "Message deleted",
      lastMessageKind: "deleted",
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true }).catch(() => {});
  }
}

async function toggleReaction(chatId, message, emoji) {
  if (!emoji || !activeUser) return;
  const uidKey = fieldKey(ownCallUid());
  const reactions = message.reactions || {};
  const current = reactions[uidKey] || reactions[activeUser.uid];
  const messageRef = doc(db, COLLECTIONS.chats, chatId, COLLECTIONS.messages, message.id);
  const payload = current === emoji
    ? { [`reactions.${uidKey}`]: deleteField(), updatedAt: serverTimestamp(), updatedAtMs: Date.now() }
    : { [`reactions.${uidKey}`]: emoji, updatedAt: serverTimestamp(), updatedAtMs: Date.now() };
  await withRetry(() => updateDoc(messageRef, payload), { label: "react" }).catch((error) => showToast(readableFirebaseError(error), "bad"));
  closeFloatingReactionSheet();
  closeMessageMenus();
}

function renderReplyBar(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const bar = shell.querySelector("[data-reply-bar]");
  if (!bar) return;
  bar.hidden = !state.replyTo;
  if (state.replyTo) {
    bar.querySelector("span").innerHTML = `<strong>${escapeHtml(state.replyTo.senderName || "Reply")}</strong><small>${escapeHtml(state.replyTo.text || "Quoted message")}</small>`;
  }
}

function renderReplyPreview(message) {
  const reply = message.replyTo;
  if (!reply && !message.replyToMessageId) return "";
  return `<button type="button" class="adnn-reply-preview" data-scroll-reply="${escapeAttr(reply?.id || message.replyToMessageId || "")}"><strong>${escapeHtml(reply?.senderName || "Reply")}</strong><small>${escapeHtml(reply?.text || "Quoted message")}</small></button>`;
}

function renderAttachments(message) {
  const items = Array.isArray(message.attachments) && message.attachments.length
    ? message.attachments
    : message.mediaUrl ? [{ url: message.mediaUrl, name: message.mediaName, type: message.mediaType, voice: message.mediaType?.startsWith("audio/") }] : [];

  return items.map((item) => {
    const type = item.type || "application/octet-stream";
    if (type.startsWith("image/")) {
      return `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener" class="adnn-attachment-img"><img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.name || "image")}"></a>`;
    }
    if (type.startsWith("video/")) {
      return `<div class="adnn-video-bubble"><video controls playsinline src="${escapeAttr(item.url)}"></video><small>${escapeHtml(item.name || "Video")}</small></div>`;
    }
    if (type.startsWith("audio/") || item.voice) {
      return `<div class="adnn-voice-bubble"><button type="button" data-wave-play="${escapeAttr(item.url)}">${ICON.play}</button><div class="adnn-voice-wave">${waveBars(item.duration || 8)}</div><audio preload="metadata" src="${escapeAttr(item.url)}" hidden></audio><small>${formatDuration(item.duration || 0)}</small></div>`;
    }
    return `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener" class="adnn-doc-bubble"><span>${fileExt(item.name || "file")}</span><strong>${escapeHtml(item.name || "Open file")}</strong><small>${formatBytes(item.size || 0)}</small>${ICON.download}</a>`;
  }).join("");
}

function renderReactions(message) {
  const reactions = message.reactions || {};
  const values = Object.values(reactions).filter(Boolean);
  if (!values.length) return "";
  const counts = values.reduce((acc, emoji) => {
    acc[emoji] = (acc[emoji] || 0) + 1;
    return acc;
  }, {});
  return `<button type="button" class="adnn-reactions" data-action="open-react">${Object.entries(counts).map(([emoji, count]) => `${escapeHtml(emoji)}${count > 1 ? `<small>${count}</small>` : ""}`).join(" ")}</button>`;
}

function isCallEventMessage(message) {
  return !!(message?.callEvent || message?.system === "call" || message?.type === "call");
}

function isOutgoingCallEvent(message) {
  const keys = selfUidSet();
  return keys.has(message.callerUid) || keys.has(message.senderUid) || keys.has(message.senderAliasUid);
}

function renderCallMessageBubble(message) {
  const outgoing = isOutgoingCallEvent(message);
  const kind = message.kind === "video" ? "video" : "audio";
  const missed = message.callStatus === "missed" || message.endedReason === "timeout";
  const declined = message.endedReason === "rejected";
  const duration = Math.round((Number(message.durationMs) || 0) / 1000);
  const title = missed
    ? (outgoing ? `No answer ${kind} call` : `Missed ${kind} call`)
    : declined
      ? (outgoing ? `Declined ${kind} call` : `Call declined`)
      : `${outgoing ? "Outgoing" : "Incoming"} ${kind} call`;
  const detail = `${duration ? formatDuration(duration) + "  " : ""}${formatTime(message.createdAt || message.createdAtMs)}`;
  return `
    <div class="adnn-call-message ${missed ? "is-missed" : ""}">
      <span>${kind === "video" ? ICON.video : ICON.phone}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>
    </div>
  `;
}

function renderTicks(message) {
  if (message.__pending) return `<span class="adnn-ticks is-pending" title="Sending">${ICON.clock}</span>`;
  const readBy = Array.isArray(message.readBy) ? message.readBy : [];
  const read = readBy.some((uid) => uid && !selfUidSet().has(uid));
  return `<span class="adnn-ticks ${read ? "is-read" : ""}" title="${read ? "Read" : "Sent"}">${read ? ICON.doubleCheck : ICON.check}</span>`;
}

function shouldShowMessage(message) {
  if (!message) return false;
  const deletedFor = Array.isArray(message.deletedFor) ? message.deletedFor : [];
  if (Array.from(selfUidSet()).some((uid) => deletedFor.includes(uid))) return false;
  if (message.callEvent || message.system === "call" || message.type === "call") return true;
  if (isCallSummaryText(message.text || message.body || message.content || message.message || message.lastMessage || "")) return false;
  return true;
}

function isMineMessage(message) {
  const keys = selfUidSet();
  return keys.has(message.senderUid) || keys.has(message.senderAliasUid) || keys.has(message.senderRealUid);
}

async function sendCurrentMessage(state) {
  const shell = roomShell(state);
  if (!shell || !activeUser) return;
  const textNode = shell.querySelector("[data-text]");
  const text = textNode?.value.trim() || "";
  if (!text && state.files.length === 0 && !state.voice) return;
  if (isChatBlockedForMe(state.chatData)) return showToast("Unblock this chat first.", "warn");
  if (isBlockedByRemote(state.chatData)) return showToast("This chat is blocked by the other user.", "warn");

  if (navigator.onLine === false && (state.files.length || state.voice)) {
    showToast("Files and voice notes need connection to upload. Your staged items are kept here.", "warn");
    return;
  }

  const stagedFiles = [...state.files];
  const stagedVoice = state.voice;
  const stagedReply = state.replyTo;
  state.files = [];
  state.voice = null;
  state.replyTo = null;
  renderFilePreview(state);
  renderVoicePreview(state);
  renderReplyBar(state);
  refreshComposerMode(state);
  if (textNode) {
    textNode.value = "";
    autoSizeTextArea(textNode);
  }
  setTyping(state, false);

  const localId = makeId("local");
  state.localPendingIds.add(localId);
  showRoomConnection(state, stagedFiles.length || stagedVoice ? "Uploading media..." : "Sending...", "warn");

  try {
    const attachments = [];
    for (const item of stagedFiles) {
      const uploaded = await uploadChatFile(item.file, state.chatId, false, (progress) => {
        state.uploadProgress.set(item.id, progress);
        renderFilePreview(state);
      });
      attachments.push(uploaded);
    }
    if (stagedVoice) {
      const voiceAttachment = await uploadChatFile(stagedVoice.file, state.chatId, true, (progress) => {
        state.uploadProgress.set("voice", progress);
        renderVoicePreview(state);
      });
      voiceAttachment.duration = stagedVoice.seconds;
      attachments.push(voiceAttachment);
    }

    const selfKeys = Array.from(selfUidSet());
    const payload = {
      clientId: localId,
      text,
      attachments,
      senderUid: activeUser.uid,
      senderAliasUid: ownCallUid(),
      senderRealUid: activeUser.uid,
      senderEmail: emailKey(activeUser.email),
      senderName: ownDisplayName(),
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
      readBy: selfKeys,
      deletedFor: []
    };
    if (stagedReply) payload.replyTo = stagedReply;
    if (attachments[0]) {
      payload.mediaUrl = attachments[0].url;
      payload.mediaName = attachments[0].name;
      payload.mediaType = attachments[0].type;
    }

    await withRetry(() => addDoc(collection(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.messages), payload), { label: "send message" });
    const lastMessage = text || attachmentSummary(attachments);
    await updateChatAfterSend(state, lastMessage, attachments);
    showRoomConnection(state, navigator.onLine === false ? "Offline mode" : "Connected", navigator.onLine === false ? "warn" : "ok");
  } catch (error) {
    showToast(readableFirebaseError(error), "bad");
    state.files = stagedFiles;
    state.voice = stagedVoice;
    state.replyTo = stagedReply;
    renderFilePreview(state);
    renderVoicePreview(state);
    renderReplyBar(state);
    refreshComposerMode(state);
    showRoomConnection(state, "Send failed. Edit and retry.", "bad");
  } finally {
    stagedFiles.forEach((item) => state.uploadProgress.delete(item.id));
    state.uploadProgress.delete("voice");
    state.localPendingIds.delete(localId);
  }
}

function getUnreadTargetUids(chat) {
  const participants = Array.isArray(chat?.participantUids) ? chat.participantUids : [];
  if (participants.length > 2 || chat?.type === 'group' || chat?.isGroup) {
    return participants.filter((uid) => !selfUidSet().has(uid));
  }
  const remoteUid = getRemoteUid(chat);
  return remoteUid ? [remoteUid] : [];
}

async function writeOfflineMissedCallMessage(chatId, chatData, kind, receiverUid) {
  const callId = `offline_${Date.now()}_${makeId('call')}`;
  const endedAtMs = Date.now();
  const payload = {
    type: 'call',
    system: 'call',
    callEvent: true,
    callId,
    callStatus: 'missed',
    endedReason: 'offline',
    kind: kind === 'video' ? 'video' : 'audio',
    callerUid: ownCallUid(),
    callerName: ownDisplayName(),
    callerPhotoURL: ownPhotoUrl(),
    receiverUid,
    receiverName: getChatTitle(chatData, 'user'),
    receiverPhotoURL: getChatPhoto(chatData, 'user'),
    durationMs: 0,
    createdAt: serverTimestamp(),
    createdAtMs: endedAtMs,
    updatedAt: serverTimestamp(),
    updatedAtMs: endedAtMs,
    senderUid: ownCallUid(),
    senderAliasUid: ownCallUid(),
    senderRealUid: activeUser?.uid || ownCallUid(),
    senderName: ownDisplayName(),
    readBy: Array.from(selfUidSet()),
    deletedFor: []
  };
  await setDoc(doc(db, COLLECTIONS.chats, chatId, COLLECTIONS.messages, `call_${callId}`), payload, { merge: true });
  const update = {
    lastMessage: callSummaryLastMessage(payload),
    lastMessageKind: 'call',
    lastSenderUid: ownCallUid(),
    lastSenderAliasUid: ownCallUid(),
    updatedAt: serverTimestamp(),
    updatedAtMs: endedAtMs
  };
  if (receiverUid) update[`unreadBy.${fieldKey(receiverUid)}`] = increment(1);
  await setDoc(doc(db, COLLECTIONS.chats, chatId), update, { merge: true });
}

async function updateChatAfterSend(state, lastMessage, attachments = []) {
  const payload = {
    lastMessage,
    lastMessageKind: attachments.some((item) => item.voice) ? "voice" : attachments.length ? "attachment" : "text",
    lastSenderUid: activeUser.uid,
    lastSenderAliasUid: ownCallUid(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  };

  if (state.chatData.type === "support") {
    if (isAdminEmail(activeUser.email)) payload.unreadForClient = increment(1);
    else payload.unreadForAdmin = increment(1);
  } else {
    payload.unreadForClient = increment(1);
    payload.unreadForAdmin = increment(1);
  }
  getUnreadTargetUids(state.chatData).forEach((uid) => {
    payload[`unreadBy.${fieldKey(uid)}`] = increment(1);
  });
  await withRetry(() => setDoc(doc(db, COLLECTIONS.chats, state.chatId), payload, { merge: true }), { label: "update chat" });
}

function addFilesToState(state, files) {
  const shell = roomShell(state);
  if (!shell) return;
  const maxBytes = CHAT_CONFIG.maxFileSizeMb * 1024 * 1024;
  const accepted = [];
  const rejected = [];

  files.filter(Boolean).forEach((file) => {
    if (state.files.length + accepted.length >= CHAT_CONFIG.maxFiles) {
      rejected.push(`${file.name}: max ${CHAT_CONFIG.maxFiles} files`);
      return;
    }
    if (file.size > maxBytes) {
      rejected.push(`${file.name}: max ${CHAT_CONFIG.maxFileSizeMb}MB`);
      return;
    }
    accepted.push(file);
  });

  accepted.forEach((file) => {
    const url = URL.createObjectURL(file);
    objectUrls.add(url);
    state.files.push({ id: makeId("file"), file, url, kind: fileKind(file) });
  });

  if (rejected.length) showToast(rejected.slice(0, 2).join(" | "), "warn");
  renderFilePreview(state);
  refreshComposerMode(state);
}

function renderFilePreview(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const target = shell.querySelector("[data-file-preview]");
  if (!target) return;
  target.hidden = state.files.length === 0;
  target.innerHTML = state.files.map((item) => {
    const progress = state.uploadProgress.get(item.id);
    const media = item.file.type.startsWith("image/")
      ? `<img src="${escapeAttr(item.url)}" alt="">`
      : item.file.type.startsWith("video/")
        ? `<video src="${escapeAttr(item.url)}" muted playsinline></video>`
        : `<span>${fileExt(item.file.name)}</span>`;
    return `
      <div class="adnn-file-chip" data-file-id="${escapeAttr(item.id)}">
        ${media}
        <div><strong>${escapeHtml(item.file.name)}</strong><small>${escapeHtml(item.kind)}  ${formatBytes(item.file.size)}</small>${progress ? `<i style="--p:${Math.max(0, Math.min(100, progress.pct))}%"></i>` : ""}</div>
        <button type="button" data-remove-file="${escapeAttr(item.id)}">${ICON.x}</button>
      </div>
    `;
  }).join("");
  target.querySelectorAll("[data-remove-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const removed = state.files.find((item) => item.id === btn.dataset.removeFile);
      if (removed?.url) revokeObjectUrl(removed.url);
      state.files = state.files.filter((item) => item.id !== btn.dataset.removeFile);
      renderFilePreview(state);
      refreshComposerMode(state);
    });
  });
}

async function uploadChatFile(file, chatId, voice = false, onProgress = null) {
  if (!storage) throw new Error("Storage is not configured.");
  const safeName = sanitizeFileName(file.name || `file_${Date.now()}`);
  const uid = ownCallUid() || activeUser.uid;
  const path = `chat-media/${chatId}/${uid}/${Date.now()}_${makeId("m")}_${safeName}`;
  const ref = storageRef(storage, path);
  const metadata = {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      chatId,
      senderUid: activeUser.uid,
      senderAliasUid: ownCallUid(),
      voice: String(!!voice)
    }
  };

  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref, file, metadata);
    task.on("state_changed", (snapshot) => {
      const pct = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      onProgress?.({ pct, bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes, state: snapshot.state });
    }, reject, resolve);
  });

  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    url: await getDownloadURL(ref),
    path,
    voice
  };
}

async function toggleVoiceRecording(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const voiceBtn = shell.querySelector("[data-voice]");

  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    showToast("Voice recording is not available in this browser.", "warn");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordStream = stream;
    const mimeType = bestAudioMimeType();
    state.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.chunks = [];
    state.seconds = 0;

    voiceBtn?.classList.add("is-recording");
    if (voiceBtn) voiceBtn.innerHTML = `<span class="adnn-rec-dot"></span><b>0:00</b>`;
    showRoomConnection(state, "Recording voice message...", "warn");

    state.recordTimer = setInterval(() => {
      state.seconds += 1;
      const label = shell.querySelector("[data-voice] b");
      if (label) label.textContent = formatDuration(state.seconds);
    }, 1000);

    state.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.chunks.push(event.data);
    };

    state.recorder.onstop = () => {
      clearInterval(state.recordTimer);
      state.recordTimer = null;
      stream.getTracks().forEach((track) => track.stop());
      state.recordStream = null;
      const type = state.recorder?.mimeType || "audio/webm";
      const blob = new Blob(state.chunks, { type });
      if (blob.size > 0 && state.seconds > 0) {
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type });
        const url = URL.createObjectURL(file);
        objectUrls.add(url);
        state.voice = { file, url, seconds: Math.max(1, state.seconds) };
      }
      state.recorder = null;
      state.chunks = [];
      voiceBtn?.classList.remove("is-recording");
      if (voiceBtn) voiceBtn.innerHTML = ICON.mic;
      renderVoicePreview(state);
      refreshComposerMode(state);
      showRoomConnection(state, navigator.onLine === false ? "Offline mode" : "Connected", navigator.onLine === false ? "warn" : "ok");
    };

    state.recorder.start(350);
  } catch (error) {
    showToast("Microphone permission is needed for voice messages.", "bad");
  }
}

function renderVoicePreview(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const target = shell.querySelector("[data-voice-preview]");
  if (!target) return;
  const progress = state.uploadProgress.get("voice");
  target.hidden = !state.voice;
  target.innerHTML = state.voice ? `
    <span class="adnn-voice-preview-icon">${ICON.mic}</span>
    <audio controls preload="metadata" src="${escapeAttr(state.voice.url)}"></audio>
    <span>${formatDuration(state.voice.seconds)}</span>
    ${progress ? `<i style="--p:${Math.max(0, Math.min(100, progress.pct))}%"></i>` : ""}
    <button type="button" data-delete-voice>${ICON.x}</button>
  ` : "";
  target.querySelector("[data-delete-voice]")?.addEventListener("click", () => {
    if (state.voice?.url) revokeObjectUrl(state.voice.url);
    state.voice = null;
    renderVoicePreview(state);
    refreshComposerMode(state);
  });
}

function refreshComposerMode(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const text = shell.querySelector("[data-text]")?.value.trim() || "";
  const hasPayload = !!text || state.files.length > 0 || !!state.voice;
  const send = shell.querySelector("[data-send]");
  const voice = shell.querySelector("[data-voice]");
  if (send) send.hidden = !hasPayload;
  if (voice) voice.hidden = hasPayload;
}

async function setTyping(state, on) {
  if (!state || state.chatId.startsWith("passive_") || !activeUser) return;
  await setDoc(doc(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.typing, ownCallUid()), {
    isTyping: !!on,
    name: ownDisplayName(),
    uid: ownCallUid(),
    realUid: activeUser.uid,
    updatedAt: Date.now()
  }, { merge: true }).catch(() => {});
  if (state.typingTimer) clearTimeout(state.typingTimer);
  if (on) state.typingTimer = setTimeout(() => setTyping(state, false), CHAT_CONFIG.typingIdleMs);
}

async function markMessagesRead(state, messages) {
  if (!state || !activeUser || state.chatId.startsWith("passive_")) return;
  const selfKeys = Array.from(selfUidSet());
  const unread = messages.filter((msg) => {
    if (isMineMessage(msg) || msg.deletedForAll) return false;
    const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
    return !selfKeys.every((uid) => readBy.includes(uid));
  });
  if (!unread.length) {
    resetUnread(state.chatData);
    return;
  }

  try {
    const batch = writeBatch(db);
    unread.slice(0, 450).forEach((msg) => {
      batch.update(doc(db, COLLECTIONS.chats, state.chatId, COLLECTIONS.messages, msg.id), {
        readBy: arrayUnion(...selfKeys),
        [`readAt.${fieldKey(ownCallUid())}`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now()
      });
    });
    await batch.commit();
    resetUnread(state.chatData);
  } catch (_) {
    // Firestore rules can selectively intercept read receipt execution trees.
  }
}

function resetUnread(chat) {
  if (!chat || !activeUser) return;
  const chatId = chat.id || rooms.values().next().value?.chatId;
  if (!chatId || String(chatId).startsWith("passive_")) return;
  const field = isAdminEmail(activeUser.email) ? "unreadForAdmin" : "unreadForClient";
  const payload = { [field]: 0, [`unreadBy.${fieldKey(ownCallUid())}`]: 0 };
  updateDoc(doc(db, COLLECTIONS.chats, chatId), payload).catch(() => {});
}

function startPresence(user) {
  stopPresence();
  const write = async (online = true) => {
    if (!user || !db) return;
    const active = document.visibilityState !== "hidden" && online && navigator.onLine !== false;
    const base = {
      uid: user.uid,
      email: emailKey(user.email),
      name: ownDisplayName(),
      photoURL: ownPhotoUrl(),
      online: navigator.onLine !== false && online,
      active,
      page: location.pathname,
      userAgent: navigator.userAgent.slice(0, 180),
      lastSeen: serverTimestamp(),
      lastActiveAt: Date.now(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, COLLECTIONS.presence, user.uid), base, { merge: true }).catch(() => {});
    if (isAdminEmail(user.email)) {
      await setDoc(doc(db, COLLECTIONS.presence, ADMIN_ALIAS_UID), {
        ...base,
        uid: ADMIN_ALIAS_UID,
        realUid: user.uid,
        name: `${CHAT_CONFIG.brandName} Admin`,
        photoURL: CHAT_CONFIG.adminPhotoURL || ownPhotoUrl()
      }, { merge: true }).catch(() => {});
    }
  };

  write(true);
  presenceTimer = setInterval(() => write(true), CHAT_CONFIG.presenceMs);
  const visibility = () => write(document.visibilityState !== "hidden");
  const online = () => write(true);
  const offline = () => write(false);
  const pagehide = () => markOffline();
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("beforeunload", pagehide);
  globalUnsubs.push(() => document.removeEventListener("visibilitychange", visibility));
  globalUnsubs.push(() => window.removeEventListener("online", online));
  globalUnsubs.push(() => window.removeEventListener("offline", offline));
  globalUnsubs.push(() => window.removeEventListener("pagehide", pagehide));
  globalUnsubs.push(() => window.removeEventListener("beforeunload", pagehide));
}

function stopPresence() {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
}

function markOffline() {
  if (!activeUser || !db) return;
  setDoc(doc(db, COLLECTIONS.presence, activeUser.uid), {
    online: false,
    active: false,
    lastSeen: serverTimestamp(),
    lastActiveAt: Date.now(),
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
  if (isAdminEmail(activeUser.email)) {
    setDoc(doc(db, COLLECTIONS.presence, ADMIN_ALIAS_UID), {
      online: false,
      active: false,
      lastSeen: serverTimestamp(),
      lastActiveAt: Date.now(),
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
}

function watchIncomingCalls() {
  incomingCallUnsub?.();
  if (!activeUser) return;
  incomingCallUnsub = resilientSnapshot(`callInbox:${ownCallUid()}`, doc(db, COLLECTIONS.callInbox, ownCallUid()), async (snapshot) => {
    if (!snapshot.exists() || activeCall) return;
    const inbox = snapshot.data();
    if (inbox.status !== "ringing" || !inbox.callId) return;
    const callSnap = await getDoc(doc(db, COLLECTIONS.calls, inbox.callId)).catch(() => null);
    if (!callSnap?.exists()) return;
    const call = callSnap.data();
    if (call.status !== "ringing" || call.callerUid === ownCallUid() || Date.now() > Number(call.expiresAtMs || 0)) return;
    showIncomingCall(inbox.callId, call);
  }, () => {}, globalUnsubs);
}

async function startCall(kind, chatId, chatData) {
  if (activeCall) return showToast("Another call is already active.", "warn");
  const receiverUid = getRemoteUid(chatData);
  if (!receiverUid) return showToast("No receiver is available for this chat.", "bad");
  if (isChatBlockedForMe(chatData) || isBlockedByRemote(chatData)) return showToast("This chat is blocked. Call not connected.", "warn");
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    return showToast("This browser does not support secure audio/video calls.", "bad");
  }

  const remoteStatus = await getPresenceInfo(receiverUid);
  if (!remoteStatus.online) {
    await writeOfflineMissedCallMessage(chatId, chatData, kind, receiverUid).catch(() => {});
    showInAppNotification(getChatTitle(chatData, "user"), `Missed ${kind === "video" ? "video" : "audio"} call  user offline`, { tone: "missed", icon: getChatPhoto(chatData, "user") });
    return showToast(`${getChatTitle(chatData, "user")} is offline. Missed call saved.`, "warn");
  }

  try {
    const wantsVideo = kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const callId = `call_${Date.now()}_${makeId("rtc")}`;
    activeCall = createCallState(callId, "caller", kind, stream, chatId, chatData, receiverUid);
    const expiresAtMs = Date.now() + CHAT_CONFIG.callRingTimeoutMs;
    const media = {
      [fieldKey(ownCallUid())]: { cameraOn: wantsVideo, micOn: true, hold: false, updatedAt: Date.now() },
      [fieldKey(receiverUid)]: { cameraOn: false, micOn: true, hold: false, updatedAt: Date.now() }
    };
    const callRef = doc(db, COLLECTIONS.calls, callId);
    await setDoc(callRef, {
      chatId,
      kind,
      status: "preparing",
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: ownDisplayName(),
      callerPhotoURL: ownPhotoUrl(),
      receiverUid,
      receiverName: getChatTitle(chatData, "user"),
      receiverPhotoURL: getChatPhoto(chatData, "user"),
      participants: uniqueClean([ownCallUid(), receiverUid]),
      media,
      expiresAtMs,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    });

    renderCallOverlay();
    startOutgoingDialTone();
    await setupPeerConnection(activeCall, true);
    const offer = await activeCall.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await activeCall.pc.setLocalDescription(offer);
    await updateDoc(callRef, {
      status: "ringing",
      offer: { type: offer.type, sdp: offer.sdp },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    });
    await setDoc(doc(db, COLLECTIONS.callInbox, receiverUid), {
      callId,
      receiverUid,
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: ownDisplayName(),
      callerPhotoURL: ownPhotoUrl(),
      chatId,
      kind,
      status: "ringing",
      expiresAtMs,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });

    activeCall.ringTimer = setTimeout(() => markCallMissed(callId), CHAT_CONFIG.callRingTimeoutMs + 1200);
    watchActiveCall(callId);
  } catch (error) {
    endCall(false);
    showToast("Camera or microphone permission is needed.", "bad");
  }
}

function showIncomingCall(callId, call) {
  document.getElementById("adnnIncomingCallOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "adnnIncomingCallOverlay";
  overlay.className = "adnn-call-popout is-incoming";
  overlay.innerHTML = `
    <div class="adnn-incoming-call">
      <div class="adnn-call-drag-handle" data-call-drag><span>Incoming call</span><span>Drag</span></div>
      ${avatarMarkup(call.callerName || "AD", call.callerPhotoURL)}
      <h3>${escapeHtml(call.callerName || "Incoming call")}</h3>
      <p>${call.kind === "video" ? "Video" : "Audio"} call</p>
      <div>
        <button type="button" class="is-accept" data-accept>${ICON.phone}</button>
        <button type="button" class="is-end" data-reject>${ICON.hang}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  placeCallPopout(overlay);
  makeDraggable(overlay, overlay.querySelector("[data-call-drag]"));
  startIncomingRingtone();
  notifyBrowser(`${call.callerName || "Incoming call"}`, `${call.kind === "video" ? "Video" : "Audio"} call`, call.callerPhotoURL);

  const timeout = setTimeout(() => {
    callWatch?.();
    overlay.remove();
    stopIncomingRingtone();
    markCallMissed(callId);
  }, Math.max(1000, Number(call.expiresAtMs || 0) - Date.now()));
  const callWatch = onSnapshot(doc(db, COLLECTIONS.calls, callId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.status && data.status !== "ringing") {
      clearTimeout(timeout);
      callWatch?.();
      overlay.remove();
      stopIncomingRingtone();
    }
  }, () => {});

  overlay.querySelector("[data-reject]")?.addEventListener("click", () => {
    clearTimeout(timeout);
    callWatch?.();
    overlay.remove();
    stopIncomingRingtone();
    const endedAtMs = Date.now();
    updateDoc(doc(db, COLLECTIONS.calls, callId), { status: "ended", endedReason: "rejected", endedAtMs, durationMs: 0, summaryWriterUid: ownCallUid(), updatedAt: serverTimestamp(), updatedAtMs: endedAtMs }).catch(() => {});
    writeCallSummaryMessage({ ...call, callId }, "ended", "rejected", { endedAtMs, durationMs: 0 }).catch(() => {});
    cleanupCallInbox(callId, ownCallUid());
  });

  overlay.querySelector("[data-accept]")?.addEventListener("click", async () => {
    clearTimeout(timeout);
    callWatch?.();
    overlay.remove();
    stopIncomingRingtone();
    await acceptCall(callId, call);
  });
}

async function acceptCall(callId, call) {
  if (activeCall) return;
  stopIncomingRingtone();
  stopOutgoingDialTone();
  try {
    const wantsVideo = call.kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    activeCall = createCallState(callId, "receiver", call.kind, stream, call.chatId, {
      id: call.chatId,
      type: "direct",
      participantUids: [call.callerUid, ownCallUid()],
      participantNames: { [call.callerUid]: call.callerName || "Caller", [ownCallUid()]: ownDisplayName() }
    }, call.callerUid);
    activeCall.remoteCameraOn = !!call.media?.[fieldKey(call.callerUid)]?.cameraOn;
    renderCallOverlay();
    await setupPeerConnection(activeCall, false);
    await activeCall.pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    await flushRemoteCandidates(activeCall);
    const answer = await activeCall.pc.createAnswer();
    await activeCall.pc.setLocalDescription(answer);
    await updateDoc(doc(db, COLLECTIONS.calls, callId), {
      status: "accepted",
      answer: { type: answer.type, sdp: answer.sdp },
      [`media.${fieldKey(ownCallUid())}`]: { cameraOn: wantsVideo, micOn: true, hold: false, updatedAt: Date.now() },
      acceptedAt: serverTimestamp(),
      acceptedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    });
    await setDoc(doc(db, COLLECTIONS.callInbox, ownCallUid()), { status: "accepted", callId, updatedAt: serverTimestamp() }, { merge: true });
    watchActiveCall(callId);
  } catch (error) {
    showToast("Could not answer the call.", "bad");
    updateDoc(doc(db, COLLECTIONS.calls, callId), { status: "ended", endedReason: "answer_failed", updatedAt: serverTimestamp(), updatedAtMs: Date.now() }).catch(() => {});
  }
}

function createCallState(callId, role, kind, stream, chatId, chatData, remoteUid) {
  return {
    callId,
    role,
    kind,
    chatId,
    chatData,
    remoteUid,
    localStream: stream,
    remoteStream: new MediaStream(),
    pc: null,
    cameraOn: kind === "video",
    remoteCameraOn: false,
    micOn: true,
    onHold: false,
    remoteOnHold: false,
    startedAt: Date.now(),
    acceptedAtMs: 0,
    ringTimer: null,
    videoSender: null,
    unsubs: [],
    remoteCandidateQueue: [],
    lastRemoteOfferSdp: "",
    summaryWritten: false
  };
}

async function addRemoteCandidate(call, candidateData) {
  if (!call?.pc || !candidateData) return;
  const candidate = new RTCIceCandidate(candidateData);
  if (call.pc.remoteDescription?.type) {
    await call.pc.addIceCandidate(candidate).catch(() => {});
    return;
  }
  call.remoteCandidateQueue.push(candidate);
}

async function flushRemoteCandidates(call) {
  if (!call?.pc?.remoteDescription?.type || !call.remoteCandidateQueue?.length) return;
  const queued = call.remoteCandidateQueue.splice(0);
  for (const candidate of queued) {
    await call.pc.addIceCandidate(candidate).catch(() => {});
  }
}

async function setupPeerConnection(call, caller) {
  const pc = new RTCPeerConnection({ iceServers: CHAT_CONFIG.iceServers });
  call.pc = pc;

  call.localStream.getTracks().forEach((track) => {
    const sender = pc.addTrack(track, call.localStream);
    if (track.kind === "video") call.videoSender = sender;
  });
  if (!call.videoSender) {
    try {
      call.videoSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
    } catch (_) {}
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const path = caller ? COLLECTIONS.offerCandidates : COLLECTIONS.answerCandidates;
    addDoc(collection(db, COLLECTIONS.calls, call.callId, path), event.candidate.toJSON()).catch(() => {});
  };

  pc.ontrack = (event) => {
    const streams = event.streams?.length ? event.streams : [new MediaStream([event.track])];
    streams[0].getTracks().forEach((track) => {
      if (!call.remoteStream.getTracks().some((existing) => existing.id === track.id)) {
        call.remoteStream.addTrack(track);
        track.onunmute = () => attachCallMedia();
      }
    });
    attachCallMedia();
  };

  pc.onconnectionstatechange = () => {
    updateCallStatusText(connectionStateText(pc.connectionState));
    if (["failed", "closed"].includes(pc.connectionState)) endCall(true);
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") pc.restartIce?.();
  };

  const remotePath = caller ? COLLECTIONS.answerCandidates : COLLECTIONS.offerCandidates;
  resilientSnapshot(`callCandidates:${call.callId}:${remotePath}`, collection(db, COLLECTIONS.calls, call.callId, remotePath), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") addRemoteCandidate(call, change.doc.data());
    });
  }, () => {}, call.unsubs);
}

function watchActiveCall(callId) {
  resilientSnapshot(`activeCall:${callId}`, doc(db, COLLECTIONS.calls, callId), async (snapshot) => {
    if (!snapshot.exists() || !activeCall || activeCall.callId !== callId) return;
    const data = snapshot.data();
    const answerFromMe = data.answerFromUid && selfUidSet().has(data.answerFromUid);
    if (data.status === "accepted" && data.answer && !answerFromMe && activeCall.pc?.signalingState === "have-local-offer") {
      await activeCall.pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
    }
    const current = Array.isArray(data.blockedBy) ? data.blockedBy : [];
    updateRoomBlockUi(state);
  }, () => {}, state.unsubs);
}

function renderCallOverlay() {
  const shell = document.createElement("div");
  shell.className = "adnn-call-stage";
  return shell;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
}

function formatTime(val) {
  const date = val?.toMillis ? new Date(val.toMillis()) : val ? new Date(val) : new Date();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorKey(val) {
  const date = val?.toMillis ? new Date(val.toMillis()) : val ? new Date(val) : new Date();
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateSeparator(val) {
  const date = val?.toMillis ? new Date(val.toMillis()) : val ? new Date(val) : new Date();
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function shouldShowMessage(message) {
  if (!message) return false;
  const deletedFor = Array.isArray(message.deletedFor) ? message.deletedFor : [];
  return !deletedFor.includes(activeUser?.uid);
}

function isCallEventMessage(message) {
  return !!(message?.callEvent || message?.type === "call");
}

function isOutgoingCallEvent(message) {
  return message?.callerUid === activeUser?.uid;
}

function renderCallMessageBubble(message) {
  return `<div class="adnn-call-event">${escapeHtml(message.text || "Call event")}</div>`;
}

function renderTicks(message) {
  if (message.__pending) return ICON.clock;
  return ICON.check;
}

function fileKind(file) {
  if (file.type.startsWith("image/")) return "Image";
  if (file.type.startsWith("video/")) return "Video";
  if (file.type.startsWith("audio/")) return "Audio";
  return "Document";
}

function fileExt(name) {
  return name.split(".").pop().slice(0, 4).toUpperCase();
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

function bestAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function insertAtCursor(input, value) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = input.value.substring(0, start) + value + input.value.substring(end);
  input.selectionStart = input.selectionEnd = start + value.length;
}

function autoSizeTextArea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function closeMessageMenus() {
  document.querySelectorAll(".adnn-message.is-menu-open").forEach((el) => el.classList.remove("is-menu-open"));
  closeFloatingReactionSheet();
}

function attachmentSummary(attachments) {
  if (!attachments.length) return "Sent a file";
  if (attachments.some((a) => a.voice)) return "Voice note";
  return attachments[0].name;
}

function roomShell(state) {
  return document.getElementById(state.roomId);
}

function closeRoomOnMobile(roomId) {
  const target = document.getElementById(roomId);
  target?.closest(".adnn-chat-layout")?.classList.remove("is-room-open");
  document.body.classList.remove("adnn-chat-mobile-lock");
}

function scrollToBottom(state, smooth = false) {
  const shell = roomShell(state);
  const scroller = shell?.querySelector("[data-message-scroll]");
  if (!scroller) return;
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function filterMessages(state, queryText) {
  const needle = queryText.toLowerCase().trim();
  const shell = roomShell(state);
  shell?.querySelectorAll(".adnn-message-row").forEach((row) => {
    const text = row.querySelector("p")?.textContent?.toLowerCase() || "";
    row.style.display = !needle || text.includes(needle) ? "" : "none";
  });
}

function updateConnectionLabels() {
  const currentLabel = navigator.onLine ? "Online" : "Offline";
  if (currentLabel === lastConnectivityLabel) return;
  lastConnectivityLabel = currentLabel;
  document.querySelectorAll("[data-chat-presence]").forEach((node) => {
    if (node.textContent === "Checking status..." || node.textContent === "Checking...") {
      node.textContent = currentLabel;
    }
  });
}

function bindMessageScrollEscape(scroller, state) {
  if (!scroller) return;
  scroller.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRoomOnMobile(state.roomId);
  });
}

function togglePinnedChat(chatId) {
  const pinned = getPinnedChats();
  if (pinned.has(chatId)) pinned.delete(chatId);
  else pinned.add(chatId);
  try { localStorage.setItem(PINNED_CHAT_STORAGE_KEY, JSON.stringify(Array.from(pinned))); } catch (_) {}
}

function setupSidebarReorder() {}
function ensureSidebarBadges() {}

function initials(name) {
  return (name || "AD").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function relativeTime(epoch) {
  const diff = Date.now() - epoch;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function updateBadgeNode(node, count) {
  if (!node) return;
  node.textContent = String(count);
  node.hidden = count <= 0;
  node.style.display = count > 0 ? "grid" : "none";
}

function updateChatNavigationBadges(chats, scope) {
  let unreadCount = 0;
  chats.forEach((c) => { unreadCount += getUnreadCount(c, scope); });
  document.querySelectorAll('[data-account-badge="chat"]').forEach((n) => updateBadgeNode(node, unreadCount));
}

function notifyThreadUnread() {}
function notifyIncomingMessages() {}

function startOutgoingDialTone() {}
function stopOutgoingDialTone() {}
function startIncomingRingtone() {}
function stopIncomingRingtone() {}

function enforceSilentSoundMigration() {}
function installSilentAudioGuard() {}
function bindNotificationPermissionPrimer() {}
function syncChatSettingsFromStorage() {}
function bindChatSettingsEvents() {}
function bindConnectivitySignals() {}
function bindGlobalDismissers() {}

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

function uniqueClean(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return emailKey(email) === "getavcollab@gmail.com";
}

function ownDisplayName() {
  return activeUser?.displayName || "User";
}

function ownPhotoUrl() {
  return activeUser?.photoURL || "";
}

function getChatPhoto(chat, scope) {
  return chat?.photoURL || "";
}

function getChatTitle(chat, scope) {
  return chat?.title || "Workspace Chat";
}

function getUnreadCount(chat, scope) {
  return scope === "admin" ? (chat?.unreadForAdmin || 0) : (chat?.unreadForClient || 0);
}

function fieldKey(uid) {
  return String(uid).replace(/[^a-zA-Z0-9]/g, "_");
}

function ownCallUid() {
  return activeUser?.uid || "";
}

function getProfile(uid, email) {
  return Promise.resolve({ uid, email, role: "client", name: "User" });
}

function readLocalDesignerProfile() {
  return null;
}

function selfUidSet() {
  const s = new Set();
  if (activeUser?.uid) s.add(activeUser.uid);
  return s;
}

function selfEmailKeyList() {
  return activeUser?.email ? [emailKey(activeUser.email)] : [];
}

function selfEmailKeySet() {
  return new Set(selfEmailKeyList());
}

function deepMerge(target, source) {
  return Object.assign({}, target, source);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function watchIncomingCalls() {}
function watchGlobalThreadBadges() {}
function cleanupSession() {}

function injectChatStyles() {
  if (document.getElementById("adnnChatRuntimeStylesV2")) return;
  const t = CHAT_CONFIG.theme;
  const style = document.createElement("style");
  style.id = "adnnChatRuntimeStylesV2";
  style.textContent = `
    .adnn-chat-app { background: ${t.bg}; color: ${t.text}; }
    .adnn-chat-shell { width: 100%; height: 100%; display: grid; }
    .adnn-chat-layout { display: grid; grid-template-columns: 280px 1fr; height: 100%; }
    .adnn-chat-room { background: ${t.panel}; position: relative; }
    .adnn-message-scroll { overflow-y: auto; height: calc(100% - 140px); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .adnn-composer-wrap { position: absolute; bottom: 0; left: 0; right: 0; padding: 16px; background: ${t.panel}; border-top: 1px solid ${t.line}; }
    .adnn-composer { display: flex; gap: 12px; }
    .adnn-composer textarea { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid ${t.line}; background: ${t.bg}; color: ${t.text}; }
    .adnn-thread { display: flex; align-items: center; gap: 12px; padding: 12px; width: 100%; border: 0; background: transparent; color: ${t.text}; text-align: left; cursor: pointer; }
    .adnn-thread.is-active, .adnn-thread:hover { background: ${t.soft}; }
    .adnn-avatar { width: 40px; height: 40px; border-radius: 50%; background: ${t.primary}; display: grid; place-items: center; font-weight: bold; color: #fff; }
    .adnn-message-row { display: flex; width: 100%; margin-bottom: 8px; }
    .adnn-message-row.is-mine { justify-content: flex-end; }
    .adnn-message-row.is-peer { justify-content: flex-start; }
    .adnn-message { max-width: 70%; padding: 10px; border-radius: 12px; background: ${t.soft}; }
    .is-mine .adnn-message { background: ${t.primary}; color: #fff; }
  `;
  document.head.appendChild(style);
}
