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
  outgoingCallToneFile: "call ringer_01.mp3",
  incomingCallToneFile: "ring-app.mp3",
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
const FIREBASE_CONFIG = window.ADNN_FIREBASE_CONFIG || window.firebaseConfig || null;
const COLLECTIONS = Object.freeze({
  chats: "chats",
  messages: "messages",
  typing: "typing",
  presence: "presence",
  calls: "calls",
  callInbox: "callInbox",
  offerCandidates: "offerCandidates",
  answerCandidates: "answerCandidates"
});
const REACTION_SET = ["?", "??", "?", "?", "?", "?", "?", "?", "?", "?"];

let app = null;
let auth = null;
let db = null;
let storage = null;
let activeUser = null;
let activeProfile = null;
let presenceTimer = null;
let connectionBannerTimer = null;
let incomingCallUnsub = null;
let callTimer = null;
let activeCall = null;
let globalThreadBadgeUnsub = null;
let outgoingDialAudio = null;
let incomingRingAudio = null;
let lastSoundAtMs = 0;
let chatAudioUnlockedThisSession = false;
let chatAudioReadyAtMs = Date.now() + 12000;
let sessionStarted = false;
let notificationsReadyAtMs = Date.now() + 2600;
let offlinePersistenceState = "unknown";
let lastConnectivityLabel = "";

const rooms = new Map();
const listWatchers = new Map();
const objectUrls = new Set();
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
        <section class="adnn-chat-room" id="${escapeAttr(roomId)}"></section>
      </div>
    </div>
  `;
}

function bindFrameChrome(root, listId, roomId) {
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

  const listen = (key, refOrQuery) => resilientSnapshot(`threads:${listId}:${key}`, refOrQuery, (snapshot) => {
    sources.set(key, new Map(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data(), __pending: item.metadata.hasPendingWrites }])));
    renderMergedThreads();
  }, (error) => {
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
    Array.from(selfUidSet()).forEach((uid, index) => {
      listen(`participant-${index}`, query(collection(db, COLLECTIONS.chats), where("participantUids", "array-contains", uid)));
    });
    selfEmailKeyList().forEach((mail, index) => {
      listen(`participant-email-${index}`, query(collection(db, COLLECTIONS.chats), where("participantEmailKeys", "array-contains", mail)));
    });
    if (activeProfile?.role === "designer") {
      listen("designer-room", query(collection(db, COLLECTIONS.chats), where("type", "==", "designer-room")));
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
  return !deletedFor.some((uid) => selfUidSet().has(uid));
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
        <button type="button" class="adnn-pin-chat" data-pin-chat="${escapeAttr(chat.id)}" title="${pinned ? "Unpin chat" : "Pin chat"}" aria-label="${pinned ? "Unpin chat" : "Pin chat"}">${pinned ? "?" : "?"}</button>
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
  if (navigator.vibrate) navigator.vibrate(18);
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
  const detail = `${duration ? formatDuration(duration) + " · " : ""}${formatTime(message.createdAt || message.createdAtMs)}`;
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
  const remoteUid = getRemoteUid(state.chatData);
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
        <div><strong>${escapeHtml(item.file.name)}</strong><small>${escapeHtml(item.kind)} • ${formatBytes(item.file.size)}</small>${progress ? `<i style="--p:${Math.max(0, Math.min(100, progress.pct))}%"></i>` : ""}</div>
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
    // Firestore rules may intentionally block read receipt writes; the UI remains usable.
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
    showInAppNotification(getChatTitle(chatData, "user"), `Missed ${kind === "video" ? "video" : "audio"} call · user offline`, { tone: "missed", icon: getChatPhoto(chatData, "user") });
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
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);

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
      await flushRemoteCandidates(activeCall);
    }
    const offerFromMe = data.offerFromUid && selfUidSet().has(data.offerFromUid);
    const shouldAnswerRemoteOffer = data.offer && data.kind === "video" && !offerFromMe && activeCall.pc?.signalingState === "stable" && data.offer.sdp !== activeCall.lastRemoteOfferSdp;
    if (shouldAnswerRemoteOffer) {
      activeCall.lastRemoteOfferSdp = data.offer.sdp;
      await activeCall.pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch(() => {});
      await flushRemoteCandidates(activeCall);
      const answer = await activeCall.pc.createAnswer().catch(() => null);
      if (answer) {
        await activeCall.pc.setLocalDescription(answer).catch(() => {});
        await updateDoc(doc(db, COLLECTIONS.calls, callId), {
          answer: { type: answer.type, sdp: answer.sdp },
          answerFromUid: ownCallUid(),
          updatedAt: serverTimestamp(),
          updatedAtMs: Date.now()
        }).catch(() => {});
      }
    }
    if (data.kind && data.kind !== activeCall.kind) {
      activeCall.kind = data.kind;
      refreshCallControls();
    }
    const remoteMedia = data.media?.[fieldKey(activeCall.remoteUid)] || data.media?.[activeCall.remoteUid];
    activeCall.remoteCameraOn = !!remoteMedia?.cameraOn;
    activeCall.remoteOnHold = !!remoteMedia?.hold;
    attachCallMedia();
    updateHoldUi();
    if (data.status === "accepted") {
      stopOutgoingDialTone();
      stopIncomingRingtone();
      activeCall.acceptedAtMs = data.acceptedAtMs || activeCall.acceptedAtMs || Date.now();
      startCallTimer();
    }
    if (["ended", "missed"].includes(data.status)) {
      if (!data.summaryWriterUid || data.summaryWriterUid === ownCallUid()) {
        await writeCallSummaryMessage(activeCall, data.status, data.endedReason, data).catch(() => {});
      }
      endCall(false);
    }
  }, () => {}, activeCall?.unsubs || []);
}

function renderCallOverlay() {
  document.getElementById("adnnCallOverlay")?.remove();
  if (!activeCall) return;
  const overlay = document.createElement("div");
  overlay.id = "adnnCallOverlay";
  overlay.className = "adnn-call-popout";
  const peerName = getChatTitle(activeCall.chatData, "user");
  overlay.innerHTML = `
    <div class="adnn-call-card ${activeCall.kind === "audio" ? "is-audio" : ""}">
      <div class="adnn-call-drag-handle" data-call-drag><span>${escapeHtml(activeCall.kind === "video" ? "Video call" : "Audio call")}</span><span>Drag</span></div>
      <div class="adnn-call-stage" data-call-stage>
        <div class="adnn-video-tile is-remote" data-remote-tile><video autoplay playsinline data-remote-video></video><span>${escapeHtml(peerName)}</span></div>
        <div class="adnn-video-tile is-local" data-local-tile><video autoplay muted playsinline data-local-video></video><span>You</span></div>
        <div class="adnn-audio-call-face" data-audio-face>${avatarMarkup(peerName, getChatPhoto(activeCall.chatData, "user"))}</div>
        <div class="adnn-call-hold-badge" data-call-hold-badge hidden>Call on hold</div>
      </div>
      <div class="adnn-call-meta"><strong>${escapeHtml(peerName)}</strong><small data-call-time>Connecting...</small></div>
      <div class="adnn-call-controls">
        <button type="button" data-call-mic title="Mute">${ICON.mic}</button>
        <button type="button" data-call-hold title="Hold call">${activeCall.onHold ? ICON.play : ICON.hold}</button>
        <button type="button" data-call-camera title="${activeCall.kind === "audio" ? "Switch to video" : "Camera"}">${activeCall.kind === "video" && activeCall.cameraOn ? ICON.videoOff : ICON.video}</button>
        <button type="button" class="is-end" data-call-end title="End call">${ICON.hang}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  placeCallPopout(overlay);
  makeDraggable(overlay, overlay.querySelector("[data-call-drag]"));
  overlay.querySelector("[data-call-mic]")?.addEventListener("click", toggleCallMic);
  overlay.querySelector("[data-call-hold]")?.addEventListener("click", toggleCallHold);
  overlay.querySelector("[data-call-camera]")?.addEventListener("click", toggleCallCamera);
  overlay.querySelector("[data-call-end]")?.addEventListener("click", () => endCall(true));
  attachCallMedia();
  updateHoldUi();
}

function attachCallMedia() {
  if (!activeCall) return;
  const overlay = document.getElementById("adnnCallOverlay");
  if (!overlay) return;
  const localVideo = overlay.querySelector("[data-local-video]");
  const remoteVideo = overlay.querySelector("[data-remote-video]");
  const localTile = overlay.querySelector("[data-local-tile]");
  const remoteTile = overlay.querySelector("[data-remote-tile]");
  const audioFace = overlay.querySelector("[data-audio-face]");
  const holdBadge = overlay.querySelector("[data-call-hold-badge]");

  if (localVideo && localVideo.srcObject !== activeCall.localStream) localVideo.srcObject = activeCall.localStream;
  if (remoteVideo && remoteVideo.srcObject !== activeCall.remoteStream) remoteVideo.srcObject = activeCall.remoteStream;
  localVideo?.play?.().catch(() => {});
  remoteVideo?.play?.().catch(() => {});

  const localOn = activeCall.kind === "video" && !activeCall.onHold && activeCall.cameraOn && activeCall.localStream.getVideoTracks().some((track) => track.readyState !== "ended" && track.enabled !== false);
  const remoteHasVideo = activeCall.remoteStream.getVideoTracks().some((track) => track.readyState !== "ended");
  const remoteOn = activeCall.kind === "video" && !activeCall.remoteOnHold && (activeCall.remoteCameraOn || remoteHasVideo) && remoteHasVideo;
  if (localTile) localTile.hidden = !localOn;
  if (remoteTile) remoteTile.hidden = !remoteOn;
  if (audioFace) audioFace.hidden = localOn || remoteOn;
  if (holdBadge) {
    holdBadge.hidden = !(activeCall.onHold || activeCall.remoteOnHold);
    holdBadge.textContent = activeCall.onHold ? "You put the call on hold" : "User is on hold";
  }
}

async function toggleCallMic(event) {
  if (!activeCall) return;
  activeCall.micOn = !activeCall.micOn;
  activeCall.localStream.getAudioTracks().forEach((track) => { track.enabled = activeCall.micOn && !activeCall.onHold; });
  event.currentTarget.innerHTML = activeCall.micOn ? ICON.mic : ICON.micOff;
  event.currentTarget.classList.toggle("is-off", !activeCall.micOn);
  await updateDoc(doc(db, COLLECTIONS.calls, activeCall.callId), {
    [`media.${fieldKey(ownCallUid())}.micOn`]: activeCall.micOn,
    [`media.${fieldKey(ownCallUid())}.updatedAt`]: Date.now(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }).catch(() => {});
}

async function toggleCallCamera(event) {
  if (!activeCall) return;
  const button = event?.currentTarget;
  if (activeCall.kind !== "video") {
    await upgradeCallToVideo(button);
    return;
  }
  activeCall.cameraOn = !activeCall.cameraOn;
  if (activeCall.cameraOn) await ensureLocalVideoTrack(activeCall);
  activeCall.localStream.getVideoTracks().forEach((track) => { track.enabled = activeCall.cameraOn && !activeCall.onHold; });
  if (button) {
    button.innerHTML = activeCall.cameraOn ? ICON.videoOff : ICON.video;
    button.classList.toggle("is-off", !activeCall.cameraOn);
  }
  await updateDoc(doc(db, COLLECTIONS.calls, activeCall.callId), {
    [`media.${fieldKey(ownCallUid())}.cameraOn`]: activeCall.cameraOn,
    [`media.${fieldKey(ownCallUid())}.updatedAt`]: Date.now(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }).catch(() => {});
  attachCallMedia();
}

async function upgradeCallToVideo(button) {
  if (!activeCall) return;
  try {
    await ensureLocalVideoTrack(activeCall);
    activeCall.kind = "video";
    activeCall.cameraOn = true;
    activeCall.localStream.getVideoTracks().forEach((track) => { track.enabled = !activeCall.onHold; });
    const offer = await activeCall.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await activeCall.pc.setLocalDescription(offer);
    await updateDoc(doc(db, COLLECTIONS.calls, activeCall.callId), {
      kind: "video",
      offer: { type: offer.type, sdp: offer.sdp },
      offerFromUid: ownCallUid(),
      [`media.${fieldKey(ownCallUid())}.cameraOn`]: true,
      [`media.${fieldKey(ownCallUid())}.updatedAt`]: Date.now(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(() => {});
    refreshCallControls();
    attachCallMedia();
    showToast("Video enabled for this call.", "ok");
  } catch (_) {
    showToast("Camera permission is needed to switch to video.", "bad");
    if (button) button.classList.remove("is-off");
  }
}

async function ensureLocalVideoTrack(call) {
  let track = call.localStream.getVideoTracks().find((item) => item.readyState !== "ended");
  if (!track) {
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    track = videoStream.getVideoTracks()[0];
    call.localStream.addTrack(track);
  }
  const sender = call.videoSender || call.pc?.getSenders?.().find((item) => item.track?.kind === "video") || call.pc?.getSenders?.().find((item) => !item.track);
  if (sender?.replaceTrack) {
    await sender.replaceTrack(track);
    call.videoSender = sender;
  } else if (call.pc) {
    call.videoSender = call.pc.addTrack(track, call.localStream);
  }
  return track;
}

async function toggleCallHold(event) {
  if (!activeCall) return;
  activeCall.onHold = !activeCall.onHold;
  activeCall.localStream.getAudioTracks().forEach((track) => { track.enabled = activeCall.micOn && !activeCall.onHold; });
  activeCall.localStream.getVideoTracks().forEach((track) => { track.enabled = activeCall.cameraOn && !activeCall.onHold; });
  await updateDoc(doc(db, COLLECTIONS.calls, activeCall.callId), {
    [`media.${fieldKey(ownCallUid())}.hold`]: activeCall.onHold,
    [`media.${fieldKey(ownCallUid())}.updatedAt`]: Date.now(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  }).catch(() => {});
  updateHoldUi(event?.currentTarget);
  attachCallMedia();
}

function refreshCallControls() {
  if (!activeCall) return;
  const overlay = document.getElementById("adnnCallOverlay");
  if (!overlay) return;
  const card = overlay.querySelector(".adnn-call-card");
  card?.classList.toggle("is-audio", activeCall.kind === "audio");
  const dragTitle = overlay.querySelector("[data-call-drag] span:first-child");
  if (dragTitle) dragTitle.textContent = activeCall.kind === "video" ? "Video call" : "Audio call";
  const camera = overlay.querySelector("[data-call-camera]");
  if (camera) {
    camera.title = activeCall.kind === "audio" ? "Switch to video" : "Camera";
    camera.innerHTML = activeCall.kind === "video" && activeCall.cameraOn ? ICON.videoOff : ICON.video;
    camera.classList.toggle("is-off", activeCall.kind === "video" && !activeCall.cameraOn);
  }
}

function updateHoldUi(button = null) {
  if (!activeCall) return;
  const holdBtn = button || document.querySelector("#adnnCallOverlay [data-call-hold]");
  if (holdBtn) {
    holdBtn.innerHTML = activeCall.onHold ? ICON.play : ICON.hold;
    holdBtn.title = activeCall.onHold ? "Resume call" : "Hold call";
    holdBtn.classList.toggle("is-off", !!activeCall.onHold);
  }
  if (activeCall.onHold) updateCallStatusText("You are on hold");
  else if (activeCall.remoteOnHold) updateCallStatusText("User is on hold");
}

function startCallTimer() {
  stopOutgoingDialTone();
  stopIncomingRingtone();
  if (!activeCall) return;
  if (callTimer) return;
  const startedAt = activeCall.acceptedAtMs || Date.now();
  activeCall.acceptedAtMs = startedAt;
  if (activeCall.ringTimer) clearTimeout(activeCall.ringTimer);
  activeCall.ringTimer = null;
  const tick = () => {
    if (!activeCall) return;
    if (activeCall.onHold) return updateCallStatusText("You are on hold");
    if (activeCall.remoteOnHold) return updateCallStatusText("User is on hold");
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    updateCallStatusText(`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`);
  };
  tick();
  callTimer = setInterval(tick, 1000);
}

function updateCallStatusText(text) {
  const node = document.querySelector("[data-call-time]");
  if (node) node.textContent = text;
}

async function markCallMissed(callId) {
  const ref = doc(db, COLLECTIONS.calls, callId);
  const snap = await getDoc(ref).catch(() => null);
  const data = snap?.exists() ? { callId, ...snap.data() } : { callId };
  const endedAtMs = Date.now();
  await updateDoc(ref, { status: "missed", endedReason: "timeout", endedAtMs, durationMs: 0, summaryWriterUid: ownCallUid(), updatedAt: serverTimestamp(), updatedAtMs: endedAtMs }).catch(() => {});
  await writeCallSummaryMessage(activeCall?.callId === callId ? activeCall : data, "missed", "timeout", { ...data, endedAtMs, durationMs: 0 }).catch(() => {});
  if (activeCall?.callId === callId) endCall(false);
}

function endCall(updateRemote = true) {
  const call = activeCall;
  if (!call) return;
  const endedAtMs = Date.now();
  const durationMs = call.acceptedAtMs ? Math.max(0, endedAtMs - call.acceptedAtMs) : 0;
  if (updateRemote) {
    updateDoc(doc(db, COLLECTIONS.calls, call.callId), { status: "ended", endedReason: "hangup", endedAtMs, durationMs, summaryWriterUid: ownCallUid(), updatedAt: serverTimestamp(), updatedAtMs: endedAtMs }).catch(() => {});
    writeCallSummaryMessage(call, "ended", "hangup", { endedAtMs, durationMs }).catch(() => {});
  }
  call.unsubs.forEach((unsub) => unsub?.());
  call.localStream?.getTracks?.().forEach((track) => track.stop());
  call.pc?.close?.();
  if (call.ringTimer) clearTimeout(call.ringTimer);
  cleanupCallInbox(call.callId, ownCallUid());
  stopOutgoingDialTone();
  stopIncomingRingtone();
  document.getElementById("adnnCallOverlay")?.remove();
  document.getElementById("adnnIncomingCallOverlay")?.remove();
  if (callTimer) clearInterval(callTimer);
  callTimer = null;
  activeCall = null;
}

function cleanupCallInbox(callId, uid) {
  setTimeout(() => {
    deleteDoc(doc(db, COLLECTIONS.callInbox, uid)).catch(() => {});
    getDocs(collection(db, COLLECTIONS.calls, callId, COLLECTIONS.offerCandidates)).then((snap) => snap.forEach((item) => deleteDoc(item.ref))).catch(() => {});
    getDocs(collection(db, COLLECTIONS.calls, callId, COLLECTIONS.answerCandidates)).then((snap) => snap.forEach((item) => deleteDoc(item.ref))).catch(() => {});
  }, CHAT_CONFIG.callSignalCleanupDelayMs);
}


async function writeCallSummaryMessage(call, status = "ended", endedReason = "hangup", data = {}) {
  if (!call?.chatId || !call?.callId || !db) return;
  if (call.summaryWritten && status !== "missed") return;
  call.summaryWritten = true;
  const endedAtMs = Number(data.endedAtMs || Date.now());
  const acceptedAtMs = Number(data.acceptedAtMs || call.acceptedAtMs || 0);
  const durationMs = Number(data.durationMs ?? (acceptedAtMs ? Math.max(0, endedAtMs - acceptedAtMs) : 0));
  const callerUid = data.callerUid || call.callerUid || (call.role === "caller" ? ownCallUid() : call.remoteUid) || "";
  const receiverUid = data.receiverUid || call.receiverUid || (call.role === "caller" ? call.remoteUid : ownCallUid()) || "";
  const kind = data.kind || call.kind || "audio";
  const messageRef = doc(db, COLLECTIONS.chats, call.chatId, COLLECTIONS.messages, `call_${call.callId}`);
  const payload = {
    type: "call",
    system: "call",
    callEvent: true,
    callId: call.callId,
    callStatus: status,
    endedReason: endedReason || "hangup",
    kind,
    callerUid,
    callerName: data.callerName || call.callerName || (callerUid === ownCallUid() ? ownDisplayName() : getChatTitle(call.chatData, "user")),
    callerPhotoURL: data.callerPhotoURL || call.callerPhotoURL || (callerUid === ownCallUid() ? ownPhotoUrl() : getChatPhoto(call.chatData, "user")),
    receiverUid,
    receiverName: data.receiverName || call.receiverName || (receiverUid === ownCallUid() ? ownDisplayName() : getChatTitle(call.chatData, "user")),
    receiverPhotoURL: data.receiverPhotoURL || call.receiverPhotoURL || (receiverUid === ownCallUid() ? ownPhotoUrl() : getChatPhoto(call.chatData, "user")),
    durationMs,
    createdAt: serverTimestamp(),
    createdAtMs: endedAtMs,
    updatedAt: serverTimestamp(),
    updatedAtMs: endedAtMs,
    senderUid: callerUid,
    senderAliasUid: callerUid,
    senderRealUid: data.callerRealUid || call.callerRealUid || (callerUid === ownCallUid() ? activeUser?.uid : callerUid),
    senderName: data.callerName || call.callerName || "Caller",
    readBy: uniqueClean([ownCallUid()])
  };
  await setDoc(messageRef, payload, { merge: true });

  const remoteUnreadUid = callerUid === ownCallUid() ? receiverUid : callerUid;
  const lastMessage = callSummaryLastMessage(payload);
  const chatUpdate = {
    lastMessage,
    lastMessageKind: "call",
    lastSenderUid: callerUid,
    lastSenderAliasUid: callerUid,
    updatedAt: serverTimestamp(),
    updatedAtMs: endedAtMs
  };
  if (remoteUnreadUid) chatUpdate.unreadBy = { [fieldKey(remoteUnreadUid)]: increment(1) };
  await setDoc(doc(db, COLLECTIONS.chats, call.chatId), chatUpdate, { merge: true }).catch(() => {});
}

function callSummaryLastMessage(message) {
  const kind = message.kind === "video" ? "video" : "audio";
  if (message.callStatus === "missed" || message.endedReason === "timeout" || message.endedReason === "offline") return `Missed ${kind} call`;
  if (message.endedReason === "rejected") return `Declined ${kind} call`;
  return `${kind[0].toUpperCase()}${kind.slice(1)} call · ${formatDuration(Math.round((message.durationMs || 0) / 1000))}`;
}

async function getProfile(uid, email) {
  const enrich = (role, data = {}) => ({
    uid,
    email,
    role,
    ...data,
    photoURL: data.photoURL || data.avatarURL || data.avatar || data.profilePhotoURL || data.profileImage || activeUser?.photoURL || ""
  });
  const client = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (client?.exists()) return enrich("client", client.data());
  const designer = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designer?.exists()) return enrich("designer", designer.data());
  const admin = isAdminEmail(email);
  return enrich(admin ? "admin" : "client", {
    name: activeUser?.displayName || emailKey(email).split("@")[0] || (admin ? `${CHAT_CONFIG.brandName} Admin` : "User")
  });
}

function getChatTitle(chat, scope = "user") {
  if (!chat) return "Chat";
  if (chat.type === "support") {
    if (isAdminEmail(activeUser?.email) || scope === "admin") return chat.clientName || chat.clientEmail || "Client";
    return CHAT_CONFIG.supportTitle;
  }
  if (chat.type === "group" || chat.isGroup) return chat.groupName || chat.title || "Group chat";
  const names = chat.participantNames || {};
  const uid = getRemoteUid(chat);
  return names[uid] || chat.title || chat.clientName || chat.clientEmail || "Workspace Chat";
}

function getRemoteUid(chat) {
  if (!chat || !activeUser) return "";
  if (chat.type === "support") return isAdminEmail(activeUser.email) ? chat.clientUid : ADMIN_ALIAS_UID;
  const mine = selfUidSet();
  const participants = Array.isArray(chat.participantUids) ? chat.participantUids : [];
  return participants.find((uid) => !mine.has(uid)) || "";
}

function ownCallUid() {
  return isAdminEmail(activeUser?.email) ? ADMIN_ALIAS_UID : activeUser?.uid;
}

function ownDisplayName() {
  return activeProfile?.name || activeProfile?.displayName || activeProfile?.designerName || activeProfile?.clientName || activeProfile?.email || activeUser?.displayName || activeUser?.email || "User";
}

function setupProfileNameConfirmEditor() {
  const nameNode = document.getElementById("accountName") || document.getElementById("designerName");
  if (!nameNode || nameNode.dataset.adnnNameConfirmReady === "true") return;
  nameNode.dataset.adnnNameConfirmReady = "true";
  const parent = nameNode.parentElement;
  if (!parent) return;
  parent.classList.add("adnn-name-confirm-row");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "adnn-name-confirm-btn";
  button.innerHTML = ICON.check;
  button.title = "Save name";
  button.setAttribute("aria-label", "Save name");
  button.hidden = true;
  parent.appendChild(button);
  const original = () => String(activeProfile?.name || activeProfile?.displayName || nameNode.textContent || "").trim();
  nameNode.addEventListener("input", () => {
    button.hidden = String(nameNode.textContent || "").trim() === original();
  });
  nameNode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveProfileDisplayName(nameNode, button);
    }
  });
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => saveProfileDisplayName(nameNode, button));
}

async function saveProfileDisplayName(nameNode, button) {
  if (!activeUser || !db || !nameNode) return;
  const previous = ownDisplayName();
  const nextName = String(nameNode.textContent || "").trim().replace(/\s+/g, " ");
  if (!nextName) {
    nameNode.textContent = previous;
    button.hidden = true;
    return;
  }
  if (normalizeNameKey(nextName).length < 2) {
    showToast("Use a clearer name.", "warn");
    return;
  }
  button.disabled = true;
  try {
    const available = await isDisplayNameAvailable(nextName);
    if (!available) {
      nameNode.textContent = previous;
      showToast("That name is already used. Choose another one.", "warn");
      return;
    }
    const role = activeProfile?.role === "designer" ? "designers" : "clients";
    await setDoc(doc(db, role, activeUser.uid), {
      name: nextName,
      displayName: nextName,
      nameKey: normalizeNameKey(nextName),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });
    await syncChatParticipantName(nextName);
    activeProfile = { ...(activeProfile || {}), name: nextName, displayName: nextName };
    updateLocalProfileName(nextName);
    button.hidden = true;
    showToast("Name updated.", "ok");
  } catch (error) {
    showToast(readableFirebaseError(error), "bad");
  } finally {
    button.disabled = false;
  }
}

function normalizeNameKey(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function isDisplayNameAvailable(name) {
  const key = normalizeNameKey(name);
  const collections = ["clients", "designers"];
  for (const collectionName of collections) {
    const snap = await getDocs(collection(db, collectionName)).catch(() => null);
    if (!snap) continue;
    const duplicate = snap.docs.some((item) => {
      if (item.id === activeUser?.uid) return false;
      const data = item.data() || {};
      const other = normalizeNameKey(data.name || data.displayName || data.designerName || data.clientName);
      return other && other === key;
    });
    if (duplicate) return false;
  }
  return true;
}

async function syncChatParticipantName(name) {
  const self = activeUser?.uid;
  if (!self || !db) return;
  const snap = await getDocs(query(collection(db, COLLECTIONS.chats), where("participantUids", "array-contains", self))).catch(() => null);
  if (!snap) return;
  const batch = writeBatch(db);
  snap.docs.forEach((item) => {
    const data = item.data() || {};
    batch.set(item.ref, {
      participantNames: { ...(data.participantNames || {}), [self]: name },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }, { merge: true });
  });
  await batch.commit().catch(() => {});
}

function updateLocalProfileName(name) {
  const key = location.pathname.includes("designer-account.html") ? "customDesignerName" : "customClientName";
  try { localStorage.setItem(key, name); } catch (_) {}
  const avatar = document.getElementById("accountAvatar") || document.getElementById("designerAvatar");
  if (avatar && !avatar.style.backgroundImage) avatar.textContent = name.trim().slice(0, 2).toUpperCase();
  const userKey = location.pathname.includes("designer-account.html") ? "adnnDesignerUser" : "adhnanPortfolioUser";
  try {
    const stored = JSON.parse(localStorage.getItem(userKey) || "null");
    if (stored) {
      stored.name = name;
      localStorage.setItem(userKey, JSON.stringify(stored));
    }
  } catch (_) {}
}


function ownPhotoUrl() {
  return safeImageUrl(activeProfile?.photoURL || activeProfile?.avatarURL || activeProfile?.avatar || activeProfile?.profilePhotoURL || activeProfile?.profileImage || activeUser?.photoURL || "");
}

function getChatPhoto(chat, scope = "user") {
  if (!chat) return "";
  const uid = getRemoteUid(chat);
  const photos = chat.participantPhotos || chat.participantPhotoMap || chat.participantPhotoURLs || {};
  if (uid && photos[uid]) return safeImageUrl(photos[uid]);
  if (chat.type === "support" && (scope === "admin" || isAdminEmail(activeUser?.email))) return safeImageUrl(chat.clientPhotoURL || chat.clientPhoto || "");
  if (chat.type === "support" && !isAdminEmail(activeUser?.email)) return safeImageUrl(chat.adminPhotoURL || CHAT_CONFIG.adminPhotoURL || "");
  return safeImageUrl(chat.photoURL || chat.avatarURL || chat.clientPhotoURL || "");
}

function avatarMarkup(label, photoUrl = "", extraClass = "") {
  const photo = safeImageUrl(photoUrl);
  const cls = ["adnn-avatar", extraClass || "", photo ? "has-photo" : ""].filter(Boolean).join(" ");
  return `<span class="${escapeAttr(cls)}" title="${escapeAttr(label || "User")}">${photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(label || "User")}">` : escapeHtml(initials(label))}</span>`;
}

function setAvatarNode(node, label, photoUrl = "") {
  if (!node) return;
  const photo = safeImageUrl(photoUrl);
  node.classList.toggle("has-photo", !!photo);
  node.title = label || "User";
  node.innerHTML = photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(label || "User")}">` : escapeHtml(initials(label));
}

function safeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:|data:image\/)/i.test(url)) return url;
  return "";
}

function selfUidSet() {
  return new Set(uniqueClean([activeUser?.uid, ownCallUid()]));
}

function selfEmailKeyList() {
  return uniqueClean([
    activeUser?.email,
    activeProfile?.email,
    activeProfile?.designerEmail,
    activeProfile?.clientEmail,
    activeProfile?.authEmail
  ].map(emailKey));
}

function selfEmailKeySet() {
  return new Set(selfEmailKeyList());
}

function getUnreadCount(chat, scope) {
  if (!chat) return 0;
  if (chat.unreadBy && ownCallUid()) return Number(chat.unreadBy[fieldKey(ownCallUid())] || 0) || 0;
  return scope === "admin" || isAdminEmail(activeUser?.email)
    ? Number(chat.unreadForAdmin || 0)
    : Number(chat.unreadForClient || 0);
}

function normalizeLastMessage(chat) {
  if (!chat) return "No messages yet.";
  if (chat.lastMessageKind === "deleted") return "Message deleted";
  if (chat.lastMessageKind === "call") return chat.lastMessage || "Call";
  if (isCallSummaryText(chat.lastMessage)) return "Call update";
  return chat.lastMessage || "No messages yet.";
}

function attachmentSummary(attachments) {
  if (!attachments?.length) return "Message";
  if (attachments.some((item) => item.voice)) return "Voice message";
  if (attachments.every((item) => item.type?.startsWith("image/"))) return attachments.length > 1 ? `${attachments.length} photos` : "Photo";
  if (attachments.every((item) => item.type?.startsWith("video/"))) return attachments.length > 1 ? `${attachments.length} videos` : "Video";
  return `${attachments.length} file${attachments.length > 1 ? "s" : ""}`;
}

function firstAttachmentName(message) {
  return message.attachments?.[0]?.name || message.mediaName || "";
}

function roomShell(state) {
  return document.querySelector(`[data-room="${cssAttr(state.roomId)}"]`);
}

function filterMessages(state, rawValue) {
  const shell = roomShell(state);
  if (!shell) return;
  const needle = String(rawValue || "").toLowerCase().trim();
  shell.querySelectorAll(".adnn-message-row").forEach((row) => {
    if (!needle) {
      row.hidden = false;
      row.querySelector(".adnn-message")?.classList.remove("is-search-hit");
      return;
    }
    const message = state.messages.find((item) => item.id === row.dataset.messageId);
    const hay = `${message?.text || ""} ${firstAttachmentName(message || {})} ${message?.senderName || ""}`.toLowerCase();
    const hit = hay.includes(needle);
    row.hidden = !hit;
    row.querySelector(".adnn-message")?.classList.toggle("is-search-hit", hit);
  });
}

function scrollToBottom(state, smooth = false) {
  requestAnimationFrame(() => {
    const scroller = roomShell(state)?.querySelector("[data-message-scroll]");
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  });
}

function closeRoomOnMobile(roomId) {
  const room = document.getElementById(roomId);
  const layout = room?.closest(".adnn-chat-layout");
  layout?.classList.remove("is-room-open");
  document.body.classList.remove("adnn-chat-mobile-lock");
}

function goHome() {
  const url = CHAT_CONFIG.homeUrl || "/";
  if (url === "#" || url === location.href) return;
  location.href = url;
}

function refreshAllConnections() {
  publishConnectionState("Reconnecting...", "warn");
  liveSnapshotKeys.forEach((watcher) => watcher.restart?.());
  if (activeUser) {
    startPresence(activeUser);
    watchIncomingCalls();
  }
  rooms.forEach((state) => showRoomConnection(state, navigator.onLine === false ? "Offline mode" : "Reconnecting...", navigator.onLine === false ? "warn" : "ok"));
  setTimeout(updateConnectionLabels, 900);
}

function resilientSnapshot(key, refOrQuery, next, onError, ownerUnsubs = []) {
  let active = true;
  let attempt = 0;
  let currentUnsub = null;
  let retryTimer = null;

  const start = () => {
    if (!active) return;
    currentUnsub?.();
    currentUnsub = onSnapshot(refOrQuery, {
      next: (snapshot) => {
        attempt = 0;
        publishConnectionState(navigator.onLine === false ? "Offline mode" : "Connected", navigator.onLine === false ? "warn" : "ok");
        next(snapshot);
      },
      error: (error) => {
        onError?.(error);
        publishConnectionState(readableFirebaseError(error), isPermissionError(error) ? "bad" : "warn");
        if (!active || isPermissionError(error)) return;
        const wait = Math.min(CHAT_CONFIG.snapshotMaxRetryMs, CHAT_CONFIG.snapshotBaseRetryMs * Math.pow(2, attempt++));
        retryTimer = setTimeout(start, wait);
      }
    });
  };

  const stop = () => {
    active = false;
    currentUnsub?.();
    clearTimeout(retryTimer);
    liveSnapshotKeys.delete(key);
  };

  const restart = () => {
    if (!active) return;
    attempt = 0;
    clearTimeout(retryTimer);
    start();
  };

  liveSnapshotKeys.set(key, { stop, restart });
  ownerUnsubs.push(stop);
  start();
  return stop;
}

async function withRetry(fn, { tries = 3, label = "Firebase action" } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === tries - 1) break;
      await sleep(Math.min(6000, 600 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error(`${label} failed.`);
}

function bindConnectivitySignals() {
  const online = () => {
    publishConnectionState("Back online. Reconnecting...", "ok");
    refreshAllConnections();
  };
  const offline = () => publishConnectionState("Offline mode. Text may queue; media upload waits for connection.", "warn");
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
}

function publishConnectionState(label, tone = "ok") {
  lastConnectivityLabel = label;
  document.querySelectorAll("[data-connection-label]").forEach((node) => {
    node.textContent = label;
    node.dataset.tone = tone;
  });
  document.querySelectorAll("[data-room-connection]").forEach((node) => {
    node.textContent = label;
    node.dataset.tone = tone;
  });
  clearTimeout(connectionBannerTimer);
}

function updateConnectionLabels() {
  const label = navigator.onLine === false ? "Offline mode" : lastConnectivityLabel || "Connected";
  publishConnectionState(label, navigator.onLine === false ? "warn" : "ok");
}

function showRoomConnection(state, text, tone = "ok") {
  const node = roomShell(state)?.querySelector("[data-room-connection]");
  if (!node) return;
  node.textContent = text;
  node.dataset.tone = tone;
}

function bindGlobalDismissers() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-room-menu-trigger], [data-room-menu]")) document.querySelectorAll("[data-room-menu]").forEach((menu) => { menu.hidden = true; });
    if (!event.target.closest("[data-chat-menu], [data-outer-menu]")) document.querySelectorAll("[data-outer-menu]").forEach((menu) => { menu.hidden = true; });
    if (!event.target.closest("[data-toggle-panel], [data-composer-panel]")) document.querySelectorAll("[data-composer-panel]").forEach((panel) => { panel.hidden = true; });
    if (!event.target.closest("[data-emoji-trigger], [data-emoji-panel]")) document.querySelectorAll("[data-emoji-panel]").forEach((panel) => { panel.hidden = true; });
    if (!event.target.closest(".adnn-message")) closeMessageMenus();
  });
  document.addEventListener("click", (event) => {
    const logout = event.target.closest(".logout, .sidebar-logout-item, .account-logout, #headerLogoutButton, #sidebarLogoutButton, #sidebarLogoutActionBtn");
    if (!logout) return;
    if (!window.confirm("Log out of this ADNN account?")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  const escapeCloser = (event) => {
    if (event.key !== "Escape") return;
    closeFloatingReactionSheet();
    closeMessageMenus();
    document.querySelectorAll("[data-room-menu], [data-outer-menu], [data-room-searchbar], [data-composer-panel], [data-emoji-panel]").forEach((node) => { node.hidden = true; });
    const openScroller = document.querySelector(".adnn-chat-layout.is-room-open .adnn-message-scroll");
    if (openScroller && closeMessageScrollChat(openScroller)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    closeOpenChatThreadPanels();
  };
  document.addEventListener("keydown", escapeCloser, true);
  document.addEventListener("keyup", escapeCloser, true);
  window.addEventListener("keydown", escapeCloser, true);
  window.addEventListener("keyup", escapeCloser, true);
}

function bindMessageScrollEscape(scroller, state) {
  if (!scroller || scroller.dataset.escapeReady === "true") return;
  scroller.dataset.escapeReady = "true";
  scroller.tabIndex = 0;
  scroller.addEventListener("pointerdown", () => scroller.focus({ preventScroll: true }));
  const close = (event) => {
    if (event.key !== "Escape") return;
    if (closeMessageScrollChat(scroller, state?.roomId)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  scroller.addEventListener("keydown", close, true);
  scroller.addEventListener("keyup", close, true);
}

function closeMessageScrollChat(scroller, roomId = "") {
  const layout = scroller?.closest?.(".adnn-chat-layout");
  if (!layout?.classList.contains("is-room-open")) return false;
  layout.classList.remove("is-room-open");
  layout.querySelectorAll(".adnn-thread.is-active").forEach((row) => row.classList.remove("is-active"));
  if (roomId) closeRoomOnMobile(roomId);
  else document.body.classList.remove("adnn-chat-mobile-lock");
  return true;
}

function closeOpenChatThreadPanels() {
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === "function") active.blur();
  document.querySelectorAll(".adnn-chat-layout.is-room-open").forEach((layout) => {
    layout.classList.remove("is-room-open");
    layout.querySelectorAll(".adnn-thread.is-active").forEach((row) => row.classList.remove("is-active"));
  });
  rooms.forEach((state) => {
    const target = document.getElementById(state.roomId);
    const layout = target?.closest(".adnn-chat-layout");
    layout?.classList.remove("is-room-open");
    layout?.querySelectorAll(".adnn-thread.is-active").forEach((row) => row.classList.remove("is-active"));
  });
  document.body.classList.remove("adnn-chat-mobile-lock");
}

function setupSidebarReorder() {
  const applyOrder = (container) => {
    const items = Array.from(container.querySelectorAll(":scope > a[data-view-link], :scope > button[data-view-link], :scope > .sidebar-link-item[data-target-view]"));
    const key = `${NAV_ORDER_STORAGE_KEY}:${location.pathname}:${container.className || container.tagName}`;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) {}
    saved.forEach((id) => {
      const item = items.find((node) => navItemId(node) === id);
      if (item) container.appendChild(item);
    });

    Array.from(container.querySelectorAll(":scope > a[data-view-link], :scope > button[data-view-link], :scope > .sidebar-link-item[data-target-view]")).forEach((item) => {
      if (item.dataset.reorderReady === "true") return;
      item.dataset.reorderReady = "true";
      item.draggable = false;
      item.addEventListener("pointermove", (event) => {
        const rect = item.getBoundingClientRect();
        item.classList.toggle("can-drag", event.clientX - rect.left <= 30);
      });
      item.addEventListener("pointerleave", () => item.classList.remove("can-drag"));
      item.addEventListener("pointerdown", (event) => {
        const rect = item.getBoundingClientRect();
        item.draggable = event.clientX - rect.left <= 30;
      });
      item.addEventListener("dragstart", (event) => {
        if (!item.draggable) return event.preventDefault();
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", navItemId(item));
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging", "can-drag");
        item.draggable = false;
        saveOrder(container, key);
      });
    });

    container.addEventListener("dragover", (event) => {
      const dragging = container.querySelector(".is-dragging");
      if (!dragging) return;
      event.preventDefault();
      const after = getDragAfterElement(container, event.clientY);
      if (after == null) container.appendChild(dragging);
      else container.insertBefore(dragging, after);
    });
    container.addEventListener("drop", () => saveOrder(container, key));
  };

  const run = () => document.querySelectorAll(".side-nav, .sidebar-navigation, .sidebar-bottom-utilities").forEach(applyOrder);
  run();
  window.addEventListener("load", run, { once: true });
}

function navItemId(item) {
  return item.dataset.viewLink || item.dataset.targetView || item.getAttribute("href") || item.id || item.textContent.trim();
}

function saveOrder(container, key) {
  const ids = Array.from(container.querySelectorAll(":scope > a[data-view-link], :scope > button[data-view-link], :scope > .sidebar-link-item[data-target-view]")).map(navItemId);
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch (_) {}
}

function getDragAfterElement(container, y) {
  const items = Array.from(container.querySelectorAll(":scope > a[data-view-link]:not(.is-dragging), :scope > button[data-view-link]:not(.is-dragging), :scope > .sidebar-link-item[data-target-view]:not(.is-dragging)"));
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function closeMessageMenus() {
  document.querySelectorAll(".adnn-message.is-menu-open").forEach((item) => item.classList.remove("is-menu-open"));
  document.querySelectorAll("[data-reaction-palette]").forEach((item) => { item.hidden = true; });
  closeFloatingReactionSheet();
}

function cleanupSession({ keepFirebase = false } = {}) {
  listWatchers.forEach((stop) => stop?.());
  listWatchers.clear();
  incomingCallUnsub?.();
  incomingCallUnsub = null;
  globalThreadBadgeUnsub?.();
  globalThreadBadgeUnsub = null;
  stopOutgoingDialTone();
  stopIncomingRingtone();
  rooms.forEach((state) => cleanupRoomState(state));
  rooms.clear();
  liveSnapshotKeys.forEach((watcher) => watcher.stop?.());
  liveSnapshotKeys.clear();
  globalUnsubs.splice(0).forEach((fn) => fn?.());
  stopPresence();
  if (activeCall) endCall(true);
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
  document.body.classList.remove("adnn-chat-mobile-lock");
  if (!keepFirebase) {
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
  activeProfile = null;
  activeUser = null;
  sessionStarted = false;
}


function confirmDanger(title, message, confirmText = "Confirm") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "adnn-confirm-backdrop";
    overlay.innerHTML = `
      <div class="adnn-confirm-card" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div>
          <button type="button" data-cancel>Cancel</button>
          <button type="button" class="is-danger" data-confirm>${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const done = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector("[data-cancel]")?.addEventListener("click", () => done(false));
    overlay.querySelector("[data-confirm]")?.addEventListener("click", () => done(true));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) done(false); });
    overlay.querySelector("[data-cancel]")?.focus();
  });
}

function showToast(text, tone = "ok") {
  const key = `${tone}:${text}`;
  if (pendingToastKeys.has(key)) return;
  pendingToastKeys.set(key, true);
  const toast = document.createElement("div");
  toast.className = `adnn-chat-toast is-${tone}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
    pendingToastKeys.delete(key);
  }, 3400);
}

function insertAtCursor(textarea, value) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
  textarea.selectionStart = textarea.selectionEnd = start + value.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function autoSizeTextArea(node) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${Math.min(128, node.scrollHeight)}px`;
}

function waveBars(seed = 8) {
  const count = 34;
  const base = Math.max(1, Number(seed) || 8);
  return Array.from({ length: count }, (_, i) => {
    const h = 18 + Math.round(Math.abs(Math.sin((i + 1) * 1.7 + base)) * 30) + (i % 5) * 2;
    return `<span style="--h:${Math.min(58, h)}%"></span>`;
  }).join("");
}

function bestAudioMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function isRetryableError(error) {
  const code = String(error?.code || "");
  return !isPermissionError(error) && [
    "unavailable",
    "deadline-exceeded",
    "aborted",
    "internal",
    "resource-exhausted",
    "storage/retry-limit-exceeded",
    "storage/unknown",
    "storage/canceled"
  ].some((item) => code.includes(item));
}

function isPermissionError(error) {
  const code = String(error?.code || "").toLowerCase();
  return code.includes("permission-denied") || code.includes("unauthenticated") || code.includes("unauthorized") || code.includes("storage/unauthorized");
}

function readableFirebaseError(error) {
  const code = String(error?.code || "").toLowerCase();
  if (code.includes("permission-denied") || code.includes("unauthorized") || code.includes("unauthenticated")) return "Chat access is not available right now.";
  if (code.includes("unavailable")) return "Chat is reconnecting.";
  if (code.includes("storage/quota-exceeded")) return "Upload storage is full.";
  if (code.includes("storage/object-not-found")) return "This file is no longer available.";
  if (code.includes("storage/canceled")) return "Upload canceled.";
  return "Chat connection failed.";
}

function isCallSummaryText(value) {
  const text = String(value || "").toLowerCase();
  return /^incoming (audio|video) call/.test(text) || /^outgoing (audio|video) call/.test(text) || /^call (ended|missed|rejected)/.test(text);
}

function fieldKey(value) {
  const text = String(value || "unknown");
  let out = "u";
  for (const char of text) out += char.codePointAt(0).toString(16).padStart(4, "0");
  return out;
}

function cssAttr(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function emailKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return emailKey(email) === ADMIN_EMAIL;
}

function initials(value) {
  return String(value || "AD").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "AD";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function linkifyText(value) {
  const safe = escapeHtml(value);
  return safe.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return new Date(value).getTime() || 0;
}

function formatTime(value) {
  const time = toMillis(value) || Date.now();
  return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCompactDate(value) {
  const time = toMillis(value);
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dateSeparatorKey(value) {
  const time = toMillis(value);
  return time ? new Date(time).toDateString() : "";
}

function formatDateSeparator(value) {
  const time = toMillis(value);
  if (!time) return "Today";
  const date = new Date(time);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function relativeTime(time) {
  const diff = Math.max(0, Date.now() - time);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.floor(day / 7)}w ago`;
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function fileExt(name) {
  const ext = String(name || "file").split(".").pop().slice(0, 4).toUpperCase();
  return ext || "FILE";
}

function fileKind(file) {
  const type = file.type || "";
  if (type.startsWith("image/")) return "Image";
  if (type.startsWith("video/")) return "Video";
  if (type.startsWith("audio/")) return "Audio";
  if (type.includes("pdf")) return "PDF";
  return "Document";
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[^a-z0-9_.-]/gi, "_").toLowerCase().slice(0, 120) || "file";
}

function makeId(prefix = "id") {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function uniqueClean(values) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



function watchGlobalThreadBadges() {
  globalThreadBadgeUnsub?.();
  globalThreadBadgeUnsub = null;
  if (!db || !activeUser) return;

  const owner = [];
  const sources = new Map();
  let initialSourceCount = 0;
  const hydratedSources = new Set();
  let initialHydrationDone = false;
  const markHydrated = (key) => {
    hydratedSources.add(key);
    if (!initialHydrationDone && hydratedSources.size >= Math.max(1, initialSourceCount)) {
      initialHydrationDone = true;
    }
  };
  const render = (allowNotify = initialHydrationDone) => {
    let chats = Array.from(sources.values()).flatMap((items) => Array.from(items.values()));
    const unique = new Map();
    chats.forEach((chat) => unique.set(chat.id, { ...(unique.get(chat.id) || {}), ...chat }));
    chats = Array.from(unique.values()).filter(isChatVisibleForCurrentUser);
    const scope = isAdminEmail(activeUser?.email) ? 'admin' : 'user';
    if (scope === 'admin') chats = chats.filter(isVisibleToAdminInbox);
    updateChatNavigationBadges(chats, scope);
    if (allowNotify) {
      chats.forEach((chat) => notifyThreadUnread(chat, getChatTitle(chat, scope), getUnreadCount(chat, scope)));
    } else {
      chats.forEach((chat) => {
        const key = `thread:${chat.id}`;
        threadUnreadCache.set(key, getUnreadCount(chat, scope) || 0);
        const lastMs = toMillis(chat.updatedAt || chat.updatedAtMs || chat.createdAt || chat.createdAtMs);
        threadNotifyState.set(key, `${lastMs}:${chat.lastMessage || ""}:${chat.lastSenderUid || ""}:${chat.lastMessageKind || ""}`);
      });
    }
  };
  const listen = (key, refOrQuery) => resilientSnapshot(`globalThreads:${key}`, refOrQuery, (snapshot) => {
    sources.set(key, new Map(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data(), __pending: item.metadata.hasPendingWrites }])));
    const allowNotify = initialHydrationDone;
    render(allowNotify);
    markHydrated(key);
  }, () => {
    const allowNotify = initialHydrationDone;
    render(allowNotify);
    markHydrated(key);
  }, owner);

  const listenSource = (key, refOrQuery) => {
    initialSourceCount += 1;
    listen(key, refOrQuery);
  };
  if (isAdminEmail(activeUser.email)) {
    listenSource('support', query(collection(db, COLLECTIONS.chats), where('type', '==', 'support')));
    listenSource('admin-alias', query(collection(db, COLLECTIONS.chats), where('participantUids', 'array-contains', ADMIN_ALIAS_UID)));
    selfEmailKeyList().forEach((mail, index) => {
      listenSource(`admin-email-${index}`, query(collection(db, COLLECTIONS.chats), where('participantEmailKeys', 'array-contains', mail)));
    });
  } else {
    Array.from(selfUidSet()).forEach((uid, index) => {
      listenSource(`participant-${index}`, query(collection(db, COLLECTIONS.chats), where('participantUids', 'array-contains', uid)));
    });
    selfEmailKeyList().forEach((mail, index) => {
      listenSource(`participant-email-${index}`, query(collection(db, COLLECTIONS.chats), where('participantEmailKeys', 'array-contains', mail)));
    });
  }
  globalThreadBadgeUnsub = () => owner.forEach((fn) => fn?.());
  globalUnsubs.push(() => globalThreadBadgeUnsub?.());
}

function assetUrl(fileName) {
  const clean = String(fileName || '').trim();
  if (!clean) return '';
  try { return new URL(clean, location.href).href; } catch (_) { return clean; }
}


function enforceSilentSoundMigration() {
  try {
    // Older builds could leave adnn_message_sounds=true in localStorage.
    // Do not allow that old value to keep playing refresh/live notification sounds.
    if (localStorage.getItem(CHAT_SOUND_CONFIRMED_KEY) !== "true") {
      localStorage.setItem(CHAT_SOUND_KEY, "false");
    }
  } catch (_) {}
}

function installSilentAudioGuard() {
  if (window.__adnnSilentAudioGuardInstalled) return;
  window.__adnnSilentAudioGuardInstalled = true;
  const shouldBlock = () => {
    try {
      return localStorage.getItem(CHAT_SOUND_KEY) !== "true" || localStorage.getItem(CHAT_SOUND_CONFIRMED_KEY) !== "true";
    } catch (_) {
      return true;
    }
  };
  try {
    const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto && proto.play && !proto.__adnnOriginalPlay) {
      proto.__adnnOriginalPlay = proto.play;
      proto.play = function guardedPlay() {
        const src = String(this.currentSrc || this.src || "").toLowerCase();
        const looksLikeNotificationTone = /message|notification|ring|ringer|tone|call/.test(src);
        if (looksLikeNotificationTone && shouldBlock()) {
          try { this.pause?.(); this.currentTime = 0; } catch (_) {}
          return Promise.resolve();
        }
        return proto.__adnnOriginalPlay.apply(this, arguments);
      };
    }
  } catch (_) {}
}

function hasConfirmedSoundOptIn() {
  try {
    return localStorage.getItem(CHAT_SOUND_CONFIRMED_KEY) === "true" && localStorage.getItem(CHAT_SOUND_KEY) === "true";
  } catch (_) {
    return false;
  }
}

function isRefreshAudioMuteWindow() {
  return Date.now() - CHAT_PAGE_LOAD_AT_MS < CHAT_REFRESH_AUDIO_MUTE_MS;
}

function canPlayChatSound() {
  if (!hasConfirmedSoundOptIn()) return false;
  if (isRefreshAudioMuteWindow()) return false;
  if (Date.now() < chatAudioReadyAtMs || Date.now() < notificationsReadyAtMs) return false;
  if (!chatAudioUnlockedThisSession) return false;
  return true;
}

function hasFreshUserActivation() {
  try {
    const activation = navigator.userActivation;
    return !!(activation && (activation.isActive || activation.hasBeenActive));
  } catch (_) {
    return false;
  }
}

function unlockChatAudioForSession() {
  chatAudioUnlockedThisSession = true;
  chatAudioReadyAtMs = Math.min(chatAudioReadyAtMs, Date.now() + 250);
}

['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, unlockChatAudioForSession, { once: true, passive: true });
});

function createLoopingAudio(fileName, volume = 0.62) {
  if (!canPlayChatSound()) return null;
  const url = assetUrl(fileName);
  if (!url) return null;
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = volume;
  return audio;
}

function playOneShotAudio(fileName, fallbackTone = 'message') {
  if (!canPlayChatSound()) return;
  const now = Date.now();
  if (now - lastSoundAtMs < 220) return;
  lastSoundAtMs = now;
  const url = assetUrl(fileName);
  if (!url) return playSynthTone(fallbackTone);
  try {
    const audio = new Audio(url);
    audio.volume = fallbackTone === 'missed' ? 0.72 : 0.58;
    const play = audio.play();
    if (play?.catch) play.catch(() => playSynthTone(fallbackTone));
  } catch (_) {
    playSynthTone(fallbackTone);
  }
}

function startOutgoingDialTone() {
  if (!canPlayChatSound()) return;
  stopOutgoingDialTone();
  outgoingDialAudio = createLoopingAudio(CHAT_CONFIG.outgoingCallToneFile, 0.58);
  outgoingDialAudio?.play?.().catch(() => {});
}

function stopOutgoingDialTone() {
  try { outgoingDialAudio?.pause?.(); if (outgoingDialAudio) outgoingDialAudio.currentTime = 0; } catch (_) {}
  outgoingDialAudio = null;
}

function startIncomingRingtone() {
  if (!canPlayChatSound()) return;
  stopIncomingRingtone();
  incomingRingAudio = createLoopingAudio(CHAT_CONFIG.incomingCallToneFile, 0.72);
  incomingRingAudio?.play?.().catch(() => {});
}

function stopIncomingRingtone() {
  try { incomingRingAudio?.pause?.(); if (incomingRingAudio) incomingRingAudio.currentTime = 0; } catch (_) {}
  incomingRingAudio = null;
}

function playSynthTone(tone = 'message') {
  if (!canPlayChatSound()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = tone === 'missed' ? 330 : 540;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close?.(), 260);
  } catch (_) {}
}

function bindNotificationPermissionPrimer() {
  notificationPermissionAsked = true;
}


function chatReduceMotionEnabled() {
  return chatSettingBool(CHAT_REDUCE_MOTION_KEY, false) || document.documentElement.classList.contains('adnn-reduce-motion');
}

function chatSettingBool(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return !!fallback;
    return raw === "true" || raw === "1" || raw === "yes";
  } catch (_) {
    return !!fallback;
  }
}

function syncChatSettingsFromStorage() {
  const root = document.documentElement;
  root.classList.toggle("adnn-chat-light", chatSettingBool(CHAT_THEME_STORAGE_KEY, false));
  root.classList.toggle("adnn-reduce-motion", chatSettingBool(CHAT_REDUCE_MOTION_KEY, false));
  root.classList.toggle("adnn-silent-mode", !hasConfirmedSoundOptIn());
  if (!hasConfirmedSoundOptIn()) {
    stopIncomingRingtone();
    stopOutgoingDialTone();
  }
}

function bindChatSettingsEvents() {
  if (chatSettingsEventsBound) return;
  chatSettingsEventsBound = true;
  const sync = () => { syncChatSettingsFromStorage(); if (!hasConfirmedSoundOptIn()) { stopIncomingRingtone(); stopOutgoingDialTone(); } };
  window.addEventListener("storage", sync);
  window.addEventListener("adnn-settings-changed", sync);
}

function notifyBrowser(title, body, icon = "") {
  return;
}


function showInAppNotification(title, body, options = {}) {
  document.getElementById("adnnInAppNotificationStack")?.remove();
  return;
}


function playNotificationTone(tone = "message") {
  return;
}


function updateBadgeNode(node, value) {
  if (!node) return;
  node.classList?.add("side-notification-badge");
  const safe = Math.max(0, Number(value) || 0);
  node.textContent = String(safe > 99 ? "99+" : safe);
  node.hidden = safe <= 0;
  node.style.display = safe > 0 ? "grid" : "none";
}

function ensureSidebarBadges() {
  document.querySelectorAll(".side-nav a, .side-nav button, .sidebar-link-item, .account-popover button").forEach((item) => {
    if (item.querySelector(".side-notification-badge")) return;
    const badge = document.createElement("span");
    badge.className = "side-notification-badge";
    badge.hidden = true;
    badge.textContent = "0";
    item.appendChild(badge);
  });
}

function updateChatNavigationBadges(chats = [], scope = "user") {
  const counts = { chat: 0, support: 0, admin: 0 };
  chats.forEach((chat) => {
    const unread = getUnreadCount(chat, scope);
    if (chat.type === "support") counts.support += unread;
    else counts.chat += unread;
    counts.admin += unread;
  });
  const total = counts.chat + counts.support;
  document.querySelectorAll('[data-account-badge="chat"]').forEach((node) => updateBadgeNode(node, counts.chat));
  document.querySelectorAll('[data-account-badge="support"]').forEach((node) => updateBadgeNode(node, counts.support));
  document.querySelectorAll('[data-admin-chat-badge]').forEach((node) => updateBadgeNode(node, counts.admin));
  document.querySelectorAll('[data-target-view="chats_view"] .side-notification-badge, [data-view-link="chat"] .side-notification-badge, [data-view-link="admin-support"] .side-notification-badge').forEach((node) => updateBadgeNode(node, total));
  document.querySelectorAll('.adnn-chat-count').forEach((node) => updateBadgeNode(node, total));
  ensureSidebarBadges();
  document.querySelectorAll('[data-section="chat"] .side-notification-badge, [data-view="chat"] .side-notification-badge, a[href*="chat"] .side-notification-badge').forEach((node) => updateBadgeNode(node, total));
  try { localStorage.setItem(CHAT_TOTAL_UNREAD_STORAGE_KEY, String(total)); } catch (_) {}
}

function notifyThreadUnread(chat, title, unread) {
  const key = `thread:${chat.id}`;
  const previousUnread = threadUnreadCache.get(key);
  threadUnreadCache.set(key, unread || 0);

  const lastMs = toMillis(chat.updatedAt || chat.updatedAtMs || chat.createdAt || chat.createdAtMs);
  const sig = `${lastMs}:${chat.lastMessage || ""}:${chat.lastSenderUid || ""}:${chat.lastMessageKind || ""}`;
  const previousSig = threadNotifyState.get(key);
  threadNotifyState.set(key, sig);

  if (Date.now() < notificationsReadyAtMs) return;
  if (previousUnread === undefined && previousSig === undefined) return;
  const unreadIncreased = unread && (previousUnread === undefined || unread > previousUnread);
  const messageChanged = previousSig && sig !== previousSig;
  if (!unreadIncreased && !messageChanged) return;
  if (selfUidSet().has(chat.lastSenderUid) || selfUidSet().has(chat.lastSenderAliasUid)) return;

  const body = normalizeLastMessage(chat);
  const tone = chat.lastMessageKind === "call" && /missed/i.test(body) ? "missed" : "message";
  showInAppNotification(title, body, {
    tone,
    count: unread || 1,
    icon: getChatPhoto(chat, isAdminEmail(activeUser?.email) ? "admin" : "user"),
    href: location.pathname.includes("designer-account.html") ? "designer-account.html#chat" : location.pathname.includes("admin.html") ? "admin.html#chats_view" : "account.html#chat"
  });
  notifyBrowser(title, body, getChatPhoto(chat, isAdminEmail(activeUser?.email) ? "admin" : "user"));
}

function notifyIncomingMessages(state, messages) {
  if (!state || !Array.isArray(messages)) return;
  const visible = messages.filter((msg) => shouldShowMessage(msg));
  if (!state.messagesHydrated) {
    visible.forEach((msg) => state.notifiedMessageIds.add(msg.id));
    state.messagesHydrated = true;
    return;
  }
  if (Date.now() < notificationsReadyAtMs || Date.now() < (state.suppressNotifyUntilMs || 0)) {
    visible.forEach((msg) => state.notifiedMessageIds.add(msg.id));
    return;
  }
  visible.forEach((msg) => {
    if (state.notifiedMessageIds.has(msg.id)) return;
    state.notifiedMessageIds.add(msg.id);
    if (isMineMessage(msg)) return;
    const title = msg.senderName || getChatTitle(state.chatData, isAdminEmail(activeUser?.email) ? "admin" : "user");
    const body = isCallEventMessage(msg) ? callSummaryLastMessage(msg) : (msg.text || attachmentSummary(msg.attachments || []) || "New message");
    const tone = isCallEventMessage(msg) && (msg.callStatus === "missed" || msg.endedReason === "timeout") ? "missed" : "message";
    showInAppNotification(title, body, {
      tone,
      icon: getChatPhoto(state.chatData, isAdminEmail(activeUser?.email) ? "admin" : "user"),
      href: location.pathname.includes("designer-account.html") ? "designer-account.html#chat" : location.pathname.includes("admin.html") ? "admin.html#chats_view" : "account.html#chat"
    });
    notifyBrowser(title, body, getChatPhoto(state.chatData, isAdminEmail(activeUser?.email) ? "admin" : "user"));
  });
}

function revokeObjectUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(url);
}

function connectionStateText(state) {
  if (state === "connected") return "Connected";
  if (state === "connecting") return "Connecting...";
  if (state === "disconnected") return "Reconnecting...";
  if (state === "failed") return "Connection failed";
  if (state === "closed") return "Call ended";
  return "Connecting...";
}


async function getPresenceInfo(uid) {
  if (!uid || !db) return { online: false, seen: 0, data: {} };
  const snap = await getDoc(doc(db, COLLECTIONS.presence, uid)).catch(() => null);
  const data = snap?.exists() ? snap.data() : {};
  const seen = toMillis(data.lastSeen || data.updatedAt || data.lastActiveAt);
  const online = data.online !== false && !!seen && Date.now() - seen < CHAT_CONFIG.presenceOnlineMs;
  return { online, seen, data };
}

function placeCallPopout(node) {
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const width = rect.width || Math.min(420, window.innerWidth - 20);
  const height = rect.height || 420;
  const left = clamp(window.innerWidth - width - 24, 10, Math.max(10, window.innerWidth - width - 10));
  const top = clamp(76, 10, Math.max(10, window.innerHeight - height - 10));
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function makeDraggable(node, handle) {
  if (!node || !handle) return;
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let dragging = false;
  const move = (event) => {
    if (!dragging) return;
    const rect = node.getBoundingClientRect();
    const x = clamp(baseX + event.clientX - startX, 8, window.innerWidth - rect.width - 8);
    const y = clamp(baseY + event.clientY - startY, 8, window.innerHeight - rect.height - 8);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  };
  const up = () => {
    dragging = false;
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    dragging = true;
    const rect = node.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    baseX = rect.left;
    baseY = rect.top;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function deepMerge(base, overrides) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Element)) {
      out[key] = deepMerge(out[key] || {}, value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

function injectChatStyles() {
  if (document.getElementById("adnnChatRuntimeStylesV2")) return;
  const t = CHAT_CONFIG.theme;
  const style = document.createElement("style");
  style.id = "adnnChatRuntimeStylesV2";
  style.textContent = `
    :root { --adnn-primary:${t.primary}; --adnn-primary2:${t.primary2}; --adnn-danger:${t.danger}; --adnn-success:${t.success}; }
    .adnn-chat-app, .adnn-chat-app * { box-sizing:border-box; }
    .adnn-chat-app [hidden], .adnn-call-popout [hidden], .adnn-confirm-backdrop [hidden] { display:none !important; }
    #directChatMount, #clientChatMount, #adminChatMount { width:100% !important; height:100% !important; min-height:0 !important; max-height:none !important; margin:0 !important; overflow:hidden !important; background:transparent !important; box-shadow:none !important; }
    #clientChatMount.adnn-designer-chat-panel { display:block !important; height:100% !important; min-height:0 !important; border:0 !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
    .adnn-chat-app { --adnn-primary:${t.primary}; --adnn-primary2:${t.primary2}; --adnn-danger:${t.danger}; --adnn-success:${t.success}; --adnn-bg:${t.bg}; --adnn-panel:${t.panel}; --adnn-soft:${t.soft}; --adnn-line:${t.line}; --adnn-text:${t.text}; --adnn-muted:${t.muted}; width:100%; height:100%; min-height:0; color:var(--adnn-text); font:inherit; display:block; overflow:hidden; }
    .adnn-chat-shell { width:100%; height:100%; min-width:0; min-height:0; display:grid; gap:0; overflow:hidden; }
    body.chat-view-active .adnn-chat-app, body.chat-view-active .adnn-chat-shell, body.chat-view-active .adnn-chat-layout { height:100% !important; min-height:0 !important; }
    .adnn-chat-outerbar { min-height:52px; display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--adnn-line); border-radius:20px; background:linear-gradient(145deg, rgba(22,22,28,.88), rgba(4,4,7,.92)); position:relative; box-shadow:0 16px 50px rgba(0,0,0,.22); }
    .adnn-outer-title { flex:1; min-width:0; display:grid; gap:2px; }
    .adnn-outer-title strong, .adnn-outer-title span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-outer-title strong { font-size:14px; font-weight:650; letter-spacing:-.02em; }
    .adnn-outer-title span { font-size:12px; color:var(--adnn-muted); }
    .adnn-outer-title span[data-tone="ok"] { color:var(--adnn-success); }
    .adnn-outer-title span[data-tone="bad"] { color:#ff7a69; }
    .adnn-outer-btn { width:40px; height:40px; border:0; border-radius:14px; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.07); cursor:pointer; transition:.18s ease; flex:0 0 auto; }
    .adnn-outer-btn:hover { background:rgba(255,255,255,.12); transform:translateY(-1px); }
    .adnn-outer-btn svg { width:19px; height:19px; }
    .adnn-outer-menu, .adnn-room-menu { position:absolute; right:10px; top:calc(100% + 8px); min-width:210px; z-index:220; padding:8px; border:1px solid rgba(255,255,255,.12); border-radius:18px; background:rgba(8,8,12,.98); box-shadow:0 24px 80px rgba(0,0,0,.46); backdrop-filter:blur(18px); }
    .adnn-outer-menu button, .adnn-room-menu button { width:100%; border:0; border-radius:12px; padding:10px 11px; display:flex; color:#fff; background:transparent; cursor:pointer; text-align:left; }
    .adnn-outer-menu button:hover, .adnn-room-menu button:hover { background:rgba(255,255,255,.08); }
    .adnn-room-menu .is-danger { color:#ff6b5c; }
    .adnn-room-shell.is-blocked-by-me .adnn-composer textarea::placeholder { color:#ffc66d; }
    .adnn-room-shell.is-blocked-by-me .adnn-composer::after, .adnn-room-shell.is-blocked-by-remote .adnn-composer::after { content:"Chat blocked"; position:absolute; left:72px; bottom:100%; margin-bottom:6px; padding:5px 9px; border-radius:999px; background:rgba(255,198,109,.12); color:#ffc66d; font-size:11px; pointer-events:none; }
    .adnn-outer-menu small { display:block; padding:8px 10px 4px; color:var(--adnn-muted); }
    .adnn-chat-layout { width:100%; height:100%; min-height:0; display:grid; grid-template-columns:minmax(300px, 390px) minmax(0,1fr); grid-template-rows:minmax(0,1fr); overflow:hidden; border:1px solid var(--adnn-line); border-radius:26px; background:linear-gradient(145deg, rgba(22,22,28,.94), rgba(4,4,7,.98)); box-shadow:0 24px 90px rgba(0,0,0,.34); }
    .adnn-chat-layout.is-single { grid-template-columns:1fr; }
    .adnn-chat-layout > .adnn-chat-thread-panel { grid-column:1; grid-row:1; }
    .adnn-chat-layout > .adnn-chat-room { grid-column:2; grid-row:1; }
    .adnn-chat-layout.is-single > .adnn-chat-room { grid-column:1 / -1; }
    .adnn-chat-thread-panel { min-width:0; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); border-right:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); overflow:hidden; }
    .adnn-chat-thread-head { min-height:82px; padding:14px; display:grid; gap:10px; align-content:center; border-bottom:1px solid rgba(255,255,255,.07); }
    .adnn-chat-thread-head strong { display:block; font-size:16px; font-weight:650; letter-spacing:-.02em; }
    .adnn-chat-thread-head small { display:block; color:var(--adnn-muted); font-size:12px; margin-top:2px; }
    .adnn-chat-search { height:38px; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.08); border-radius:15px; background:#050507; color:var(--adnn-muted); padding:0 11px; }
    .adnn-chat-search svg { width:16px; height:16px; flex:0 0 auto; }
    .adnn-chat-search input { flex:1; min-width:0; border:0; outline:0; color:#fff; background:transparent; font:inherit; font-size:13px; }
    .adnn-chat-thread-list { min-height:0; overflow:auto; padding:10px; scrollbar-width:thin; }
    .adnn-thread { width:100%; min-width:0; border:0; border-radius:18px; padding:12px; display:grid; grid-template-columns:46px minmax(0,1fr) auto; align-items:center; gap:12px; background:transparent; color:#fff; text-align:left; cursor:pointer; transition:.2s ease; }
    .adnn-thread:hover, .adnn-thread.is-active { background:rgba(39,45,207,.18); }
    .adnn-thread-copy { min-width:0; display:grid; gap:4px; }
    .adnn-thread-copy strong, .adnn-thread-copy small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-thread-copy strong { font-size:14px; font-weight:550; }
    .adnn-thread-copy small { color:rgba(255,255,255,.48); font-size:12px; }
    .adnn-thread-side { display:grid; gap:6px; justify-items:end; align-items:center; }
    .adnn-thread-side time { color:rgba(255,255,255,.38); font-size:10px; }
    .adnn-thread-side b { min-width:19px; height:19px; padding:0 5px; border-radius:999px; display:grid; place-items:center; background:var(--adnn-danger); color:#fff; font-size:10px; }
    .adnn-avatar { width:44px; height:44px; border-radius:16px; display:grid; place-items:center; background:linear-gradient(145deg,var(--adnn-primary),var(--adnn-primary2)); color:#fff; font-size:12px; font-weight:700; flex:0 0 auto; box-shadow:inset 0 1px 0 rgba(255,255,255,.18); position:relative; overflow:hidden; }
    .adnn-avatar img { width:100%; height:100%; object-fit:cover; display:block; border-radius:inherit; }
    .adnn-avatar.is-pending:after { content:""; position:absolute; right:-1px; bottom:-1px; width:12px; height:12px; border:2px solid #0b0b10; border-radius:50%; background:#f1c40f; }
    .adnn-chat-room { min-width:0; min-height:0; width:100%; height:100%; position:relative; overflow:hidden; isolation:isolate; }
    .adnn-chat-welcome { display:none !important; }
    .adnn-chat-empty { height:100%; min-height:140px; display:grid; place-items:center; align-content:center; gap:8px; text-align:center; color:rgba(255,255,255,.48); padding:24px; }
    .adnn-room-shell { position:absolute !important; inset:0 !important; height:100% !important; min-height:0 !important; max-height:100% !important; overflow:hidden !important; background:radial-gradient(circle at 92% 6%, rgba(39,45,207,.17), transparent 32%), var(--adnn-bg); --head:72px; --composer:76px; }
    .adnn-room-head { position:absolute !important; top:0 !important; left:0 !important; right:0 !important; width:100% !important; height:var(--head) !important; min-height:var(--head) !important; display:flex !important; align-items:center !important; gap:10px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(10,10,14,.95); backdrop-filter:blur(18px); z-index:95 !important; }
    .adnn-back-btn, .adnn-call-btn, .adnn-attach-btn, .adnn-voice-btn, .adnn-send-btn, .adnn-plus-btn, .adnn-emoji-btn { width:42px; height:42px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.07); cursor:pointer; transition:.18s ease; flex:0 0 auto; }
    .adnn-back-btn { display:none; }
    .adnn-call-btn:hover, .adnn-attach-btn:hover, .adnn-voice-btn:hover, .adnn-plus-btn:hover, .adnn-emoji-btn:hover, .adnn-send-btn:hover { background:rgba(255,255,255,.13); transform:translateY(-2px) scale(1.045); box-shadow:0 10px 28px rgba(39,45,207,.22); }
    .adnn-call-btn:active, .adnn-attach-btn:active, .adnn-voice-btn:active, .adnn-plus-btn:active, .adnn-emoji-btn:active, .adnn-send-btn:active, .adnn-room-menu button:active, .adnn-message-actions button:active { transform:scale(.88); transition:.08s cubic-bezier(.2,.9,.2,1.25); }
    .adnn-back-btn svg, .adnn-call-btn svg, .adnn-attach-btn svg, .adnn-voice-btn svg, .adnn-send-btn svg, .adnn-plus-btn svg, .adnn-emoji-btn svg { width:19px; height:19px; }
    .adnn-room-title { flex:1; min-width:0; display:grid; gap:2px; }
    .adnn-room-title strong, .adnn-room-title small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-room-title strong { font-size:15px; font-weight:650; }
    .adnn-room-title small { font-size:12px; color:rgba(255,255,255,.5); }
    .adnn-room-title small.is-online { color:var(--adnn-success); }
    .adnn-room-actions { display:flex; align-items:center; gap:7px; flex:0 0 auto; }
    .adnn-room-searchbar { position:absolute; top:var(--head); left:0; right:0; height:52px; padding:8px 14px; display:flex; gap:8px; background:rgba(6,6,9,.96); border-bottom:1px solid rgba(255,255,255,.08); z-index:90; }
    .adnn-room-searchbar input { flex:1; border:1px solid rgba(255,255,255,.1); border-radius:14px; background:#020203; color:#fff; padding:0 12px; outline:0; }
    .adnn-room-searchbar button { width:36px; border:0; border-radius:12px; background:rgba(255,255,255,.08); color:#fff; display:grid; place-items:center; }
    .adnn-message-scroll { position:absolute !important; top:var(--head) !important; left:0 !important; right:0 !important; bottom:var(--composer) !important; min-height:0 !important; overflow-y:auto !important; overflow-x:hidden !important; padding:18px; display:flex !important; flex-direction:column; gap:10px; scroll-behavior:smooth; z-index:1; }
    .adnn-room-searchbar:not([hidden]) + .adnn-message-scroll { top:calc(var(--head) + 52px) !important; }
    .adnn-date-separator { align-self:center; position:relative; z-index:1; padding:5px 10px; border-radius:999px; background:rgba(255,255,255,.08); color:rgba(255,255,255,.62); font-size:11px; backdrop-filter:blur(10px); flex:0 0 auto; }
    .adnn-date-track { position:sticky; top:8px; align-self:center; z-index:35; padding:6px 12px; border-radius:999px; background:rgba(18,18,22,.78); color:#fff; font-size:11px; backdrop-filter:blur(18px); box-shadow:0 12px 35px rgba(0,0,0,.28); pointer-events:none; }
    .adnn-message-row { display:flex; width:100%; }
    .adnn-message-row.is-mine { justify-content:flex-end; }
    .adnn-message-row.is-peer { justify-content:flex-start; }
    .adnn-message { max-width:min(70%, 600px); position:relative; padding:10px 12px 8px; border-radius:18px; color:#fff; background:rgba(255,255,255,.075); border:1px solid rgba(255,255,255,.06); box-shadow:0 12px 28px rgba(0,0,0,.16); outline:0; }
    .adnn-message.is-reply-jump { animation:adnnReplyJump 1.25s ease; }
    @keyframes adnnReplyJump { 0%,100%{ box-shadow:0 12px 28px rgba(0,0,0,.16); } 35%{ box-shadow:0 0 0 3px rgba(141,150,255,.42), 0 16px 45px rgba(39,45,207,.28); } }
    .adnn-message.is-search-hit { box-shadow:0 0 0 2px rgba(255,255,255,.28), 0 12px 28px rgba(0,0,0,.2); }
    .is-mine .adnn-message { background:linear-gradient(145deg,var(--adnn-primary),var(--adnn-primary2)); border-color:rgba(255,255,255,.12); border-bottom-right-radius:5px; }
    .is-peer .adnn-message { border-bottom-left-radius:5px; }
    .adnn-message p { margin:0; line-height:1.45; font-size:14px; word-break:break-word; white-space:pre-wrap; }
    .adnn-message p a { color:#fff; text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .adnn-deleted-message { color:rgba(255,255,255,.56); font-style:italic; }
    .adnn-message-name { display:block; margin-bottom:4px; color:#b5baff; font-size:12px; font-weight:600; }
    .adnn-message-meta { display:flex; align-items:center; justify-content:flex-end; gap:5px; margin-top:5px; color:rgba(255,255,255,.46); font-size:10px; }
    .adnn-ticks { width:18px; height:14px; display:inline-grid; place-items:center; color:rgba(255,255,255,.55); }
    .adnn-ticks svg { width:16px; height:16px; }
    .adnn-ticks.is-read { color:#63c6ff; }
    .adnn-ticks.is-pending { color:rgba(255,255,255,.45); }
    .adnn-message-actions { position:absolute; top:50%; display:flex; align-items:center; gap:4px; padding:5px; border-radius:15px; border:1px solid rgba(255,255,255,.12); background:rgba(9,9,12,.97); opacity:0; pointer-events:none; transform:translateY(-50%) scale(.96); transition:.18s ease; z-index:35; box-shadow:0 18px 50px rgba(0,0,0,.35); }
    .is-mine .adnn-message-actions { right:calc(100% + 8px); }
    .is-peer .adnn-message-actions { left:calc(100% + 8px); }
    .adnn-message::before { content:""; position:absolute; top:-8px; bottom:-8px; width:22px; pointer-events:auto; }
    .is-mine .adnn-message::before { right:100%; }
    .is-peer .adnn-message::before { left:100%; }
    .adnn-message .adnn-message-actions { transition:opacity .18s ease .32s, transform .18s ease .32s; }
    .adnn-message:hover .adnn-message-actions, .adnn-message:focus-within .adnn-message-actions, .adnn-message.is-menu-open .adnn-message-actions { opacity:1; pointer-events:auto; transform:translateY(-50%) scale(1); transition-delay:0s; }
    .adnn-message-actions button { min-width:36px; min-height:34px; border:0; border-radius:12px; background:rgba(255,255,255,.07); color:#fff; padding:7px 8px; font-size:12px; cursor:pointer; display:grid; place-items:center; gap:2px; }
    .adnn-message-actions button svg { width:16px; height:16px; }
    .adnn-message-actions button span { font-size:9px; line-height:1; }
    .adnn-message-actions .is-danger { color:#ff6b5c; }
    .adnn-message-actions .is-warn { color:#ffc66d; }
    .adnn-reaction-palette { display:none !important; }
    .adnn-floating-reaction-sheet { position:fixed; z-index:2147483620; display:flex; gap:5px; max-width:calc(100vw - 16px); overflow-x:auto; padding:7px; border-radius:999px; background:rgba(8,8,12,.98); border:1px solid rgba(255,255,255,.14); box-shadow:0 18px 50px rgba(0,0,0,.42); backdrop-filter:blur(18px); }
    .adnn-floating-reaction-sheet button { width:36px; height:36px; border:0; border-radius:50%; background:rgba(255,255,255,.08); font-size:19px; cursor:pointer; flex:0 0 auto; }
    .adnn-reactions { position:absolute; right:10px; bottom:-15px; border:1px solid rgba(255,255,255,.1); border-radius:999px; background:#09090c; color:#fff; padding:2px 7px; font-size:12px; cursor:pointer; display:flex; gap:4px; align-items:center; }
    .adnn-reactions small { font-size:9px; opacity:.7; }
    .adnn-reply-preview, .adnn-reply-bar { display:grid; grid-template-columns:3px minmax(0,1fr) auto; gap:8px; align-items:center; margin-bottom:7px; border-radius:12px; background:rgba(0,0,0,.24); padding:8px; border:0; color:#fff; text-align:left; width:100%; }
    .adnn-reply-preview:before, .adnn-reply-bar:before { content:""; width:3px; height:100%; border-radius:4px; background:#8d96ff; }
    .adnn-reply-preview strong, .adnn-reply-bar strong { display:block; font-size:12px; color:#c1c5ff; }
    .adnn-reply-preview small, .adnn-reply-bar small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:rgba(255,255,255,.55); font-size:11px; }
    .adnn-attachment-img img { display:block; width:min(340px, 100%); max-height:290px; object-fit:cover; border-radius:14px; margin-bottom:7px; }
    .adnn-video-bubble { margin-bottom:7px; display:grid; gap:5px; }
    .adnn-video-bubble video { width:min(360px, 100%); max-height:320px; border-radius:14px; background:#000; display:block; }
    .adnn-video-bubble small { color:rgba(255,255,255,.55); font-size:11px; }
    .adnn-doc-bubble { display:grid; grid-template-columns:42px minmax(0,1fr) auto; align-items:center; gap:10px; min-width:min(280px, 72vw); text-decoration:none; color:#fff; padding:10px; border-radius:14px; background:rgba(0,0,0,.22); margin-bottom:7px; }
    .adnn-doc-bubble span { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:var(--adnn-primary); font-size:11px; }
    .adnn-doc-bubble strong, .adnn-doc-bubble small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-doc-bubble small { color:rgba(255,255,255,.52); font-size:11px; }
    .adnn-doc-bubble svg { width:16px; height:16px; opacity:.75; }
    .adnn-voice-bubble { min-width:min(285px, 76vw); display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:999px; background:rgba(0,0,0,.22); margin-bottom:7px; }
    .adnn-voice-bubble button { width:30px; height:30px; border:0; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.12); color:#fff; flex:0 0 auto; cursor:pointer; }
    .adnn-voice-bubble button svg { width:15px; height:15px; }
    .adnn-voice-wave { flex:1; min-width:110px; height:34px; display:flex; align-items:center; gap:2px; }
    .adnn-voice-wave span { width:3px; height:var(--h); min-height:5px; max-height:24px; border-radius:999px; background:linear-gradient(180deg, rgba(255,255,255,.95), rgba(141,150,255,.6)); opacity:.95; }
    .adnn-voice-bubble audio { width:0; max-width:0; height:0; }
    .adnn-voice-bubble small { color:rgba(255,255,255,.55); font-size:11px; }
    .adnn-composer-wrap { position:absolute !important; left:0 !important; right:0 !important; bottom:0 !important; min-height:var(--composer) !important; z-index:92 !important; border-top:1px solid rgba(255,255,255,.08); background:rgba(8,8,12,.97); padding:10px; box-shadow:0 -18px 45px rgba(0,0,0,.24); visibility:visible !important; opacity:1 !important; transform:none !important; }
    .adnn-connection-strip { display:none !important; }
    .adnn-composer { position:relative; display:flex; align-items:flex-end; gap:8px; }
    .adnn-composer textarea { flex:1; min-height:42px; max-height:128px; resize:none; border:1px solid rgba(255,255,255,.09); border-radius:22px; background:#020203; color:#fff; outline:0; padding:12px 15px; font:inherit; font-size:14px; line-height:1.35; }
    .adnn-attach-btn input, .adnn-composer-panel input { display:none; }
    .adnn-send-btn { background:var(--adnn-primary); }
    .adnn-voice-btn.is-recording { width:auto; padding:0 14px; border-radius:22px; background:var(--adnn-danger); display:flex; gap:8px; }
    .adnn-rec-dot { width:8px; height:8px; border-radius:50%; background:#fff; animation:adnnPulse 1s infinite; }
    @keyframes adnnPulse { 50% { opacity:.3; transform:scale(.72); } }
    .adnn-typing-line { min-height:24px; display:flex; align-items:center; gap:4px; color:#8d96ff; font-size:12px; padding:0 4px 5px; }
    .adnn-typing-line span { width:5px; height:5px; border-radius:50%; background:#8d96ff; animation:adnnTyping 1.1s infinite; }
    .adnn-typing-line span:nth-child(2) { animation-delay:.15s; }
    .adnn-typing-line span:nth-child(3) { animation-delay:.3s; margin-right:5px; }
    @keyframes adnnTyping { 50% { transform:translateY(-4px); opacity:.45; } }
    .adnn-file-preview { display:flex; gap:8px; overflow:auto; padding:0 0 8px; scrollbar-width:thin; }
    .adnn-file-chip { min-width:205px; max-width:270px; display:grid; grid-template-columns:46px minmax(0,1fr) 28px; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:8px; background:rgba(255,255,255,.045); }
    .adnn-file-chip img, .adnn-file-chip video, .adnn-file-chip > span { width:46px; height:46px; border-radius:12px; object-fit:cover; background:var(--adnn-primary); display:grid; place-items:center; font-size:10px; color:#fff; }
    .adnn-file-chip strong, .adnn-file-chip small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-file-chip strong { font-size:12px; }
    .adnn-file-chip small { color:rgba(255,255,255,.5); font-size:11px; }
    .adnn-file-chip i, .adnn-voice-preview i { display:block; height:3px; width:100%; border-radius:999px; background:rgba(255,255,255,.12); margin-top:5px; overflow:hidden; position:relative; }
    .adnn-file-chip i:before, .adnn-voice-preview i:before { content:""; position:absolute; inset:0 auto 0 0; width:var(--p); background:var(--adnn-success); border-radius:inherit; }
    .adnn-file-chip button, .adnn-reply-bar button, .adnn-voice-preview button { width:28px; height:28px; border-radius:50%; border:0; background:rgba(255,255,255,.08); color:#fff; display:grid; place-items:center; cursor:pointer; }
    .adnn-file-chip button svg, .adnn-reply-bar button svg, .adnn-voice-preview button svg { width:14px; height:14px; }
    .adnn-voice-preview { display:flex; align-items:center; gap:10px; padding:0 0 8px; color:#fff; }
    .adnn-voice-preview .adnn-voice-wave { max-width:260px; }
    .adnn-voice-preview-icon { width:34px; height:34px; border:0; border-radius:50%; display:grid; place-items:center; background:var(--adnn-primary); color:#fff; flex:0 0 auto; cursor:pointer; }
    .adnn-voice-preview-icon svg { width:16px; height:16px; }
    .adnn-voice-preview audio { height:34px; max-width:260px; }
    .adnn-composer-panel, .adnn-emoji-panel { position:absolute; left:10px; right:10px; bottom:calc(100% - 3px); padding:10px; border:1px solid rgba(255,255,255,.1); border-radius:20px; background:rgba(8,8,12,.98); box-shadow:0 -20px 65px rgba(0,0,0,.38); backdrop-filter:blur(18px); z-index:130; }
    .adnn-composer-panel { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; }
    .adnn-composer-panel label { min-height:74px; display:grid; place-items:center; gap:6px; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(255,255,255,.05); color:#fff; cursor:pointer; }
    .adnn-composer-panel label span { width:32px; height:32px; border-radius:12px; display:grid; place-items:center; background:var(--adnn-primary); }
    .adnn-composer-panel label svg { width:17px; height:17px; }
    .adnn-composer-panel label b { font-size:11px; font-weight:600; }
    .adnn-emoji-panel { display:flex; flex-wrap:wrap; gap:6px; right:auto; max-width:320px; }
    .adnn-emoji-panel button { width:36px; height:36px; border:0; border-radius:12px; background:rgba(255,255,255,.07); font-size:18px; cursor:pointer; }
    .adnn-drop-layer { position:absolute; inset:calc(var(--head) + 12px) 12px calc(var(--composer) + 12px); display:none; place-items:center; border:1px dashed rgba(141,150,255,.5); border-radius:24px; background:rgba(39,45,207,.16); color:#fff; z-index:8; backdrop-filter:blur(12px); }
    .adnn-room-shell.is-dragging .adnn-drop-layer { display:grid; }
    .adnn-scroll-bottom { position:absolute; right:18px; bottom:calc(var(--composer) + 18px); width:42px; height:42px; border:0; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.12); color:#fff; z-index:10; transform:rotate(-90deg); cursor:pointer; }
    .adnn-scroll-bottom svg { width:18px; height:18px; }
    .adnn-call-popout { position:fixed; z-index:2147483600; width:min(430px, calc(100vw - 20px)); max-height:calc(100svh - 20px); overflow:auto; touch-action:none; }
    .adnn-incoming-call, .adnn-call-card { width:100%; border:1px solid rgba(255,255,255,.12); border-radius:28px; background:linear-gradient(145deg, rgba(20,20,26,.97), rgba(5,5,8,.99)); color:#fff; padding:14px; text-align:center; box-shadow:0 30px 100px rgba(0,0,0,.5); backdrop-filter:blur(20px); }
    .adnn-call-drag-handle { height:34px; margin:-4px -2px 10px; padding:0 10px; border-radius:16px; display:flex; align-items:center; justify-content:space-between; color:rgba(255,255,255,.58); background:rgba(255,255,255,.055); cursor:grab; user-select:none; font-size:11px; }
    .adnn-call-drag-handle:active { cursor:grabbing; }
    .adnn-incoming-call .adnn-avatar { margin:0 auto; width:64px; height:64px; border-radius:22px; }
    .adnn-incoming-call h3 { margin:14px 0 4px; }
    .adnn-incoming-call p { color:rgba(255,255,255,.58); margin:0 0 20px; }
    .adnn-incoming-call > div:last-child, .adnn-call-controls { display:flex; justify-content:center; gap:12px; }
    .adnn-incoming-call button, .adnn-call-controls button { width:52px; height:52px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.08); cursor:pointer; }
    .adnn-incoming-call button svg, .adnn-call-controls button svg { width:21px; height:21px; }
    .adnn-incoming-call .is-accept { background:var(--adnn-success); }
    .adnn-incoming-call .is-end, .adnn-call-controls .is-end { background:#ff3b30; }
    .adnn-call-controls .is-off { background:rgba(255,255,255,.18); color:#ffcabf; }
    .adnn-call-stage { position:relative; aspect-ratio:16/10; border-radius:20px; background:#000; overflow:hidden; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr; gap:1px; }
    .adnn-call-card.is-audio .adnn-call-stage { aspect-ratio:16/9; }
    .adnn-video-tile { min-width:0; min-height:0; position:relative; background:#000; }
    .adnn-video-tile video { width:100%; height:100%; object-fit:cover; display:block; }
    .adnn-video-tile.is-local video { transform:scaleX(-1); }
    .adnn-video-tile span { position:absolute; left:10px; bottom:10px; padding:5px 8px; border-radius:999px; background:rgba(0,0,0,.48); font-size:11px; }
    .adnn-audio-call-face { grid-column:1 / -1; display:grid; place-items:center; min-height:220px; }
    .adnn-audio-call-face .adnn-avatar { width:96px; height:96px; border-radius:30px; font-size:24px; }
    .adnn-call-meta { text-align:left; margin:0 0 14px; }
    .adnn-call-meta strong, .adnn-call-meta small { display:block; }
    .adnn-call-meta small { color:rgba(255,255,255,.55); margin-top:3px; }
    .adnn-call-hold-badge { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); padding:8px 12px; border-radius:999px; background:rgba(0,0,0,.62); color:#fff; font-size:12px; backdrop-filter:blur(10px); z-index:3; }
    .adnn-message-row.is-call { justify-content:center; }
    .adnn-message-row.is-call .adnn-message { max-width:min(92%, 360px); background:rgba(255,255,255,.06); border-radius:18px; }
    .adnn-call-message { display:flex; align-items:center; gap:10px; text-align:left; }
    .adnn-call-message > span { width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background:rgba(39,45,207,.25); color:#fff; flex:0 0 auto; }
    .adnn-call-message svg { width:18px; height:18px; }
    .adnn-call-message strong { display:block; font-size:13px; }
    .adnn-call-message small { display:block; color:rgba(255,255,255,.55); margin-top:2px; font-size:11px; }
    .adnn-call-message.is-missed > span { background:rgba(255,38,2,.18); color:#ff9588; }
    .adnn-confirm-backdrop { position:fixed; inset:0; z-index:2147483630; display:grid; place-items:center; padding:18px; background:rgba(0,0,0,.56); backdrop-filter:blur(14px); }
    .adnn-confirm-card { width:min(390px, 100%); border:1px solid rgba(255,255,255,.12); border-radius:24px; background:linear-gradient(145deg, rgba(22,22,28,.98), rgba(5,5,8,.99)); color:#fff; padding:20px; box-shadow:0 30px 100px rgba(0,0,0,.5); }
    .adnn-confirm-card h3 { margin:0 0 8px; font-size:18px; }
    .adnn-confirm-card p { margin:0 0 18px; color:rgba(255,255,255,.62); line-height:1.45; }
    .adnn-confirm-card div { display:flex; justify-content:flex-end; gap:10px; }
    .adnn-confirm-card button { border:0; border-radius:14px; padding:11px 14px; background:rgba(255,255,255,.08); color:#fff; cursor:pointer; }
    .adnn-confirm-card button.is-danger { background:var(--adnn-danger); }
    .adnn-chat-toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:2147483640; padding:10px 14px; border-radius:999px; background:#111; color:#fff; border:1px solid rgba(255,255,255,.1); box-shadow:0 16px 50px rgba(0,0,0,.3); max-width:min(92vw, 560px); text-align:center; }
    .adnn-chat-toast.is-bad { border-color:rgba(255,80,70,.35); background:#25100f; }
    .adnn-chat-toast.is-warn { border-color:rgba(255,198,109,.35); background:#211909; }
    .adnn-chat-toast.is-ok { border-color:rgba(83,215,105,.25); }


    /* ADNN hard layout guard: keep the room header, messages, and composer inside the chat room on every screen. */
    .adnn-chat-app .adnn-chat-layout { width:100% !important; max-width:100% !important; align-self:stretch !important; justify-self:stretch !important; }
    .adnn-chat-app .adnn-chat-room { contain:layout paint !important; transform:none !important; }
    .adnn-chat-app .adnn-room-shell {
      position:absolute !important; inset:0 !important; width:100% !important; max-width:100% !important; height:100% !important;
      display:grid !important; grid-template-rows:var(--head) minmax(0,1fr) auto !important; grid-template-columns:minmax(0,1fr) !important;
      overflow:hidden !important; transform:none !important; isolation:isolate !important;
    }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head {
      position:relative !important; inset:auto !important; grid-row:1 !important; grid-column:1 / -1 !important; width:100% !important; max-width:none !important;
      min-width:0 !important; height:var(--head) !important; min-height:var(--head) !important; flex:0 0 auto !important;
      display:flex !important; align-items:center !important; justify-content:flex-start !important; overflow:visible !important; transform:none !important;
      padding:12px 14px !important; z-index:95 !important;
    }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-room-title { flex:1 1 auto !important; min-width:0 !important; max-width:100% !important; }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-room-actions { margin-left:auto !important; flex:0 0 auto !important; position:relative !important; right:auto !important; top:auto !important; transform:none !important; }
    .adnn-chat-app .adnn-room-shell > .adnn-room-searchbar { top:var(--head) !important; left:0 !important; right:0 !important; width:auto !important; }
    .adnn-chat-app .adnn-room-shell > .adnn-message-scroll {
      position:relative !important; top:auto !important; left:auto !important; right:auto !important; bottom:auto !important; grid-row:2 !important; grid-column:1 / -1 !important;
      width:100% !important; min-width:0 !important; height:100% !important; min-height:0 !important; max-height:none !important; overflow-y:auto !important; padding:18px !important;
    }
    .adnn-chat-app .adnn-room-shell > .adnn-room-searchbar:not([hidden]) ~ .adnn-message-scroll { padding-top:70px !important; }
    .adnn-chat-app .adnn-room-shell > .adnn-composer-wrap {
      position:relative !important; left:auto !important; right:auto !important; bottom:auto !important; grid-row:3 !important; grid-column:1 / -1 !important;
      width:100% !important; min-width:0 !important; min-height:var(--composer) !important; flex:0 0 auto !important; transform:none !important;
    }
    .adnn-chat-app .adnn-room-shell > .adnn-scroll-bottom { bottom:calc(var(--composer) + 18px) !important; }

    @media (max-width:900px) {
      .adnn-room-actions { gap:5px; }
      .adnn-call-btn { width:39px; height:39px; }
      .adnn-message { max-width:78%; }
    }


    .adnn-inapp-stack { position:fixed; right:18px; top:18px; z-index:2147483500; display:grid; gap:10px; width:min(360px, calc(100vw - 28px)); pointer-events:none; }
    .adnn-inapp-card { pointer-events:auto; width:100%; min-height:70px; border:1px solid rgba(255,255,255,.14); border-radius:22px; display:grid; grid-template-columns:46px minmax(0,1fr) auto; align-items:center; gap:12px; padding:12px; background:linear-gradient(145deg, rgba(22,22,28,.96), rgba(4,4,7,.98)); color:#fff; text-align:left; box-shadow:0 24px 80px rgba(0,0,0,.38); backdrop-filter:blur(18px); animation:adnnNotifyIn .32s cubic-bezier(.16,1,.3,1); cursor:pointer; }
    .adnn-inapp-card strong, .adnn-inapp-card small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-inapp-card strong { font-size:13px; font-weight:650; }
    .adnn-inapp-card small { color:rgba(255,255,255,.58); font-size:12px; margin-top:3px; }
    .adnn-inapp-card b { min-width:22px; height:22px; padding:0 6px; border-radius:999px; display:grid; place-items:center; background:var(--adnn-danger); color:#fff; font-size:11px; }
    .adnn-inapp-card.is-missed { border-color:rgba(255,38,2,.36); }
    @keyframes adnnNotifyIn { from { opacity:0; transform:translateY(-10px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    :root.adnn-chat-light .adnn-chat-app { --adnn-bg:#f6f7fb; --adnn-panel:#ffffff; --adnn-soft:rgba(7,10,25,.065); --adnn-line:rgba(7,10,25,.11); --adnn-text:#12131a; --adnn-muted:rgba(18,19,26,.56); color:#12131a; }
    :root.adnn-chat-light .adnn-chat-layout { background:linear-gradient(145deg, rgba(255,255,255,.98), rgba(237,239,250,.98)); box-shadow:0 24px 90px rgba(14,18,48,.16); }
    :root.adnn-chat-light .adnn-chat-thread-panel { background:rgba(255,255,255,.72); border-right-color:rgba(7,10,25,.08); }
    :root.adnn-chat-light .adnn-chat-thread-head, :root.adnn-chat-light .adnn-room-head, :root.adnn-chat-light .adnn-composer-wrap, :root.adnn-chat-light .adnn-room-searchbar { background:rgba(255,255,255,.92); border-color:rgba(7,10,25,.1); color:#12131a; }
    :root.adnn-chat-light .adnn-room-shell { background:radial-gradient(circle at 92% 6%, rgba(39,45,207,.12), transparent 32%), #f8f9ff; }
    :root.adnn-chat-light .adnn-thread, :root.adnn-chat-light .adnn-call-btn, :root.adnn-chat-light .adnn-back-btn, :root.adnn-chat-light .adnn-attach-btn, :root.adnn-chat-light .adnn-voice-btn, :root.adnn-chat-light .adnn-plus-btn, :root.adnn-chat-light .adnn-emoji-btn, :root.adnn-chat-light .adnn-room-menu button, :root.adnn-chat-light .adnn-outer-menu button { color:#11131b; }
    :root.adnn-chat-light .adnn-call-btn, :root.adnn-chat-light .adnn-back-btn, :root.adnn-chat-light .adnn-attach-btn, :root.adnn-chat-light .adnn-voice-btn, :root.adnn-chat-light .adnn-plus-btn, :root.adnn-chat-light .adnn-emoji-btn, :root.adnn-chat-light .adnn-room-menu, :root.adnn-chat-light .adnn-outer-menu { background:rgba(10,14,30,.07); border-color:rgba(7,10,25,.1); }
    :root.adnn-chat-light .adnn-thread:hover, :root.adnn-chat-light .adnn-thread.is-active { background:rgba(39,45,207,.12); }
    :root.adnn-chat-light .adnn-thread-copy small, :root.adnn-chat-light .adnn-thread-side time, :root.adnn-chat-light .adnn-room-title small, :root.adnn-chat-light .adnn-chat-empty, :root.adnn-chat-light .adnn-chat-welcome { color:rgba(18,19,26,.55); }
    :root.adnn-chat-light .adnn-chat-search, :root.adnn-chat-light .adnn-composer textarea, :root.adnn-chat-light .adnn-room-searchbar input { background:#fff; color:#11131b; border-color:rgba(7,10,25,.1); }
    :root.adnn-chat-light .adnn-chat-search input { color:#11131b; }
    :root.adnn-chat-light .adnn-message { background:#ffffff; color:#11131b; border-color:rgba(7,10,25,.08); box-shadow:0 12px 28px rgba(12,16,46,.08); }
    :root.adnn-chat-light .is-mine .adnn-message { color:#fff; background:linear-gradient(145deg,var(--adnn-primary),var(--adnn-primary2)); }
    :root.adnn-chat-light .adnn-date-separator, :root.adnn-chat-light .adnn-reply-preview, :root.adnn-chat-light .adnn-doc-bubble, :root.adnn-chat-light .adnn-voice-bubble { background:rgba(7,10,25,.06); color:#11131b; }
    :root.adnn-chat-light .adnn-message-meta, :root.adnn-chat-light .adnn-voice-bubble small, :root.adnn-chat-light .adnn-doc-bubble small { color:rgba(18,19,26,.5); }
    :root.adnn-chat-light .adnn-chat-layout, :root.adnn-chat-light .adnn-room-head, :root.adnn-chat-light .adnn-composer-wrap, :root.adnn-chat-light .adnn-message, :root.adnn-chat-light .adnn-thread, :root.adnn-chat-light .adnn-message-actions, :root.adnn-chat-light .adnn-composer-panel, :root.adnn-chat-light .adnn-emoji-panel, :root.adnn-chat-light .adnn-floating-reaction-sheet { box-shadow:none !important; }
    :root.adnn-chat-light .adnn-message-actions, :root.adnn-chat-light .adnn-composer-panel, :root.adnn-chat-light .adnn-emoji-panel, :root.adnn-chat-light .adnn-floating-reaction-sheet { background:#fff; border-color:rgba(7,10,25,.1); }
    :root.adnn-chat-light .adnn-message-actions button, :root.adnn-chat-light .adnn-floating-reaction-sheet button, :root.adnn-chat-light .adnn-emoji-panel button { background:rgba(7,10,25,.055); color:#11131b; }
    :root.adnn-chat-light .adnn-room-shell { box-shadow:none !important; }
    :root.adnn-chat-light .adnn-thread.is-pinned { background:rgba(39,45,207,.09); }
    :root.adnn-chat-light .adnn-thread.is-pinned .adnn-pin-chat { box-shadow:none; }
    :root.adnn-chat-light .adnn-inapp-card { background:linear-gradient(145deg, rgba(255,255,255,.98), rgba(238,240,250,.98)); color:#11131b; border-color:rgba(7,10,25,.1); box-shadow:0 24px 80px rgba(14,18,48,.16); }
    :root.adnn-chat-light .adnn-inapp-card small { color:rgba(18,19,26,.56); }
    :root.adnn-reduce-motion .adnn-chat-app *, :root.adnn-reduce-motion .adnn-call-popout, :root.adnn-reduce-motion .adnn-inapp-card { transition:none !important; animation:none !important; scroll-behavior:auto !important; transform:none !important; filter:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }

    .side-notification-badge { min-width:18px; height:18px; padding:0 5px; border-radius:999px; display:grid; place-items:center; background:#ff2602; color:#fff; font-size:10px; line-height:1; box-shadow:0 0 0 2px rgba(0,0,0,.18), 0 8px 22px rgba(255,38,2,.38); }
    .side-notification-badge[hidden] { display:none !important; }
    .side-nav a.can-drag, .side-nav button.can-drag, .sidebar-link-item.can-drag { cursor:grab; }
    .side-nav a.is-dragging, .side-nav button.is-dragging, .sidebar-link-item.is-dragging { opacity:.45; transform:scale(.98); }
    .side-nav a::before, .side-nav button::before, .sidebar-link-item::before { content:""; position:absolute; left:5px; top:50%; width:4px; height:18px; border-radius:999px; opacity:0; transform:translateY(-50%); background:linear-gradient(#fff8,#fff2); transition:.18s ease; }
    .side-nav a.can-drag::before, .side-nav button.can-drag::before, .sidebar-link-item.can-drag::before { opacity:.62; }
    .adnn-pin-chat { width:22px; height:22px; border:0; border-radius:999px; display:grid; place-items:center; color:rgba(255,255,255,.42); background:rgba(255,255,255,.05); font-size:10px; cursor:pointer; }
    .adnn-thread.is-pinned .adnn-pin-chat { color:#fff; background:rgba(39,45,207,.72); box-shadow:0 0 18px rgba(39,45,207,.34); }
    .adnn-thread.is-pinned { background:linear-gradient(135deg, rgba(39,45,207,.18), rgba(255,255,255,.035)); }
    .settings-grid { display:grid !important; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px !important; align-items:stretch; }
    .settings-card.adnn-setting-card, .settings-card.adnn-os-card { min-height:68px !important; border-radius:20px !important; padding:14px 16px !important; border:1px solid rgba(255,255,255,.1) !important; background:linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.025)) !important; box-shadow:0 16px 45px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.1) !important; display:grid !important; grid-template-columns:minmax(0,1fr) auto !important; gap:12px !important; align-items:center !important; transition:transform .18s ease, border-color .18s ease, background .18s ease !important; }
    .settings-card.adnn-setting-card:hover, .settings-card.adnn-os-card:hover { transform:translateY(-2px); border-color:rgba(39,45,207,.34) !important; background:linear-gradient(145deg, rgba(39,45,207,.13), rgba(255,255,255,.035)) !important; }
    .settings-card.adnn-setting-card strong, .settings-card.adnn-os-card strong { margin:0 0 2px !important; font-size:13px !important; line-height:1.2 !important; letter-spacing:0 !important; font-weight:560 !important; }
    .settings-card.adnn-setting-card span, .settings-card.adnn-os-card span { font-size:11px !important; line-height:1.35 !important; opacity:.68; }
    .settings-card .settings-inline-btn, .settings-card .apple-home-btn { width:40px !important; height:40px !important; min-width:40px !important; border-radius:14px !important; }
    .adnn-client-status-btn { min-height:32px; border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:0 12px; background:rgba(255,255,255,.07); color:#fff; font-size:11px; cursor:pointer; transition:.18s ease; }
    .adnn-client-status-btn:hover { background:rgba(39,45,207,.22); border-color:rgba(39,45,207,.38); }
    .adnn-client-status-btn:disabled { opacity:.5; cursor:wait; }
    .adnn-name-confirm-row { display:grid !important; grid-template-columns:minmax(0,1fr) 32px !important; gap:8px !important; align-items:center !important; }
    .adnn-name-confirm-btn { width:30px; height:30px; border:0; border-radius:12px; display:grid; place-items:center; color:#fff; background:linear-gradient(145deg,var(--adnn-primary),var(--adnn-primary2)); box-shadow:0 10px 25px rgba(39,45,207,.22); cursor:pointer; transition:.18s ease; }
    .adnn-name-confirm-btn svg { width:16px; height:16px; }
    .adnn-name-confirm-btn[hidden] { display:none !important; }
    .adnn-name-confirm-btn:hover { transform:translateY(-1px) scale(1.04); }
    .adnn-name-confirm-btn:disabled { opacity:.55; cursor:wait; transform:none; }
    .adnn-os-card { grid-template-columns:36px minmax(0,1fr) 36px !important; cursor:pointer !important; }
    .adnn-os-card::after { display:block !important; content:""; position:absolute; inset:-30%; z-index:-1; opacity:0; transform:scale(.8); background:radial-gradient(circle at var(--tap-x,50%) var(--tap-y,50%), rgba(255,255,255,.34), rgba(39,45,207,.24) 18%, transparent 42%); pointer-events:none; }
    .adnn-os-card.is-playing::after { animation:adnnOsWave .75s cubic-bezier(.16,1,.3,1); }
    .adnn-os-dots { width:34px !important; height:34px !important; border-radius:14px !important; opacity:.9; }
    .adnn-os-meta { min-width:0; }
    @keyframes adnnOsWave { 0%{opacity:0;transform:scale(.6)} 34%{opacity:1} 100%{opacity:0;transform:scale(1.15)} }

    @media (max-width:760px) {
      .adnn-chat-app { display:block !important; min-height:0 !important; }
      .adnn-chat-layout { grid-template-columns:1fr; height:100svh !important; min-height:0 !important; overflow:hidden !important; border-radius:0; border-left:0; border-right:0; }
      .adnn-chat-layout > .adnn-chat-thread-panel, .adnn-chat-layout > .adnn-chat-room { grid-column:1 / -1; grid-row:1; }
      .adnn-chat-thread-panel { border-right:0; }
      .adnn-chat-layout .adnn-chat-room { display:none; }
      .adnn-chat-layout.is-single .adnn-chat-room { display:block; height:100%; }
      .adnn-chat-layout.is-room-open { position:fixed !important; inset:0 !important; z-index:2147483200 !important; height:100svh !important; width:100vw !important; border:0 !important; border-radius:0 !important; }
      .adnn-chat-layout.is-room-open .adnn-chat-thread-panel { display:none; }
      .adnn-chat-layout.is-room-open .adnn-chat-room, body.adnn-chat-mobile-lock .adnn-chat-room { display:block; height:100svh !important; min-height:0 !important; overflow:hidden !important; }
      .adnn-room-shell { height:100svh !important; --head:64px; --composer:74px; }
      .adnn-back-btn { display:grid; }
      .adnn-room-head { padding:10px 8px; gap:7px; }
      .adnn-room-head .adnn-avatar { width:38px; height:38px; border-radius:14px; }
      .adnn-room-title strong { font-size:14px; }
      .adnn-room-title small { font-size:11px; }
      .adnn-room-actions .adnn-call-btn { width:36px; height:36px; }
      .adnn-room-actions .adnn-call-btn[data-room-search] { display:none; }
      .adnn-message-scroll { padding:12px 10px !important; }
      .adnn-message { max-width:87%; }
      .is-mine .adnn-message-actions, .is-peer .adnn-message-actions { position:fixed !important; left:10px !important; right:10px !important; top:auto !important; bottom:calc(82px + env(safe-area-inset-bottom)) !important; width:auto !important; max-width:none !important; justify-content:center; overflow-x:auto; transform:translateY(12px) scale(.98); border-radius:20px; padding:7px; }
      .adnn-message:hover .adnn-message-actions, .adnn-message:focus-within .adnn-message-actions, .adnn-message.is-menu-open .adnn-message-actions { transform:translateY(0) scale(1); }
      .adnn-composer-wrap { padding:6px 8px max(8px, env(safe-area-inset-bottom)); }
      .adnn-composer { gap:6px; }
      .adnn-composer textarea { font-size:16px; min-height:41px; padding:11px 13px; }
      .adnn-plus-btn, .adnn-attach-btn, .adnn-emoji-btn, .adnn-voice-btn, .adnn-send-btn { width:39px; height:39px; }
      .adnn-emoji-btn { display:none; }
      .adnn-composer-panel { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .adnn-call-stage { grid-template-columns:1fr; aspect-ratio:9/12; }
      .adnn-call-card.is-audio .adnn-call-stage { aspect-ratio:1/1; }
      .adnn-call-popout { width:calc(100vw - 16px); max-height:calc(100svh - 16px); }
      .adnn-floating-reaction-sheet { left:8px !important; right:8px !important; width:auto !important; max-width:calc(100vw - 16px) !important; justify-content:center; border-radius:22px; bottom:calc(8px + env(safe-area-inset-bottom)) !important; top:auto !important; }
      .adnn-chat-app .adnn-room-shell { grid-template-rows:64px minmax(0,1fr) auto !important; --head:64px; --composer:74px; }
      .adnn-chat-app .adnn-room-shell > .adnn-room-head { padding:9px 8px !important; gap:7px !important; min-width:0 !important; overflow:visible !important; }
      .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-room-title { min-width:0 !important; }
      .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-room-actions { gap:5px !important; margin-left:auto !important; }
      .adnn-chat-app .adnn-room-shell > .adnn-message-scroll { padding:12px 10px !important; }
      .adnn-chat-app .adnn-room-shell > .adnn-composer-wrap { padding:7px 8px max(8px, env(safe-area-inset-bottom)) !important; }
    }

    @media (max-width:420px) {
      .adnn-room-head .adnn-avatar { width:34px !important; height:34px !important; border-radius:12px !important; }
      .adnn-room-actions .adnn-call-btn { width:32px !important; height:32px !important; }
      .adnn-room-actions .adnn-call-btn svg { width:15px !important; height:15px !important; }
      .adnn-room-title small { display:none !important; }
      .adnn-message { max-width:91%; }
      .adnn-attach-btn { display:none; }
      .adnn-doc-bubble { min-width:min(240px, 74vw); }
    }
  `;
  document.head.appendChild(style);
}

// Expose a tiny debug surface without coupling the site to internals.
window.ADNN_CHAT_RUNTIME = Object.freeze({
  version: "2.3.0-message-card-settings-sheet",
  refresh: refreshAllConnections,
  get activeUser() { return activeUser ? { uid: activeUser.uid, email: activeUser.email } : null; },
  get activeCall() { return activeCall ? { callId: activeCall.callId, kind: activeCall.kind, role: activeCall.role } : null; },
  get offlinePersistenceState() { return offlinePersistenceState; }
});
