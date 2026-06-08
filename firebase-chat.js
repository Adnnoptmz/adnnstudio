import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 8000;
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

const ADNN_ICON_PHONE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.8 10 7.2c.6.6.7 1.5.2 2.2l-1 1.5a11.8 11.8 0 0 0 4.9 4.9l1.5-1c.7-.5 1.6-.4 2.2.2l2.4 2.5c.5.5.6 1.3.2 1.9-.8 1.3-2.4 2-4 1.5C9.6 18.8 5.2 14.4 3.1 7.6c-.5-1.6.2-3.2 1.5-4 .6-.4 1.4-.3 1.9.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ADNN_ICON_VIDEO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v9A2.5 2.5 0 0 1 13.5 19h-7A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 10 4-2.4v8.8L16 14v-4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const ADNN_ICON_END = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14.5c3.5-3.1 7.5-3.1 11 0l1.7-1.7c.7-.7.7-1.8 0-2.5-4.5-4.2-9.9-4.2-14.4 0-.7.7-.7 1.8 0 2.5l1.7 1.7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 15.5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const ADNN_ICON_ACCEPT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ADNN_ICON_SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M17 9.5a4 4 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M19.5 7a7.5 7.5 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const ADNN_ICON_MUTED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m18 9 4 4m0-4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

let activeUser = null;
let clientChatId = "";
let clientChatUnsubscribe = null;
let clientMessagesUnsubscribe = null;
let adminChatsUnsubscribe = null;
let adminMessagesUnsubscribe = null;
let selectedAdminChatId = "";
let selectedAdminChat = null;
let directChatsUnsubscribe = null;
let directMessagesUnsubscribe = null;
let activeDirectChatId = "";
let activeDirectChat = null;
let firstDirectMessagesSnapshot = true;
let knownDirectMessageIds = new Set();
let designerMessagesUnsubscribe = null;
let designerChatId = "designer_lounge";
let activeDesignerProfile = null;
let firstClientMessagesSnapshot = true;
let firstAdminMessagesSnapshot = true;
let firstDesignerMessagesSnapshot = true;
let knownClientMessageIds = new Set();
let knownAdminMessageIds = new Set();
let knownDesignerMessageIds = new Set();
let chatAudio = null;
let activeCallState = null;
let presenceTimer = null;
let incomingCallsUnsubscribes = [];
let activeCallUnsubscribes = [];

if (auth && db) {
  installChatStyles();
  installClientChatShell();
  if (location.pathname.includes("admin.html")) {
    installAdminChatPanel();
    installAdminMessageCardTools();
  }
  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    updateClientChatVisibility(user);
    if (!user) {
      stopClientChat();
      stopAdminChat();
      stopDesignerChat();
      stopDirectChats();
      stopPresence();
      stopIncomingCallListeners();
      endBrowserCall(false);
      return;
    }

    startPresence(user);
    startIncomingCallListeners(user);

    if (isAdminEmail(user.email) && location.pathname.includes("admin.html")) {
      startAdminChat();
      return;
    }

    if (location.pathname.includes("designer-account.html")) {
      const designer = await getDesignerProfile(user).catch(() => null);
      activeDesignerProfile = designer || null;
      await ensureClientChat(user).catch(() => {});
      startClientChat(user);
      startDirectChats(user);
      stopDesignerChat();
      return;
    }

    if (!isAdminEmail(user.email)) {
      const designer = await getDesignerProfile(user).catch(() => null);
      if (designer) {
        activeDesignerProfile = designer;
        stopClientChat();
        return;
      }
      await ensureClientChat(user).catch(() => {});
      startClientChat(user);
      startDirectChats(user);
    }
  });
}

function installClientChatShell() {
  if (document.getElementById("adnnChatTrigger")) return;

  const trigger = document.createElement("button");
  trigger.id = "adnnChatTrigger";
  trigger.className = "adnn-chat-trigger glass edge";
  trigger.type = "button";
  trigger.hidden = true;
  trigger.setAttribute("aria-label", "Open chat");
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px; display: block;"><path d="M12 3.5c-5.25 0-9.5 3.8-9.5 8.5 0 2.62 1.34 4.97 3.45 6.53-.15.77-.53 2.14-1.13 3.2-.13.23.05.51.31.44 1.14-.32 2.83-1.04 3.93-1.85A10.6 10.6 0 0 0 12 20.5c5.25 0 9.5-3.8 9.5-8.5S17.25 3.5 12 3.5z"/></svg>
    <span class="adnn-chat-count" hidden>0</span>
  `;

  const search = document.querySelector(".nav-actions .search");
  if (search && search.parentElement) {
    search.insertAdjacentElement("afterend", trigger);
  } else {
    trigger.classList.add("is-floating");
    document.body.appendChild(trigger);
  }

  const drawer = document.createElement("aside");
  drawer.id = "adnnChatDrawer";
  drawer.className = "adnn-chat-drawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="adnn-chat-head">
      <div>
        <span>Private chat</span>
        <strong>AdnnStudio</strong>
      </div>
      <div class="adnn-chat-head-actions">
        <button type="button" class="adnn-chat-call" data-call-kind="audio" aria-label="Start audio call">${ADNN_ICON_PHONE}</button>
        <button type="button" class="adnn-chat-call" data-call-kind="video" aria-label="Start video call">${ADNN_ICON_VIDEO}</button>
        <button type="button" class="adnn-chat-close" aria-label="Close chat">×</button>
      </div>
    </div>
    <div class="adnn-chat-messages" id="adnnChatMessages">
    </div>
    <form class="adnn-chat-form" id="adnnChatForm">
      <label class="adnn-chat-media" title="Add media" aria-label="Add media">
        <input id="adnnChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="adnn-chat-file-name" id="adnnChatFileName" hidden></span>
      </label>
      <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Type a message">
      <button type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; display: block;">
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>
      </button>
    </form>
  `;

  const embeddedClientMount = document.getElementById("clientChatMount");
  if (embeddedClientMount) {
    drawer.classList.add("is-embedded", "is-open");
    drawer.setAttribute("aria-hidden", "false");
    embeddedClientMount.appendChild(drawer);
  } else {
    document.body.appendChild(drawer);
  }
  trigger.addEventListener("click", () => {
    if (!activeUser) return;
    if (isAdminEmail(activeUser?.email)) {
      location.href = "admin.html#chat";
      return;
    }
    if ((activeDesignerProfile || getCachedDesignerUser()) && !location.pathname.includes("designer-account.html")) {
      location.href = "designer-account.html#chat";
      return;
    }
    if (isPublicIndexPage()) {
      location.href = "account.html#chat";
      return;
    }
    openClientChat();
  });
  drawer.querySelector(".adnn-chat-close")?.addEventListener("click", closeClientChat);
  drawer.querySelectorAll(".adnn-chat-call").forEach((button) => button.addEventListener("click", () => startRealtimeCall(button.dataset.callKind || "audio", getSupportCallTarget())));
  drawer.querySelector("#adnnChatForm")?.addEventListener("submit", sendClientMessage);
  wireFilePreview("adnnChatFile", "adnnChatFileName");
  window.addEventListener("hashchange", maybeOpenClientChatFromHash);
}

function updateClientChatVisibility(user) {
  const trigger = document.getElementById("adnnChatTrigger");
  if (!trigger) return;
  const hasUser = Boolean(user);
  const hideOnAdminPanel = location.pathname.includes("admin.html") && isAdminEmail(user?.email);
  const hideOnDesignerPanel = location.pathname.includes("designer-account.html");
  const hideOnEmbeddedClientPanel = Boolean(document.getElementById("clientChatMount"));
  trigger.hidden = !hasUser || hideOnAdminPanel || hideOnDesignerPanel || hideOnEmbeddedClientPanel;
  trigger.classList.toggle("is-admin", isAdminEmail(user?.email));
}

async function ensureClientChat(user) {
  clientChatId = supportChatId(user.uid);
  const ref = doc(db, "chats", clientChatId);
  await setDoc(ref, {
    type: "support",
    clientUid: user.uid,
    clientEmail: emailKey(user.email),
    clientName: user.displayName || user.email || "Client",
    clientPhoto: user.photoURL || "",
    adminEmail: ADMIN_EMAIL,
    participantUids: [user.uid, ADMIN_ALIAS_UID],
    participantEmails: [emailKey(user.email), ADMIN_EMAIL],
    unreadForClient: 0,
    unreadForAdmin: 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}

function startClientChat(user) {
  stopClientChat();
  clientChatId = supportChatId(user.uid);
  const chatRef = doc(db, "chats", clientChatId);
  clientChatUnsubscribe = onSnapshot(chatRef, (snap) => {
    const data = snap.data() || {};
    setClientUnread(data.unreadForClient || 0);
  });

  const messagesQuery = query(collection(db, "chats", clientChatId, "messages"));
  clientMessagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const nextIds = new Set(messages.map((message) => message.id));
    const incoming = !firstClientMessagesSnapshot
      ? messages.filter((message) => message.senderUid !== user.uid && !knownClientMessageIds.has(message.id))
      : [];
    firstClientMessagesSnapshot = false;
    knownClientMessageIds = nextIds;
    renderClientMessages(messages);
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], "New message");
    if (document.getElementById("adnnChatDrawer")?.classList.contains("is-open")) markClientChatRead();
  });
  maybeOpenClientChatFromHash();
}

function stopClientChat() {
  if (clientChatUnsubscribe) clientChatUnsubscribe();
  if (clientMessagesUnsubscribe) clientMessagesUnsubscribe();
  clientChatUnsubscribe = null;
  clientMessagesUnsubscribe = null;
  firstClientMessagesSnapshot = true;
  knownClientMessageIds = new Set();
  setClientUnread(0);
}

function openClientChat() {
  const drawer = document.getElementById("adnnChatDrawer");
  drawer?.classList.add("is-open");
  drawer?.setAttribute("aria-hidden", "false");
  markClientChatRead();
  window.setTimeout(() => document.getElementById("adnnChatInput")?.focus(), 180);
}

function closeClientChat() {
  const drawer = document.getElementById("adnnChatDrawer");
  drawer?.classList.remove("is-open");
  drawer?.setAttribute("aria-hidden", "true");
}

async function sendClientMessage(event) {
  event.preventDefault();
  if (!activeUser || !clientChatId) return;
  const input = document.getElementById("adnnChatInput");
  const fileInput = document.getElementById("adnnChatFile");
  const text = String(input?.value || "").trim();
  const file = fileInput?.files?.[0] || null;
  if (!text && !file) return;
  await ensureClientChat(activeUser);
  const media = await uploadChatFile(file, clientChatId).catch((error) => {
    alert(`The media could not be attached. ${error?.message || "Try a smaller file."}`);
    throw error;
  });
  const lastMessage = text || media.mediaName || "Media";
  await addDoc(collection(db, "chats", clientChatId, "messages"), {
    text,
    ...media,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: activeUser.displayName || activeUser.email || "Client",
    senderRole: "client",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", clientChatId), {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp(),
    unreadForAdmin: increment(1)
  }, { merge: true });
  input.value = "";
  if (fileInput) fileInput.value = "";
  clearFilePreview("adnnChatFileName");
}

function renderClientMessages(messages) {
  const wrap = document.getElementById("adnnChatMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "adnn-chat-empty";
    empty.textContent = "";
    wrap.appendChild(empty);
    return;
  }
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid, clientChatId)));
  wrap.scrollTop = wrap.scrollHeight;
}

async function markClientChatRead() {
  if (!clientChatId) return;
  await setDoc(doc(db, "chats", clientChatId), {
    unreadForClient: 0
  }, { merge: true }).catch(() => {});
}

function setClientUnread(count) {
  const badge = document.querySelector("#adnnChatTrigger .adnn-chat-count");
  const value = Number(count) || 0;
  if (badge) {
    badge.textContent = String(value);
    badge.hidden = value <= 0;
  }
  updateSectionBadge("support", value);
}

function installAdminChatPanel() {
  if (document.getElementById("adnnAdminChatPanel")) return;
  const panel = document.createElement("section");
  panel.id = "adnnAdminChatPanel";
  panel.className = "panel glass adnn-admin-chat-panel";
  panel.innerHTML = `
    <div class="adnn-admin-chat-appbar">
      <div>
        <p class="kicker">Studio chat</p>
        <strong>Messages</strong>
      </div>
      <span>Private Console</span>
    </div>
    <div class="adnn-admin-chat-grid" id="adnnAdminChatGrid">
      <div class="adnn-admin-chat-list" id="adnnAdminChatList">
        <div class="adnn-chat-empty">Waiting for chats.</div>
      </div>
      <div class="adnn-admin-chat-room" id="adnnAdminChatRoom">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnAdminChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnAdminChatAvatar" style="display: none;"></span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnAdminChatTitle"></strong>
            <small id="adnnAdminChatSubtitle"></small>
          </span>
          <span class="adnn-direct-actions"><button type="button" class="adnn-chat-call" data-call-kind="audio" aria-label="Start audio call">${ADNN_ICON_PHONE}</button><button type="button" class="adnn-chat-call" data-call-kind="video" aria-label="Start video call">${ADNN_ICON_VIDEO}</button></span>
        </div>
        <div class="adnn-chat-messages" id="adnnAdminMessages">
          <div class="adnn-chat-version-placeholder">studiochat v.1.0</div>
        </div>
        <form class="adnn-chat-form" id="adnnAdminChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnAdminChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="adnn-chat-file-name" id="adnnAdminChatFileName" hidden></span>
          </label>
          <input id="adnnAdminChatInput" autocomplete="off" maxlength="1800" placeholder="Message">
          <button type="submit" aria-label="Send reply">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
  const chatView = document.getElementById("chats_view");
  if (chatView) {
    chatView.innerHTML = "";
    chatView.appendChild(panel);
  } else {
    const composer = document.querySelector(".panel.glass");
    if (composer) composer.insertAdjacentElement("afterend", panel);
    else document.querySelector(".shell")?.appendChild(panel);
  }
  document.getElementById("adnnAdminChatForm")?.addEventListener("submit", sendAdminMessage);
  panel.querySelectorAll(".adnn-admin-chat-title .adnn-chat-call").forEach((button) => button.addEventListener("click", () => startRealtimeCall(button.dataset.callKind || "audio", getAdminCallTarget())));
  document.getElementById("adnnAdminChatBack")?.addEventListener("click", () => {
    document.body.classList.remove("adnn-admin-chat-open");
  });
  
  // Custom Desktop Escape Route Key Listener Injection
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.keyCode === 27) {
      // 1. Deselect active admin room conversation tracks
      if (document.body.classList.contains("adnn-admin-chat-open")) {
        document.body.classList.remove("adnn-admin-chat-open");
      }
      selectedAdminChatId = "";
      selectedAdminChat = null;
     const titleEl = document.getElementById("adnnAdminChatTitle");
      if (titleEl) titleEl.textContent = "";
      const subtitleEl = document.getElementById("adnnAdminChatSubtitle");
      if (subtitleEl) subtitleEl.textContent = "";
      const avatarEl = document.getElementById("adnnAdminChatAvatar");
      if (avatarEl) {
        avatarEl.style.display = "none";
        avatarEl.textContent = "";
      }
      const msgWrap = document.getElementById("adnnAdminMessages");
      if (msgWrap) msgWrap.innerHTML = '<div class="adnn-chat-version-placeholder">studiochat v.1.0</div>';
      document.querySelectorAll(".adnn-admin-chat-item").forEach(el => el.classList.remove("is-active"));
      if (adminMessagesUnsubscribe) { adminMessagesUnsubscribe(); adminMessagesUnsubscribe = null; }
      
      // 2. Close floating customer popups if running on standard viewport
      const drawer = document.getElementById("adnnChatDrawer");
      if (drawer && drawer.classList.contains("is-open")) {
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
      }
    }
  });
  
  wireFilePreview("adnnAdminChatFile", "adnnAdminChatFileName");
}

async function startAdminChat() {
  const adminDoc = await getDoc(doc(db, "admins", activeUser.uid)).catch(() => null);
  if (!adminDoc?.exists()) {
    renderAdminChatStatus("Admin chat access is not ready.");
    return;
  }
  if (adminChatsUnsubscribe) adminChatsUnsubscribe();
  adminChatsUnsubscribe = onSnapshot(collection(db, "chats"), (snapshot) => {
    const chats = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((chat) => chat.type !== "direct")
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
    renderAdminChatList(chats);
  }, () => renderAdminChatStatus("Could not load chats."));
}

 function stopAdminChat() {
  if (adminChatsUnsubscribe) adminChatsUnsubscribe();
  if (adminMessagesUnsubscribe) adminMessagesUnsubscribe();
  adminChatsUnsubscribe = null;
  adminMessagesUnsubscribe = null;
  selectedAdminChatId = "";
  selectedAdminChat = null;
}

function installDesignerChatPanel() {
  if (document.getElementById("adnnDesignerChatPanel")) return;
  const view = document.getElementById("chat");
  if (!view) return;
  const panel = document.createElement("div");
  panel.id = "adnnDesignerChatPanel";
  panel.className = "adnn-designer-chat-panel";
  panel.innerHTML = `
    <div class="adnn-chat-messages" id="adnnDesignerMessages">
      <div class="adnn-chat-empty">Sign in to open designer chat.</div>
    </div>
    <form class="adnn-chat-form" id="adnnDesignerChatForm">
      <label class="adnn-chat-media" title="Add media" aria-label="Add media">
        <input id="adnnDesignerChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="adnn-chat-file-name" id="adnnDesignerChatFileName" hidden></span>
      </label>
      <input id="adnnDesignerChatInput" autocomplete="off" maxlength="1800" placeholder="Message designers">
      <button type="submit" aria-label="Send designer message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </button>
    </form>
  `;
  view.appendChild(panel);
  document.getElementById("adnnDesignerChatForm")?.addEventListener("submit", sendDesignerMessage);
  wireFilePreview("adnnDesignerChatFile", "adnnDesignerChatFileName");
}

async function getDesignerProfile(user) {
  if (!user?.uid) return null;
  const snap = await getDoc(doc(db, "designers", user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function ensureDesignerRoom(user, designer) {
  const ref = doc(db, "chats", designerChatId);
  await setDoc(ref, {
    type: "designer-room",
    roomKey: "designer_lounge",
    title: "Designer Lounge",
    lastDesignerUid: user.uid,
    lastDesignerId: designer.designerId || designer.designerid || "",
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}

function startDesignerChat(user, designer) {
  stopDesignerChat();
  activeDesignerProfile = designer;
  designerMessagesUnsubscribe = onSnapshot(collection(db, "chats", designerChatId, "messages"), (snapshot) => {
    const messages = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const nextIds = new Set(messages.map((message) => message.id));
    const incoming = !firstDesignerMessagesSnapshot
      ? messages.filter((message) => message.senderUid !== user.uid && !knownDesignerMessageIds.has(message.id))
      : [];
    firstDesignerMessagesSnapshot = false;
    knownDesignerMessageIds = nextIds;
    renderDesignerMessages(messages);
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], "Designer chat");
  }, () => {
    renderDesignerChatStatus("Designer chat could not load.");
  });
}

function stopDesignerChat() {
  if (designerMessagesUnsubscribe) designerMessagesUnsubscribe();
  designerMessagesUnsubscribe = null;
  activeDesignerProfile = null;
  firstDesignerMessagesSnapshot = true;
  knownDesignerMessageIds = new Set();
}

function renderDesignerMessages(messages) {
  const wrap = document.getElementById("adnnDesignerMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    wrap.innerHTML = "";
    return;
  }
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid, designerChatId)));
  wrap.scrollTop = wrap.scrollHeight;
}

function renderDesignerChatStatus(text) {
  const wrap = document.getElementById("adnnDesignerMessages");
  if (!wrap) return;
  wrap.innerHTML = `<div class="adnn-chat-empty">${escapeHtml(text)}</div>`;
}

async function sendDesignerMessage(event) {
  event.preventDefault();
  if (!activeUser) return;
  const input = document.getElementById("adnnDesignerChatInput");
  const fileInput = document.getElementById("adnnDesignerChatFile");
  const text = String(input?.value || "").trim();
  const file = fileInput?.files?.[0] || null;
  if (!text && !file) return;
  const media = await uploadChatFile(file, designerChatId).catch((error) => {
    alert(`The media could not be attached. ${error?.message || "Try a smaller file."}`);
    throw error;
  });
  const lastMessage = text || media.mediaName || "Media";
  await addDoc(collection(db, "chats", designerChatId, "messages"), {
    text,
    ...media,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: activeDesignerProfile?.name || activeUser.displayName || activeUser.email || "Designer",
    senderRole: "designer",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", designerChatId), {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  input.value = "";
  if (fileInput) fileInput.value = "";
  clearFilePreview("adnnDesignerChatFileName");
}

function installAdminMessageCardTools() {
  const form = document.getElementById("adnnMessageCardForm");
  if (!form || form.dataset.ready === "true") return;
  form.dataset.ready = "true";
  form.addEventListener("submit", createAdminEmailMessageCard);
}

async function resolveUserByEmail(email) {
  const value = emailKey(email);
  if (!value) return null;
  const clientSnap = await getDocs(query(collection(db, "clients"), where("email", "==", value))).catch(() => null);
  if (clientSnap && !clientSnap.empty) {
    const data = clientSnap.docs[0].data() || {};
    return { uid: data.uid || clientSnap.docs[0].id, email: data.email || value, name: data.name || data.displayName || data.displayEmail || value, role: "client" };
  }
  const designerFields = ["authEmail", "email", "displayEmail"];
  for (const field of designerFields) {
    const designerSnap = await getDocs(query(collection(db, "designers"), where(field, "==", value))).catch(() => null);
    if (designerSnap && !designerSnap.empty) {
      const data = designerSnap.docs[0].data() || {};
      return {
        uid: data.uid || designerSnap.docs[0].id,
        email: emailKey(data.authEmail || data.email || data.displayEmail || value),
        name: data.name || data.displayName || data.designerName || data.designerId || data.displayEmail || value,
        role: "designer"
      };
    }
  }
  return null;
}

async function createAdminEmailMessageCard(event) {
  event.preventDefault();
  if (!activeUser || !isAdminEmail(activeUser.email)) return;
  const status = document.getElementById("adnnMessageCardStatus");
  const emailA = emailKey(document.getElementById("adnnCardEmailA")?.value);
  const emailB = emailKey(document.getElementById("adnnCardEmailB")?.value);
  if (!emailA || !emailB || emailA === emailB) {
    if (status) status.textContent = "Enter two different user emails.";
    return;
  }
  if (status) status.textContent = "Checking users...";
  const [userA, userB] = await Promise.all([resolveUserByEmail(emailA), resolveUserByEmail(emailB)]);
  if (!userA?.uid || !userB?.uid) {
    if (status) status.textContent = "One or both users were not found. Make sure each user has logged in once.";
    return;
  }
  const chatId = directChatId(userA.uid, userB.uid);
  await setDoc(doc(db, "chats", chatId), {
    type: "direct",
    title: `${userA.name} ↔ ${userB.name}`,
    createdByAdminUid: activeUser.uid,
    participantUids: sortedPair(userA.uid, userB.uid),
    participantEmails: [userA.email, userB.email],
    participantNames: { [userA.uid]: userA.name, [userB.uid]: userB.name },
    participantEmailMap: { [userA.uid]: userA.email, [userB.uid]: userB.email },
    lastMessage: "Message card created by admin.",
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: `Admin connected ${userA.name} and ${userB.name}. You can now message directly here.`,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: "AdnnStudio",
    senderRole: "admin",
    systemCard: true,
    createdAt: serverTimestamp()
  });
  event.currentTarget.reset();
  if (status) status.textContent = "Message card created. The chat will appear for both users.";
}

function installDirectChatPanel() {
  if (document.getElementById("adnnDirectChatPanel")) return;
  const mount = document.getElementById("directChatMount") || document.getElementById("chat");
  if (!mount) return;
  const panel = document.createElement("section");
  panel.id = "adnnDirectChatPanel";
  panel.className = "adnn-direct-chat-panel";
  panel.innerHTML = `
    <div class="adnn-direct-list" id="adnnDirectChatList"></div>
    <div class="adnn-direct-room" id="adnnDirectRoom">
      <div class="adnn-direct-title">
        <button type="button" class="adnn-direct-back" id="adnnDirectBack">‹</button>
        <span class="adnn-direct-avatar" id="adnnDirectAvatar">AD</span>
        <span class="adnn-direct-title-copy"><strong id="adnnDirectTitle"></strong><small id="adnnDirectSubtitle"></small></span>
        <span class="adnn-direct-actions"><button type="button" class="adnn-chat-call" data-call-kind="audio" aria-label="Start audio call">${ADNN_ICON_PHONE}</button><button type="button" class="adnn-chat-call" data-call-kind="video" aria-label="Start video call">${ADNN_ICON_VIDEO}</button></span>
      </div>
      <div class="adnn-chat-messages" id="adnnDirectMessages"></div>
      <form class="adnn-chat-form" id="adnnDirectChatForm">
        <label class="adnn-chat-media" title="Add media" aria-label="Add media"><input id="adnnDirectChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="adnn-chat-file-name" id="adnnDirectChatFileName" hidden></span></label>
        <input id="adnnDirectChatInput" autocomplete="off" maxlength="1800" placeholder="Message user" disabled>
        <button type="submit" aria-label="Send direct message" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;display:block;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </form>
    </div>`;
  mount.appendChild(panel);
  document.getElementById("adnnDirectChatForm")?.addEventListener("submit", sendDirectMessage);
  document.getElementById("adnnDirectBack")?.addEventListener("click", closeDirectChatRoom);
  panel.querySelectorAll(".adnn-chat-call").forEach((button) => button.addEventListener("click", () => startRealtimeCall(button.dataset.callKind || "audio", getDirectCallTarget())));
  wireFilePreview("adnnDirectChatFile", "adnnDirectChatFileName");
}

function startDirectChats(user) {
  if (!user?.uid) return;
  installDirectChatPanel();
  if (directChatsUnsubscribe) directChatsUnsubscribe();
  const directQuery = query(collection(db, "chats"), where("participantUids", "array-contains", user.uid));
  directChatsUnsubscribe = onSnapshot(directQuery, (snapshot) => {
    const chats = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((chat) => chat.type === "direct").sort((a,b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
    renderDirectChatList(chats);
    updateSectionBadge("chat", chats.length);
  }, () => renderDirectChatStatus("User chats could not load."));
}

function stopDirectChats() {
  if (directChatsUnsubscribe) directChatsUnsubscribe();
  if (directMessagesUnsubscribe) directMessagesUnsubscribe();
  directChatsUnsubscribe = null;
  directMessagesUnsubscribe = null;
  activeDirectChatId = "";
  activeDirectChat = null;
  firstDirectMessagesSnapshot = true;
  knownDirectMessageIds = new Set();
}

function renderDirectChatStatus(text) {
  const list = document.getElementById("adnnDirectChatList");
  if (list) list.innerHTML = `<div class="adnn-chat-empty">${escapeHtml(text)}</div>`;
}

function renderDirectChatList(chats) {
  const list = document.getElementById("adnnDirectChatList");
  if (!list) return;
  list.innerHTML = "";
  if (!chats.length) {
    list.innerHTML = "";
    return;
  }
  chats.forEach((chat) => {
    const other = getDirectOtherUser(chat);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "adnn-direct-user";
    button.dataset.chatId = chat.id;
    button.classList.toggle("is-active", chat.id === activeDirectChatId);
    button.innerHTML = `<span class="adnn-direct-user-avatar">${escapeHtml(initialsFromName(other.name || other.email || ""))}</span><span><strong>${escapeHtml(other.name || other.email || "")}</strong><small>${escapeHtml(other.email || chat.lastMessage || "")}</small></span>`;
    button.addEventListener("click", () => selectDirectChat(chat));
    list.appendChild(button);
    if (!other.name || other.name === "User" || !other.email) {
      enrichDirectChatIdentity(chat).then((resolved) => {
        if (!resolved || button.dataset.chatId !== chat.id) return;
        const strong = button.querySelector("strong");
        const small = button.querySelector("small");
        const avatar = button.querySelector(".adnn-direct-user-avatar");
        if (strong) strong.textContent = resolved.name || resolved.email || "";
        if (small) small.textContent = resolved.email || chat.lastMessage || "";
        if (avatar) avatar.textContent = initialsFromName(resolved.name || resolved.email || "");
      }).catch(() => {});
    }
  });
}

function selectDirectChat(chat) {
  activeDirectChat = chat;
  activeDirectChatId = chat.id;
  const other = getDirectOtherUser(chat);
  document.querySelectorAll(".adnn-direct-user").forEach((el) => el.classList.toggle("is-active", el.dataset.chatId === chat.id));
  document.body.classList.add("adnn-direct-chat-open");
  const title = document.getElementById("adnnDirectTitle");
  const subtitle = document.getElementById("adnnDirectSubtitle");
  const avatar = document.getElementById("adnnDirectAvatar");
  const input = document.getElementById("adnnDirectChatInput");
  const submit = document.querySelector("#adnnDirectChatForm button[type='submit']");
  if (title) title.textContent = other.name || other.email || "";
  if (subtitle) subtitle.textContent = other.email || "";
  if (avatar) avatar.textContent = initialsFromName(other.name || other.email || "");
  if (!other.name || other.name === "User" || !other.email) {
    enrichDirectChatIdentity(chat).then((resolved) => {
      if (!resolved || activeDirectChatId !== chat.id) return;
      if (title) title.textContent = resolved.name || resolved.email || "";
      if (subtitle) subtitle.textContent = resolved.email || "";
      if (avatar) avatar.textContent = initialsFromName(resolved.name || resolved.email || "");
    }).catch(() => {});
  }
  if (input) input.disabled = false;
  if (submit) submit.disabled = false;
  if (directMessagesUnsubscribe) directMessagesUnsubscribe();
  firstDirectMessagesSnapshot = true;
  knownDirectMessageIds = new Set();
  directMessagesUnsubscribe = onSnapshot(collection(db, "chats", chat.id, "messages"), (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).sort((a,b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const nextIds = new Set(messages.map((message) => message.id));
    const incoming = !firstDirectMessagesSnapshot ? messages.filter((message) => message.senderUid !== activeUser?.uid && !knownDirectMessageIds.has(message.id)) : [];
    firstDirectMessagesSnapshot = false;
    knownDirectMessageIds = nextIds;
    renderDirectMessages(messages);
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], `User chat from ${other.name || other.email || "user"}`);
  });
}

function closeDirectChatRoom() {
  document.body.classList.remove("adnn-direct-chat-open");
}

function renderDirectMessages(messages) {
  const wrap = document.getElementById("adnnDirectMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    wrap.innerHTML = "";
    return;
  }
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid, activeDirectChatId)));
  wrap.scrollTop = wrap.scrollHeight;
}

async function sendDirectMessage(event) {
  event.preventDefault();
  if (!activeUser || !activeDirectChatId) return;
  const input = document.getElementById("adnnDirectChatInput");
  const fileInput = document.getElementById("adnnDirectChatFile");
  const text = String(input?.value || "").trim();
  const file = fileInput?.files?.[0] || null;
  if (!text && !file) return;
  const media = await uploadChatFile(file, activeDirectChatId).catch((error) => { alert(`The media could not be attached. ${error?.message || "Try a smaller file."}`); throw error; });
  const lastMessage = text || media.mediaName || "Media";
  await addDoc(collection(db, "chats", activeDirectChatId, "messages"), {
    text,
    ...media,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: getOwnDirectName(activeDirectChat),
    senderRole: "user",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", activeDirectChatId), { lastMessage, lastSenderUid: activeUser.uid, updatedAt: serverTimestamp() }, { merge: true });
  input.value = "";
  if (fileInput) fileInput.value = "";
  clearFilePreview("adnnDirectChatFileName");
}


function directChatEmailForUid(chat, uid) {
  const emailMap = chat?.participantEmailMap || {};
  if (emailMap[uid]) return emailKey(emailMap[uid]);
  const uids = Array.isArray(chat?.participantUids) ? chat.participantUids : [];
  const emails = Array.isArray(chat?.participantEmails) ? chat.participantEmails : [];
  const index = uids.indexOf(uid);
  return emailKey(index >= 0 ? emails[index] : "");
}

async function findUserProfileByUid(uid, fallbackEmail = "") {
  if (!uid) return null;
  const clientDoc = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (clientDoc?.exists()) {
    const data = clientDoc.data() || {};
    return { uid, email: emailKey(data.email || data.displayEmail || fallbackEmail), name: data.name || data.displayName || data.displayEmail || data.email || fallbackEmail || "" };
  }
  const designerDoc = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designerDoc?.exists()) {
    const data = designerDoc.data() || {};
    return { uid, email: emailKey(data.authEmail || data.email || data.displayEmail || fallbackEmail), name: data.name || data.displayName || data.designerName || data.designerId || data.displayEmail || data.authEmail || fallbackEmail || "" };
  }
  const email = emailKey(fallbackEmail);
  if (email) {
    const resolved = await resolveUserByEmail(email).catch(() => null);
    if (resolved?.uid) return resolved;
  }
  return null;
}

async function enrichDirectChatIdentity(chat) {
  const current = getDirectOtherUser(chat);
  if (!current.uid) return current;
  const fallbackEmail = current.email || directChatEmailForUid(chat, current.uid);
  const profile = await findUserProfileByUid(current.uid, fallbackEmail).catch(() => null);
  if (!profile) return current;
  const name = profile.name || current.name || profile.email || current.email || "";
  const email = emailKey(profile.email || current.email || fallbackEmail);
  if ((name && name !== current.name) || (email && email !== current.email)) {
    await setDoc(doc(db, "chats", chat.id), {
      participantNames: { ...(chat.participantNames || {}), [current.uid]: name },
      participantEmailMap: { ...(chat.participantEmailMap || {}), [current.uid]: email }
    }, { merge: true }).catch(() => {});
    chat.participantNames = { ...(chat.participantNames || {}), [current.uid]: name };
    chat.participantEmailMap = { ...(chat.participantEmailMap || {}), [current.uid]: email };
  }
  return { uid: current.uid, name, email };
}

function getDirectOtherUser(chat) {
  if (!chat) return { uid:"", name:"", email:"" };
  const uids = Array.isArray(chat.participantUids) ? chat.participantUids : [];
  const otherUid = uids.find((uid) => uid !== activeUser?.uid) || uids[0] || "";
  const names = chat.participantNames || {};
  const email = directChatEmailForUid(chat, otherUid);
  const name = names[otherUid] || email || "";
  return { uid: otherUid, name, email };
}

function getOwnDirectName(chat) {
  const names = chat?.participantNames || {};
  return names[activeUser?.uid] || activeUser?.displayName || activeUser?.email || "";
}

function directChatId(uidA, uidB) { return `direct_${sortedPair(uidA, uidB).join("_")}`; }
function sortedPair(uidA, uidB) { return [cleanUid(uidA), cleanUid(uidB)].sort(); }
function cleanUid(value) { return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, ""); }


function getSupportCallTarget() {
  return { chatId: clientChatId, receiverUid: ADMIN_ALIAS_UID, label: "AdnnStudio Admin Support" };
}

function getAdminCallTarget() {
  if (!selectedAdminChat) return null;
  return {
    chatId: selectedAdminChatId,
    receiverUid: selectedAdminChat.clientUid || "",
    label: selectedAdminChat.clientName || selectedAdminChat.title || selectedAdminChat.clientEmail || "User"
  };
}

function getDirectCallTarget() {
  const other = getDirectOtherUser(activeDirectChat);
  return { chatId: activeDirectChatId, receiverUid: other.uid, label: other.name || other.email || "User" };
}

function ownCallUid() {
  return isAdminEmail(activeUser?.email) ? ADMIN_ALIAS_UID : activeUser?.uid;
}

async function startPresence(user) {
  if (!db || !user?.uid) return;
  stopPresence();
  const writePresence = async () => {
    const payload = {
      uid: user.uid,
      email: emailKey(user.email),
      name: user.displayName || user.email || "User",
      online: true,
      lastSeen: serverTimestamp(),
      page: location.pathname,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "presence", user.uid), payload, { merge: true }).catch(() => {});
    if (isAdminEmail(user.email)) {
      await setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { ...payload, uid: ADMIN_ALIAS_UID, realUid: user.uid, name: "AdnnStudio Admin" }, { merge: true }).catch(() => {});
    }
  };
  await writePresence();
  presenceTimer = window.setInterval(writePresence, 25000);
  window.addEventListener("beforeunload", markOfflineOnce);
}

function stopPresence() {
  if (presenceTimer) window.clearInterval(presenceTimer);
  presenceTimer = null;
  window.removeEventListener("beforeunload", markOfflineOnce);
}

function markOfflineOnce() {
  if (!db || !activeUser?.uid) return;
  setDoc(doc(db, "presence", activeUser.uid), { online: false, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  if (isAdminEmail(activeUser.email)) setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { online: false, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
}

async function isUserOnline(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, "presence", uid)).catch(() => null);
  if (!snap?.exists()) return false;
  const data = snap.data() || {};
  const seen = toMillis(data.lastSeen || data.updatedAt);
  return data.online !== false && seen && (Date.now() - seen) < 70000;
}

function callIsExpired(call) {
  const expiresAt = Number(call?.expiresAtMs || 0);
  return !!expiresAt && Date.now() > expiresAt;
}

function callExpiresAtMs() {
  return Date.now() + CALL_RING_TIMEOUT_MS;
}

async function deleteDocsInCollection(ref) {
  const snapshot = await getDocs(ref).catch(() => null);
  if (!snapshot) return;
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref).catch(() => {})));
}

async function cleanupCallSignaling(callId, receiverUid) {
  if (!callId) return;
  await deleteDocsInCollection(collection(db, "calls", callId, "offerCandidates"));
  await deleteDocsInCollection(collection(db, "calls", callId, "answerCandidates"));
  if (receiverUid) {
    const inboxRef = doc(db, "callInbox", receiverUid);
    const inboxSnap = await getDoc(inboxRef).catch(() => null);
    if (inboxSnap?.exists() && inboxSnap.data()?.callId === callId) await deleteDoc(inboxRef).catch(() => {});
  }
  await deleteDoc(doc(db, "calls", callId)).catch(() => {});
}

function scheduleCallSignalingCleanup(callId, receiverUid, delay = CALL_SIGNAL_CLEANUP_DELAY_MS) {
  if (!callId) return;
  window.setTimeout(() => cleanupCallSignaling(callId, receiverUid).catch(() => {}), Math.max(0, delay));
}

function startIncomingCallListeners(user) {
  stopIncomingCallListeners();
  const receivers = [user.uid];
  if (isAdminEmail(user.email)) receivers.push(ADMIN_ALIAS_UID);
  receivers.forEach((receiverUid) => {
    const inboxRef = doc(db, "callInbox", receiverUid);
    incomingCallsUnsubscribes.push(onSnapshot(inboxRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const inbox = snapshot.data() || {};
      if (inbox.status !== "ringing" || !inbox.callId) return;
      const callSnap = await getDoc(doc(db, "calls", inbox.callId)).catch(() => null);
      if (!callSnap?.exists()) return;
      const call = { id: callSnap.id, ...callSnap.data() };
      if (callIsExpired(call)) {
        await updateCallInbox(inbox.receiverUid || activeUser?.uid, inbox.callId, "missed").catch(() => {});
        scheduleCallSignalingCleanup(inbox.callId, inbox.receiverUid || activeUser?.uid, 1000);
        return;
      }
      if (call.status !== "ringing") return;
      if (call.callerUid === ownCallUid() || call.callerRealUid === activeUser?.uid) return;
      showIncomingCall(call);
    }, () => {
      showChatAlert({ text: "Incoming call listener could not start. Check Firestore rules." }, "Call");
    }));
  });
}

function stopIncomingCallListeners() {
  incomingCallsUnsubscribes.forEach((unsub) => unsub?.());
  incomingCallsUnsubscribes = [];
}

async function updateCallInbox(receiverUid, callId, status) {
  if (!receiverUid || !callId) return;
  await setDoc(doc(db, "callInbox", receiverUid), {
    callId,
    receiverUid,
    status,
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

function clearActiveCallListeners() {
  activeCallUnsubscribes.forEach((unsub) => unsub?.());
  activeCallUnsubscribes = [];
}

function getCallRinger() {
  let audio = document.getElementById("adnnCallRinger");
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "adnnCallRinger";
    audio.src = "call ringer_01.mp3";
    audio.loop = true;
    audio.preload = "auto";
    audio.hidden = true;
    document.body.appendChild(audio);
  }
  return audio;
}

function playCallRinger() {
  const audio = getCallRinger();
  audio.currentTime = 0;
  audio.play?.().catch(() => {});
}

function stopCallRinger() {
  const audio = document.getElementById("adnnCallRinger");
  if (!audio) return;
  audio.pause?.();
  audio.currentTime = 0;
}

function makeCallWindowDraggable(card) {
  if (!card || card.dataset.dragReady === "true") return;
  card.dataset.dragReady = "true";
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let left = 0;
  let top = 0;
  const start = (event) => {
    if (event.target.closest("button, video, audio")) return;
    dragging = true;
    const point = event.touches?.[0] || event;
    const rect = card.getBoundingClientRect();
    startX = point.clientX;
    startY = point.clientY;
    left = rect.left;
    top = rect.top;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = "auto";
    card.style.bottom = "auto";
    card.classList.add("is-dragging");
    event.preventDefault?.();
  };
  const move = (event) => {
    if (!dragging) return;
    const point = event.touches?.[0] || event;
    const nextLeft = Math.min(Math.max(8, left + point.clientX - startX), window.innerWidth - card.offsetWidth - 8);
    const nextTop = Math.min(Math.max(8, top + point.clientY - startY), window.innerHeight - card.offsetHeight - 8);
    card.style.left = `${nextLeft}px`;
    card.style.top = `${nextTop}px`;
  };
  const end = () => {
    dragging = false;
    card.classList.remove("is-dragging");
  };
  card.addEventListener("mousedown", start);
  card.addEventListener("touchstart", start, { passive: false });
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("mouseup", end);
  window.addEventListener("touchend", end);
}

function ensureVideoTransceiver(pc) {
  if (!pc?.addTransceiver) return;
  const hasVideo = pc.getTransceivers?.().some((transceiver) => transceiver.receiver?.track?.kind === "video" || transceiver.sender?.track?.kind === "video");
  if (!hasVideo) pc.addTransceiver("video", { direction: "sendrecv" });
}

function getVideoSender(pc) {
  const transceiver = pc?.getTransceivers?.().find((item) => item.receiver?.track?.kind === "video" || item.sender?.track?.kind === "video");
  return transceiver?.sender || pc?.getSenders?.().find((sender) => sender.track?.kind === "video") || null;
}

async function announceCallMediaUpdate(videoOn) {
  if (!activeCallState?.callId) return;
  await setDoc(doc(db, "calls", activeCallState.callId), {
    [`media.${ownCallUid()}`]: { videoOn: !!videoOn, updatedAt: Date.now() },
    updatedAt: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

async function startRealtimeCall(kind = "audio", target = null) {
  if (!target?.receiverUid || !target?.chatId) {
    showChatAlert({ text: "Select a chat before calling." }, "Call");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    showChatAlert({ text: "Calling is not supported in this browser." }, "Call blocked");
    return;
  }
  const online = await isUserOnline(target.receiverUid);
  if (!online) {
    activeCallState = { mode: "outgoing", status: "offline", label: target.label || "User", kind, chatId: target.chatId, receiverUid: target.receiverUid };
    renderCallOverlay();
    window.setTimeout(() => endBrowserCall(false), 2200);
    return;
  }

  try {
    endBrowserCall(false);
    const wantsVideo = kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const expiresAtMs = callExpiresAtMs();
    const callRef = await addDoc(collection(db, "calls"), {
      chatId: target.chatId,
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: activeUser.displayName || activeUser.email || "User",
      receiverUid: target.receiverUid,
      receiverName: target.label || "User",
      participants: [ownCallUid(), target.receiverUid],
      kind,
      status: "ringing",
      startedAt: null,
      endedAt: null,
      expiresAtMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "callInbox", target.receiverUid), {
      callId: callRef.id,
      receiverUid: target.receiverUid,
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: activeUser.displayName || activeUser.email || "User",
      chatId: target.chatId,
      kind,
      status: "ringing",
      expiresAtMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    const pc = createPeerConnection(callRef.id, false);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    ensureVideoTransceiver(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp }, updatedAt: serverTimestamp() }, { merge: true });
    activeCallState = {
      mode: "outgoing",
      callId: callRef.id,
      chatId: target.chatId,
      receiverUid: target.receiverUid,
      label: target.label || "User",
      kind,
      pc,
      stream,
      remoteStream: new MediaStream(),
      speakerOn: true,
      videoOn: wantsVideo,
      status: "ringing",
      startedAt: null,
      timer: null,
      ringTimeout: null,
      summaryWritten: false,
      callerUid: ownCallUid(),
      receiverUid: target.receiverUid
    };
    activeCallState.ringTimeout = window.setTimeout(async () => {
      if (!activeCallState || activeCallState.callId !== callRef.id || activeCallState.status !== "ringing") return;
      await setDoc(callRef, { status: "missed", endedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      await updateCallInbox(target.receiverUid, callRef.id, "missed");
      scheduleCallSignalingCleanup(callRef.id, target.receiverUid, 1200);
      endBrowserCall(false, "Call not answered");
      showChatAlert({ text: "Call not answered" }, "Call");
    }, CALL_RING_TIMEOUT_MS);
    playCallRinger();
    renderCallOverlay();
    watchActiveCall(callRef.id, false);
  } catch (error) {
    endBrowserCall(false);
    showChatAlert({ text: "Microphone/camera permission is needed for calls." }, "Call blocked");
  }
}

function createPeerConnection(callId, isAnswerer) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
  pc.onicecandidate = (event) => {
    if (event.candidate) addDoc(collection(db, "calls", callId, isAnswerer ? "answerCandidates" : "offerCandidates"), event.candidate.toJSON()).catch(() => {});
  };
  pc.ontrack = (event) => {
    if (!activeCallState) return;
    if (!activeCallState.remoteStream) activeCallState.remoteStream = new MediaStream();
    const tracks = event.streams?.[0]?.getTracks?.() || (event.track ? [event.track] : []);
    tracks.forEach((track) => {
      if (!activeCallState.remoteStream.getTracks().some((existing) => existing.id === track.id)) activeCallState.remoteStream.addTrack(track);
    });
    attachCallMedia();
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState) && activeCallState?.status === "connected") {
      endBrowserCall(true, "Call disconnected");
    }
  };
  return pc;
}

function watchActiveCall(callId, isAnswerer) {
  clearActiveCallListeners();
  const callRef = doc(db, "calls", callId);
  activeCallUnsubscribes.push(onSnapshot(callRef, async (snap) => {
    if (!snap.exists() || !activeCallState || activeCallState.callId !== callId) return;
    const call = snap.data() || {};
    if (call.status === "accepted" && activeCallState.status !== "connected") {
      if (!isAnswerer && call.answer && activeCallState.pc?.signalingState !== "stable") {
        await activeCallState.pc.setRemoteDescription(new RTCSessionDescription(call.answer)).catch(() => {});
      }
      activeCallState.status = "connected";
      activeCallState.startedAt = Date.now();
      stopCallRinger();
      renderCallOverlay();
    }
    if (["ended", "rejected", "missed"].includes(call.status)) {
      scheduleCallSignalingCleanup(callId, call.receiverUid, CALL_SIGNAL_CLEANUP_DELAY_MS);
      endBrowserCall(false, call.status === "rejected" ? "Call rejected" : call.status === "missed" ? "Call missed" : "Call ended");
    }
  }));
  activeCallUnsubscribes.push(onSnapshot(collection(db, "calls", callId, isAnswerer ? "offerCandidates" : "answerCandidates"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && activeCallState?.pc) activeCallState.pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
    });
  }));
}

function showIncomingCall(call) {
  if (activeCallState?.callId === call.id) return;
  if (activeCallState) return;
  activeCallState = {
    mode: "incoming",
    callId: call.id,
    chatId: call.chatId,
    label: call.callerName || "Incoming call",
    kind: call.kind || "audio",
    status: "incoming",
    stream: null,
    remoteStream: new MediaStream(),
    speakerOn: true,
    videoOn: false,
    startedAt: null,
    timer: null,
    ringTimeout: null,
    summaryWritten: false,
    callerUid: call.callerUid,
    receiverUid: call.receiverUid
  };
  activeCallState.ringTimeout = window.setTimeout(() => {
    if (activeCallState?.callId === call.id && activeCallState.status === "incoming") rejectIncomingCall();
  }, CALL_RING_TIMEOUT_MS);
  playCallRinger();
  renderCallOverlay();
}

async function acceptIncomingCall() {
  if (!activeCallState?.callId || activeCallState.mode !== "incoming") return;
  try {
    const callRef = doc(db, "calls", activeCallState.callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return endBrowserCall(false);
    const call = snap.data() || {};
    if (callIsExpired(call) || call.status !== "ringing") {
      await updateCallInbox(call.receiverUid || activeUser?.uid, activeCallState.callId, "missed").catch(() => {});
      scheduleCallSignalingCleanup(activeCallState.callId, call.receiverUid || activeUser?.uid, 1000);
      return endBrowserCall(false, "Call expired");
    }
    const wantsVideo = call.kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const pc = createPeerConnection(activeCallState.callId, true);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    Object.assign(activeCallState, { pc, stream, videoOn: wantsVideo, status: "connected", startedAt: Date.now(), mode: "active", callerUid: call.callerUid, receiverUid: call.receiverUid });
    stopCallRinger();
    await setDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, status: "accepted", answeredAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    await updateCallInbox(call.receiverUid, activeCallState.callId, "accepted");
    renderCallOverlay();
    watchActiveCall(activeCallState.callId, true);
  } catch (error) {
    showChatAlert({ text: "Microphone/camera permission is needed to answer." }, "Call blocked");
    rejectIncomingCall();
  }
}

async function rejectIncomingCall() {
  if (activeCallState?.callId) {
    const callSnap = await getDoc(doc(db, "calls", activeCallState.callId)).catch(() => null);
    const call = callSnap?.exists() ? callSnap.data() : {};
    await setDoc(doc(db, "calls", activeCallState.callId), { status: "rejected", endedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    await updateCallInbox(call.receiverUid || activeUser?.uid, activeCallState.callId, "rejected");
    scheduleCallSignalingCleanup(activeCallState.callId, call.receiverUid || activeUser?.uid, CALL_SIGNAL_CLEANUP_DELAY_MS);
  }
  endBrowserCall(false, "Call rejected");
}

function renderCallOverlay() {
  if (!activeCallState) return;
  let overlay = document.getElementById("adnnCallOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "adnnCallOverlay";
    overlay.className = "adnn-call-overlay";
    overlay.innerHTML = `
      <div class="adnn-call-card" role="dialog" aria-modal="false" aria-label="Call controls">
        <div class="adnn-call-drag-handle">Drag call window</div>
        <div class="adnn-call-avatar" id="adnnCallAvatar"></div>
        <strong id="adnnCallName">Call</strong>
        <small id="adnnCallStatus">Ringing...</small>
        <video id="adnnCallRemoteVideo" autoplay playsinline></video>
        <video id="adnnCallVideo" autoplay muted playsinline></video>
        <audio id="adnnCallRemoteAudio" autoplay playsinline></audio>
        <div class="adnn-call-incoming" id="adnnCallIncomingControls">
          <button type="button" id="adnnCallAccept" class="adnn-call-control is-accept">${ADNN_ICON_ACCEPT}<span>Accept</span></button>
          <button type="button" id="adnnCallReject" class="adnn-call-control is-end">${ADNN_ICON_END}<span>Reject</span></button>
        </div>
        <div class="adnn-call-controls" id="adnnCallActiveControls">
          <button type="button" id="adnnCallSpeaker" class="adnn-call-control" aria-label="Speaker">${ADNN_ICON_SPEAKER}<span>Speaker</span></button>
          <button type="button" id="adnnCallVideoToggle" class="adnn-call-control" aria-label="Convert to video">${ADNN_ICON_VIDEO}<span>Video</span></button>
          <button type="button" id="adnnCallEnd" class="adnn-call-control is-end" aria-label="End call">${ADNN_ICON_END}<span>End</span></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("adnnCallEnd")?.addEventListener("click", () => endBrowserCall(true));
    document.getElementById("adnnCallAccept")?.addEventListener("click", acceptIncomingCall);
    document.getElementById("adnnCallReject")?.addEventListener("click", rejectIncomingCall);
    document.getElementById("adnnCallSpeaker")?.addEventListener("click", toggleCallSpeaker);
    document.getElementById("adnnCallVideoToggle")?.addEventListener("click", convertCallToVideo);
  }
  makeCallWindowDraggable(overlay.querySelector(".adnn-call-card"));
  attachCallMedia();
  const name = document.getElementById("adnnCallName");
  const status = document.getElementById("adnnCallStatus");
  const avatar = document.getElementById("adnnCallAvatar");
  const speaker = document.getElementById("adnnCallSpeaker");
  const videoToggle = document.getElementById("adnnCallVideoToggle");
  const incomingControls = document.getElementById("adnnCallIncomingControls");
  const activeControls = document.getElementById("adnnCallActiveControls");
  if (name) name.textContent = activeCallState.label || "Call";
  if (avatar) avatar.textContent = initialsFromName(activeCallState.label || "Call");
  if (speaker) speaker.classList.toggle("is-muted", !activeCallState.speakerOn);
  if (videoToggle) videoToggle.classList.toggle("is-on", activeCallState.videoOn);
  if (incomingControls) incomingControls.style.display = activeCallState.mode === "incoming" ? "flex" : "none";
  if (activeControls) activeControls.style.display = activeCallState.mode === "incoming" || activeCallState.status === "offline" ? "none" : "flex";
  updateCallStatusText();
}

function attachCallMedia() {
  const localVideo = document.getElementById("adnnCallVideo");
  const remoteVideo = document.getElementById("adnnCallRemoteVideo");
  const remoteAudio = document.getElementById("adnnCallRemoteAudio");
  const remoteStream = activeCallState?.remoteStream || null;
  if (localVideo) {
    if (localVideo.srcObject !== (activeCallState?.stream || null)) localVideo.srcObject = activeCallState?.stream || null;
    localVideo.style.display = activeCallState?.videoOn ? "block" : "none";
    localVideo.play?.().catch(() => {});
  }
  if (remoteVideo) {
    if (remoteVideo.srcObject !== remoteStream) remoteVideo.srcObject = remoteStream;
    remoteVideo.muted = !activeCallState?.speakerOn;
    remoteVideo.volume = activeCallState?.speakerOn ? 1 : 0;
    remoteVideo.style.display = remoteStream?.getVideoTracks?.().length ? "block" : "none";
    remoteVideo.play?.().catch(() => {});
  }
  if (remoteAudio) {
    if (remoteAudio.srcObject !== remoteStream) remoteAudio.srcObject = remoteStream;
    remoteAudio.muted = !activeCallState?.speakerOn;
    remoteAudio.volume = activeCallState?.speakerOn ? 1 : 0;
    remoteAudio.play?.().catch(() => {});
  }
}

function updateCallStatusText() {
  if (!activeCallState) return;
  const status = document.getElementById("adnnCallStatus");
  if (!status) return;
  if (activeCallState.timer) window.clearInterval(activeCallState.timer);
  activeCallState.timer = null;
  if (activeCallState.status === "offline") {
    stopCallRinger();
    status.textContent = "Not Online";
    return;
  }
  if (activeCallState.status === "incoming") {
    playCallRinger();
    status.textContent = `${activeCallState.kind === "video" ? "Video" : "Audio"} call incoming`;
    return;
  }
  if (activeCallState.status === "ringing") {
    playCallRinger();
    status.textContent = "Ringing...";
    return;
  }
  if (activeCallState.status === "connected") {
    stopCallRinger();
    const tick = () => {
      if (!activeCallState || !status) return;
      const seconds = Math.max(0, Math.floor((Date.now() - (activeCallState.startedAt || Date.now())) / 1000));
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");
      status.textContent = `${activeCallState.videoOn ? "Video" : "Audio"} call • ${mm}:${ss}`;
    };
    tick();
    activeCallState.timer = window.setInterval(tick, 1000);
  }
}

function toggleCallSpeaker() {
  if (!activeCallState) return;
  activeCallState.speakerOn = !activeCallState.speakerOn;
  const button = document.getElementById("adnnCallSpeaker");
  if (button) {
    button.classList.toggle("is-muted", !activeCallState.speakerOn);
    button.innerHTML = `${activeCallState.speakerOn ? ADNN_ICON_SPEAKER : ADNN_ICON_MUTED}<span>${activeCallState.speakerOn ? "Speaker" : "Muted"}</span>`;
  }
  attachCallMedia();
}

async function convertCallToVideo() {
  if (!activeCallState?.stream || !activeCallState?.pc) return;
  const button = document.getElementById("adnnCallVideoToggle");
  if (activeCallState.videoOn) {
    activeCallState.stream.getVideoTracks().forEach((track) => {
      track.stop();
      activeCallState.stream.removeTrack(track);
      const sender = activeCallState.pc?.getSenders?.().find((candidate) => candidate.track === track);
      sender?.replaceTrack?.(null).catch(() => {});
    });
    activeCallState.videoOn = false;
    await announceCallMediaUpdate(false);
    if (button) button.innerHTML = `${ADNN_ICON_VIDEO}<span>Video</span>`;
    renderCallOverlay();
    return;
  }
  try {
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = videoStream.getVideoTracks()[0];
    if (!track) throw new Error("No camera track");
    activeCallState.stream.addTrack(track);
    ensureVideoTransceiver(activeCallState.pc);
    let sender = getVideoSender(activeCallState.pc);
    if (sender?.replaceTrack) {
      await sender.replaceTrack(track);
    } else {
      activeCallState.pc.addTrack(track, activeCallState.stream);
    }
    activeCallState.videoOn = true;
    await announceCallMediaUpdate(true);
    if (button) button.innerHTML = `${ADNN_ICON_VIDEO}<span>Video On</span>`;
    renderCallOverlay();
  } catch (error) {
    showChatAlert({ text: "Camera permission is needed to convert to video." }, "Video blocked");
  }
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatCallTime(date = new Date()) {
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function callDirectionForUser(callState) {
  const mine = ownCallUid();
  return callState?.callerUid === mine || callState?.callerRealUid === activeUser?.uid ? "outgoing" : "incoming";
}

function callIconText(kind) {
  return kind === "video" ? "📹" : "☎";
}

async function writeCallSummaryFromState(callState, reason = "Call ended") {
  if (!callState?.chatId || callState.summaryWritten) return;
  callState.summaryWritten = true;
  const durationSeconds = callState.startedAt ? Math.max(0, Math.floor((Date.now() - callState.startedAt) / 1000)) : 0;
  const duration = formatDuration(durationSeconds);
  const endedDate = new Date();
  const callTime = formatCallTime(endedDate);
  const direction = callDirectionForUser(callState);
  const kind = callState.kind || (callState.videoOn ? "video" : "audio");
  const text = durationSeconds > 0
    ? `${callIconText(kind)} ${direction === "outgoing" ? "Outgoing" : "Incoming"} ${kind} call • ${duration} • ${callTime}`
    : `${callIconText(kind)} ${reason} • ${callTime}`;
  const messageId = callState.callId ? `call_${callState.callId}` : undefined;
  const messageData = {
    text,
    callEvent: true,
    callDirection: direction,
    callKind: kind,
    callWith: callState.label || "Call",
    callerUid: callState.callerUid || null,
    receiverUid: callState.receiverUid || null,
    callDurationSeconds: durationSeconds,
    callDuration: duration,
    callTime,
    senderUid: activeUser?.uid || ownCallUid(),
    senderEmail: emailKey(activeUser?.email),
    senderName: activeUser?.displayName || activeUser?.email || "User",
    senderRole: isAdminEmail(activeUser?.email) ? "admin" : "user",
    createdAt: serverTimestamp()
  };
  if (messageId) {
    await setDoc(doc(db, "chats", callState.chatId, "messages", messageId), messageData, { merge: true }).catch(() => {});
  } else {
    await addDoc(collection(db, "chats", callState.chatId, "messages"), messageData).catch(() => {});
  }
  await setDoc(doc(db, "chats", callState.chatId), { lastMessage: text, lastSenderUid: activeUser?.uid || ownCallUid(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
}

async function endBrowserCall(showNotice = true, notice = "Call ended") {
  const state = activeCallState;
  const callId = state?.callId;
  const wasConnected = state?.status === "connected";
  stopCallRinger();
  if (state?.timer) window.clearInterval(state.timer);
  if (state?.ringTimeout) window.clearTimeout(state.ringTimeout);
  clearActiveCallListeners();
  if (wasConnected) await writeCallSummaryFromState(state, notice);
  if (showNotice && callId) {
    const callSnap = await getDoc(doc(db, "calls", callId)).catch(() => null);
    const call = callSnap?.exists() ? callSnap.data() : {};
    await setDoc(doc(db, "calls", callId), { status: "ended", endedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    await updateCallInbox(call.receiverUid, callId, "ended");
    scheduleCallSignalingCleanup(callId, call.receiverUid, CALL_SIGNAL_CLEANUP_DELAY_MS);
  }
  state?.pc?.close?.();
  state?.stream?.getTracks?.().forEach((track) => track.stop());
  activeCallState = null;
  const overlay = document.getElementById("adnnCallOverlay");
  if (overlay) overlay.remove();
  if (showNotice) showChatAlert({ text: notice }, "Call");
}

function updateSectionBadge(type, count) {
  const value = Math.max(0, Number(count) || 0);
  document.querySelectorAll(`[data-account-badge="${type}"]`).forEach((badge) => {
    badge.textContent = String(value);
    badge.hidden = value <= 0;
  });
}

function renderAdminChatStatus(text) {
  const list = document.getElementById("adnnAdminChatList");
  if (!list) return;
  list.innerHTML = `<div class="adnn-chat-empty">${escapeHtml(text)}</div>`;
}

function renderAdminChatList(chats) {
  const list = document.getElementById("adnnAdminChatList");
  if (!list) return;
  list.innerHTML = "";
  if (!chats.length) {
    list.innerHTML = `<div class="adnn-chat-empty">Waiting for chats.</div>`;
    return;
  }
  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "adnn-admin-chat-item";
    button.classList.toggle("is-active", chat.id === selectedAdminChatId);
    const unread = Number(chat.unreadForAdmin) || 0;
    const label = chat.title || chat.clientName || chat.clientEmail || "Chat";
    const preview = chat.lastMessage || chat.clientEmail || "";
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(preview)}</small>
      </span>
      ${unread > 0 ? `<b>${unread}</b>` : ""}
    `;
    button.addEventListener("click", () => selectAdminChat(chat));
    list.appendChild(button);
  });
}

function selectAdminChat(chat) {
  selectedAdminChatId = chat.id;
  selectedAdminChat = chat;
  const chatLabel = chat.title || chat.clientName || chat.clientEmail || "Client";
  
  const adminTitleEl = document.getElementById("adnnAdminChatTitle");
  if (adminTitleEl) adminTitleEl.textContent = chatLabel;

  const adminSubEl = document.getElementById("adnnAdminChatSubtitle");
  if (adminSubEl) adminSubEl.textContent = chat.clientEmail || (chat.type === "designer-room" ? "Designer lounge" : "online");

  const avatarEl = document.getElementById("adnnAdminChatAvatar");
  if (avatarEl) {
    avatarEl.textContent = initialsFromName(chatLabel);
    avatarEl.style.display = "grid";
  }
  document.body.classList.add("adnn-admin-chat-open");
  if (adminMessagesUnsubscribe) adminMessagesUnsubscribe();
  firstAdminMessagesSnapshot = true;
  knownAdminMessageIds = new Set();
  adminMessagesUnsubscribe = onSnapshot(collection(db, "chats", chat.id, "messages"), (snapshot) => {
    const messages = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const nextIds = new Set(messages.map((message) => message.id));
    const incoming = !firstAdminMessagesSnapshot
      ? messages.filter((message) => message.senderUid !== activeUser?.uid && !knownAdminMessageIds.has(message.id))
      : [];
    firstAdminMessagesSnapshot = false;
    knownAdminMessageIds = nextIds;
    renderAdminMessages(messages);
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], "Client message");
  });
  setDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }, { merge: true }).catch(() => {});
}

function renderAdminMessages(messages) {
  const wrap = document.getElementById("adnnAdminMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    wrap.innerHTML = "";
    return;
  }
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid, selectedAdminChatId)));
  wrap.scrollTop = wrap.scrollHeight;
}

async function sendAdminMessage(event) {
  event.preventDefault();
  if (!activeUser || !selectedAdminChatId) return;
  const input = document.getElementById("adnnAdminChatInput");
  const fileInput = document.getElementById("adnnAdminChatFile");
  const text = String(input?.value || "").trim();
  const file = fileInput?.files?.[0] || null;
  if (!text && !file) return;
  const media = await uploadChatFile(file, selectedAdminChatId).catch((error) => {
    alert(`The media could not be attached. ${error?.message || "Try a smaller file."}`);
    throw error;
  });
  const lastMessage = text || media.mediaName || "Media";
  const chatUpdate = {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp()
  };
  if (selectedAdminChat?.type !== "designer-room") chatUpdate.unreadForClient = increment(1);
  await addDoc(collection(db, "chats", selectedAdminChatId, "messages"), {
    text,
    ...media,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: "AdnnStudio",
    senderRole: "admin",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", selectedAdminChatId), chatUpdate, { merge: true });
  input.value = "";
  if (fileInput) fileInput.value = "";
  clearFilePreview("adnnAdminChatFileName");
}

function messageBubble(message, mine, chatId) {
  const bubble = document.createElement("article");
  bubble.className = `adnn-chat-bubble${mine ? " is-mine" : ""}${message.callEvent ? " is-call-event" : ""}`;
  if (message.senderName && !mine) {
    const name = document.createElement("strong");
    name.className = "adnn-chat-sender";
    name.textContent = message.senderName;
    bubble.appendChild(name);
  }
  if (isSafeUrl(message.mediaUrl)) {
    bubble.appendChild(createMediaAttachment(message));
  }
  const text = document.createElement("p");
  const time = document.createElement("span");
  if (message.callEvent) {
    const direction = message.callerUid === ownCallUid() ? "Outgoing" : "Incoming";
    const kind = message.callKind || "audio";
    text.textContent = `${callIconText(kind)} ${direction} ${kind} call • ${message.callDuration || formatDuration(message.callDurationSeconds || 0)} • ${message.callTime || relativeTime(message.createdAt)}`;
  } else {
    text.textContent = message.text || "";
  }
  time.textContent = relativeTime(message.createdAt);
  if (text.textContent) bubble.appendChild(text);
  bubble.appendChild(time);
  if (canDeleteMessage(message)) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "adnn-chat-delete";
    deleteButton.title = "Delete message";
    deleteButton.setAttribute("aria-label", "Delete message");
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-8.5 4h11M9 8v10m6-10v10M7.5 8l.7 12h7.6l.7-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    deleteButton.addEventListener("click", () => deleteChatMessage(chatId, message.id, deleteButton));
    bubble.appendChild(deleteButton);
  }
  return bubble;
}

function createMediaAttachment(message) {
  const mediaType = String(message.mediaType || "");
  if (mediaType.startsWith("image/")) {
    const link = document.createElement("a");
    link.className = "adnn-chat-attachment is-image";
    link.href = message.mediaUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const image = document.createElement("img");
    image.src = message.mediaUrl;
    image.alt = message.mediaName || "Chat image";
    image.loading = "lazy";
    link.appendChild(image);
    return link;
  }

  const link = document.createElement("a");
  link.className = "adnn-chat-attachment";
  link.href = message.mediaUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = message.mediaName || "Open attachment";
  return link;
}

async function deleteChatMessage(chatId, messageId, button) {
  if (!chatId || !messageId) return;
  if (button) button.disabled = true;
  await deleteDoc(doc(db, "chats", chatId, "messages", messageId)).catch((error) => {
    if (button) button.disabled = false;
    console.warn("AdnnStudio chat delete error", error);
  });
}

function canDeleteMessage(message) {
  return isAdminEmail(activeUser?.email) || message.senderUid === activeUser?.uid;
}

async function uploadChatFile(file, chatId) {
  if (!file) return {};
  if (!storage) throw new Error("Media uploads are not available yet.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Chat file is too large.");
  const safeName = sanitizeFileName(file.name || "attachment");
  const path = `chat-media/${chatId}/${activeUser.uid}/${Date.now()}-${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, {
    contentType: file.type || "application/octet-stream"
  });
  const mediaUrl = await getDownloadURL(ref);
  return {
    mediaUrl,
    mediaName: file.name || "Attachment",
    mediaType: file.type || "application/octet-stream",
    mediaPath: path
  };
}

function sanitizeFileName(value) {
  return String(value || "attachment")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "attachment";
}

function showChatAlert(message, label) {
  playChatSound();
  const alert = document.createElement("div");
  alert.className = "adnn-chat-alert";
  alert.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(message.text || message.mediaName || "New message")}</strong>`;
  document.body.appendChild(alert);
  requestAnimationFrame(() => alert.classList.add("is-visible"));
  setTimeout(() => alert.classList.remove("is-visible"), 4200);
  setTimeout(() => alert.remove(), 5200);
}

function playChatSound() {
  const audio = getChatAudio();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function getChatAudio() {
  if (chatAudio) return chatAudio;
  chatAudio = new Audio("Message%20Notification.wav");
  chatAudio.preload = "auto";
  chatAudio.volume = 0.28;
  return chatAudio;
}

function installChatStyles() {
  if (document.getElementById("adnnChatStyles")) return;
  const style = document.createElement("style");
  style.id = "adnnChatStyles";
  style.textContent = `
    :root {
      --adnn-accent: #272dcf;
      --adnn-muted: rgba(245, 245, 247, 0.62);
      --adnn-line: rgba(255, 255, 255, 0.08);
      --adnn-panel-bg: linear-gradient(135deg, rgba(34, 34, 38, 0.72), rgba(22, 22, 26, 0.58) 38%, rgba(14, 14, 18, 0.42));
      --adnn-bubble-mine: linear-gradient(135deg, rgba(39, 45, 207, 0.85), rgba(20, 25, 160, 0.7));
      --adnn-bubble-other: rgba(255, 255, 255, 0.05);
      --adnn-text: #f5f5f7;
    }

    /* Apple Premium Conversational Panel Resets */
    .adnn-admin-chat-item::after { display: none !important; }
    .adnn-admin-chat-item.is-active { background: rgba(39, 45, 207, 0.15) !important; border-left: 3px solid var(--adnn-accent); border-radius: 4px 16px 16px 4px !important; }

    .adnn-chat-trigger {
      width: 44px;
      height: 44px;
      min-width: 44px;
      padding: 0;
      justify-content: center;
      position: relative;
      border: 1px solid var(--adnn-line);
      border-radius: 16px;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      line-height: 1;
      text-decoration: none;
      background: var(--adnn-panel-bg);
      backdrop-filter: blur(26px) saturate(160%);
      -webkit-backdrop-filter: blur(26px) saturate(160%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 20px 70px rgba(0,0,0,.35);
    }
    .adnn-chat-trigger[hidden] { display: none !important; }
    .adnn-chat-trigger svg { width: 19px; height: 19px; }
    .adnn-chat-trigger.is-floating { position: fixed; right: 20px; bottom: 20px; z-index: 70; background: var(--adnn-accent); border-radius: 50%; }
    .adnn-chat-count {
      position: absolute;
      right: -3px;
      top: -3px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #ff2602;
      color: #fff;
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 10px;
      line-height: 1;
    }
    .adnn-chat-count[hidden] { display: none !important; }

    .adnn-chat-drawer {
      position: fixed;
      right: clamp(12px, 3vw, 28px);
      bottom: clamp(12px, 3vw, 28px);
      z-index: 120;
      width: min(390px, calc(100vw - 24px));
      height: min(590px, calc(100vh - 24px));
      display: grid;
      grid-template-rows: auto 1fr auto;
      border: 1px solid var(--adnn-line);
      border-radius: 28px;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(34, 34, 38, 0.88), rgba(14, 14, 18, 0.78));
      backdrop-filter: blur(28px) saturate(160%);
      -webkit-backdrop-filter: blur(28px) saturate(160%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 28px 90px rgba(0,0,0,.38);
      opacity: 0;
      transform: translateY(18px) scale(.98);
      pointer-events: none;
      transition: opacity .25s ease, transform .3s cubic-bezier(.16,1,.3,1);
	    }
	    .adnn-chat-drawer.is-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
	    .adnn-chat-drawer.is-embedded {
	      position: relative;
	      right: auto;
	      bottom: auto;
	      z-index: 1;
	      width: 100%;
	      height: min(640px, calc(100dvh - 260px));
	      min-height: 460px;
	      opacity: 1;
	      transform: none;
	      pointer-events: auto;
	      box-shadow: none;
	    }
	    .adnn-chat-drawer.is-embedded .adnn-chat-close { display: none; }
	    .adnn-chat-head {
      min-height: 72px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--adnn-line);
      color: var(--adnn-text);
    }
    .adnn-chat-head span { display:block; color: #8d96ff; font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 4px; }
    .adnn-chat-head strong { font-size: 17px; font-weight: 500; letter-spacing: -.02em; }
    .adnn-chat-close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.08); color: var(--adnn-text); cursor: pointer; font-size: 22px; line-height: 1; }

    .adnn-chat-messages {
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      color: var(--adnn-text);
      scrollbar-width: thin;
    }
    .adnn-chat-messages::-webkit-scrollbar { width: 4px; }
    .adnn-chat-messages::-webkit-scrollbar-thumb { background: var(--adnn-line); border-radius: 999px; }
    .adnn-chat-empty { margin: auto; color: var(--adnn-muted); font-size: 12px; text-align:center; font-family: var(--font-mono, monospace); }

    .adnn-chat-bubble {
      max-width: 82%;
      align-self: flex-start;
      position: relative;
      border-radius: 18px 18px 18px 6px;
      padding: 10px 12px;
      background: var(--adnn-bubble-other);
      border: 1px solid var(--adnn-line);
      color: var(--adnn-text);
      margin: 1px 0;
    }
    .adnn-chat-bubble.is-mine { align-self: flex-end; border-radius: 18px 18px 6px 18px; background: var(--adnn-bubble-mine); border-color: rgba(255,255,255,.14); box-shadow: 0 8px 24px rgba(39, 45, 207, 0.2); }
    .adnn-chat-bubble p { margin: 0; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
    .adnn-chat-bubble span { display:block; margin-top: 6px; color: rgba(245,245,247,.45); font-size: 10px; font-family: var(--font-mono, monospace); }
    .adnn-chat-sender { display:block; margin-bottom: 5px; color: #8d96ff; font-family: var(--font-mono, monospace); font-size: 10px; font-weight: 500; letter-spacing: .05em; }
    .adnn-chat-attachment { display:block; margin-bottom: 8px; max-width:100%; color: #5360ff; text-decoration: underline; text-underline-offset: 3px; overflow-wrap:anywhere; font-size:13px; }
    .adnn-chat-attachment.is-image { text-decoration: none; }
    .adnn-chat-attachment img { display:block; width:100%; max-height:240px; object-fit:cover; border-radius:14px; border: 1px solid var(--adnn-line); }
    .adnn-chat-delete { width: 28px; height: 28px; margin-top: 8px; border:0; border-radius:50%; display:grid; place-items:center; color: rgba(255,255,255,.78); background: rgba(0,0,0,.16); cursor:pointer; opacity:0; transform: scale(.92); transition: opacity .2s ease, transform .2s ease, background .2s ease; }
    .adnn-chat-bubble:hover .adnn-chat-delete, .adnn-chat-delete:focus-visible { opacity: 1; transform: scale(1); }
    .adnn-chat-delete:hover { background: rgba(255,38,2,.5); color:#fff; }
    .adnn-chat-delete svg { width:14px; height:14px; }

    .adnn-chat-form {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) 42px;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--adnn-line);
      align-items: end;
    }
    .adnn-chat-media { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; position:relative; background: rgba(255,255,255,.05); color: var(--adnn-text); cursor:pointer; border: 1px solid var(--adnn-line); }
    .adnn-chat-media input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
    .adnn-chat-media svg { width:18px; height:18px; display: block; transition: transform .22s ease; }
    .adnn-chat-media.has-file { color:#fff; background: var(--adnn-accent); border-color: rgba(255,255,255,0.15); }
    .adnn-chat-media.has-file svg { transform: rotate(45deg); }
    .adnn-chat-file-name { position:absolute; left:0; bottom:calc(100% + 8px); width:max-content; max-width:min(280px, calc(100vw - 48px)); min-height:42px; padding:7px 10px; border-radius:16px; color:#fff; background: rgba(39,45,207,.9); font-size:10px; font-family: var(--font-mono, monospace); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; box-shadow:0 14px 34px rgba(39,45,207,.30); display:flex; align-items:center; gap:8px; }
    .adnn-chat-file-name img { width:30px; height:30px; border-radius:10px; object-fit:cover; background:rgba(255,255,255,.16); }
    .adnn-chat-file-name .adnn-file-icon { width:30px; height:30px; border-radius:10px; display:grid; place-items:center; background:rgba(255,255,255,.16); font-weight:700; }
    .adnn-chat-file-name .adnn-file-copy { min-width:0; max-width:210px; display:flex; flex-direction:column; gap:2px; overflow:hidden; }
    .adnn-chat-file-name .adnn-file-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:600; }
    .adnn-chat-file-name .adnn-file-copy small { opacity:.74; font-size:9px; }
    .adnn-chat-file-name[hidden] { display:none !important; }
    .adnn-chat-form input { min-width:0; height:44px; border: 1px solid var(--adnn-line); border-radius:16px; padding:0 16px; background: rgba(0,0,0,0.2); color:var(--adnn-text); outline:0; font-size:14px; }
    .adnn-chat-form input::placeholder { color: var(--adnn-muted); }
    .adnn-chat-form input:focus { border-color: var(--adnn-accent); }
    .adnn-chat-form button { width:44px; height:44px; border:0; border-radius:50%; display:grid; place-items:center; background: var(--adnn-accent); color:#fff; cursor:pointer; }
    .adnn-chat-form button svg { width:14px; height:14px; }

    .adnn-chat-alert { position:fixed; right:clamp(16px,4vw,34px); bottom:clamp(18px,4vw,34px); z-index:10000; width:min(320px, calc(100vw - 32px)); border:1px solid var(--adnn-line); border-radius:22px; padding:14px 16px; color:var(--adnn-text); background: linear-gradient(135deg, rgba(34,34,38,.78), rgba(14,14,18,.68)); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 24px 70px rgba(0,0,0,.34), 0 0 34px rgba(39,45,207,.18); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%); opacity:0; transform:translateY(16px) scale(.98); pointer-events:none; transition:opacity .55s ease, transform .65s cubic-bezier(.16,1,.3,1); }
    .adnn-chat-alert.is-visible { opacity:1; transform:translateY(0) scale(1); }
    .adnn-chat-alert span, .adnn-chat-alert strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-chat-alert span { color: #8d96ff; font-family: var(--font-mono, monospace); font-size:10px; text-transform: uppercase; letter-spacing: .16em; margin-bottom: 6px; }
    .adnn-chat-alert strong { font-size:15px; font-weight:500; letter-spacing:-.02em; }

    .adnn-admin-chat-panel {
      margin-top: 22px;
      border: 1px solid var(--adnn-line) !important;
      border-radius: 28px !important;
      overflow: hidden;
      background: transparent !important;
      box-shadow: none !important;
    }
    .adnn-admin-chat-appbar { height: 72px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; color:var(--adnn-text); border-bottom:1px solid var(--adnn-line); }
    .adnn-admin-chat-appbar .kicker { margin:0; color:#5360ff !important; font-family: var(--font-mono, monospace); font-size:11px; letter-spacing: 0.16em; text-transform: uppercase; }
    .adnn-admin-chat-appbar strong { font-size:22px; font-weight:400; letter-spacing:-.04em; }
    .adnn-admin-chat-appbar > span { color:var(--adnn-muted); font-size:12px; font-family: var(--font-mono, monospace); }
    
    .adnn-admin-chat-grid { display:grid; grid-template-columns: minmax(280px, .35fr) minmax(0, 1fr); gap:0; margin:0; height:560px; min-height:0; }
    .adnn-admin-chat-list, .adnn-admin-chat-room { min-height:0; border:0; border-radius:0; overflow:hidden; background: transparent; box-shadow:none; }
    
    .adnn-admin-chat-list { display:block; overflow:auto; border-right:1px solid var(--adnn-line); padding:8px; }
    .adnn-admin-chat-item { width:100%; min-height:64px; border:0; border-radius:16px; padding:10px 12px 10px 64px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; color:var(--adnn-text); background:transparent; text-align:left; cursor:pointer; position:relative; margin-bottom: 4px; }
    .adnn-admin-chat-item::before { content:""; position:absolute; left:12px; top:50%; width:40px; height:40px; border-radius:50%; transform:translateY(-50%); background: rgba(255,255,255,0.06); border: 1px solid var(--adnn-line); }
    .adnn-admin-chat-item::after { content:""; position:absolute; left:42px; bottom:14px; width:8px; height:8px; border-radius:50%; background: var(--adnn-accent); border:2px solid rgba(22, 22, 26, 1); display: none; }
    
    .adnn-admin-chat-item:hover, .adnn-admin-chat-item.is-active { background: rgba(255, 255, 255, 0.05); }
    .adnn-admin-chat-item.is-active::after { display: block; }
    .adnn-admin-chat-item strong, .adnn-admin-chat-item small { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-admin-chat-item strong { font-size:14px; font-weight:400; color:var(--adnn-text); }
    .adnn-admin-chat-item small { margin-top:4px; color:var(--adnn-muted); font-size:12px; }
    .adnn-admin-chat-item b { min-width:20px; height:20px; padding: 0 5px; border-radius: 999px; display:grid; place-items:center; background: var(--adnn-accent); color:#fff; font-size:10px; font-family: var(--font-mono, monospace); font-weight:400; }
    
    .adnn-admin-chat-room { display:grid; grid-template-rows:64px minmax(0,1fr) auto; border-left: 1px solid var(--adnn-line); }
    .adnn-chat-version-placeholder { margin: auto; color: var(--adnn-muted); font-family: var(--font-mono, monospace); font-size: 13px; letter-spacing: 0.05em; opacity: 0.5; text-align: center; }
    .adnn-admin-chat-title { min-height:64px; padding:0 20px; border-bottom:1px solid var(--adnn-line); color:var(--adnn-text); display:flex; align-items:center; gap:14px; background: rgba(255, 255, 255, 0.01); }
    .adnn-admin-chat-back { display:none; width:34px; height:34px; border: 1px solid var(--adnn-line); border-radius:50%; background:rgba(255,255,255,0.03); color:var(--adnn-text); font-size:24px; line-height:1; cursor:pointer; place-items: center; }
    .adnn-admin-chat-avatar { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; flex:0 0 auto; color:#fff; background: var(--adnn-accent); font-size:12px; font-family: var(--font-mono, monospace); font-weight:500; opacity: 0.85; }
    .adnn-admin-chat-title-text { min-width:0; display:block; }
    .adnn-admin-chat-title-text strong { display:block; font-size:16px; font-weight:400; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; letter-spacing: -0.01em; }
    .adnn-admin-chat-title-text small { display:block; margin-top:2px; color:var(--adnn-muted); font-size:11px; font-family: var(--font-mono, monospace); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    
    .adnn-designer-chat-panel { margin-top:34px; min-height:440px; display:grid; grid-template-rows:minmax(320px,1fr) auto; border:1px solid var(--adnn-line); border-radius:24px; overflow:hidden; background: transparent; }


    .adnn-chat-head-actions { display:flex; align-items:center; gap:8px; }
    .adnn-chat-call { width:36px; height:36px; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:var(--adnn-text); cursor:pointer; display:grid; place-items:center; font-size:15px; }
    .adnn-chat-call svg { width:18px; height:18px; display:block; }
    .adnn-chat-call:hover { background:var(--adnn-accent); color:#fff; }
    .adnn-chat-bubble.is-call-event { align-self:center; max-width:min(360px, 92%); text-align:center; border:1px solid var(--adnn-line); background:rgba(255,255,255,.045); color:var(--adnn-text); border-radius:18px; }
    .adnn-chat-bubble.is-call-event p { font-family:var(--font-mono, monospace); font-size:11px; letter-spacing:.02em; color:var(--adnn-text); }
    .adnn-call-overlay { position:fixed; inset:0; z-index:99999; pointer-events:none; background:transparent; padding:0; }
    .adnn-call-card { position:fixed; right:22px; bottom:22px; width:min(360px, calc(100vw - 28px)); max-height:calc(100dvh - 28px); overflow:auto; border:1px solid var(--adnn-line); border-radius:28px; background:rgba(18,18,22,.96); color:var(--adnn-text); box-shadow:0 30px 90px rgba(0,0,0,.45); padding:18px; text-align:center; display:grid; gap:10px; pointer-events:auto; cursor:grab; }
    .adnn-call-card.is-dragging { cursor:grabbing; user-select:none; }
    .adnn-call-drag-handle { color:var(--adnn-muted); font-family:var(--font-mono, monospace); font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
    .adnn-call-avatar { width:70px; height:70px; margin:0 auto; border-radius:50%; display:grid; place-items:center; background:var(--adnn-accent); color:#fff; font-family:var(--font-mono, monospace); font-size:22px; letter-spacing:.08em; }
    .adnn-call-card strong { font-size:22px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-call-card small, .adnn-call-note { color:var(--adnn-muted); font-family:var(--font-mono, monospace); font-size:11px; line-height:1.5; }
    .adnn-call-card video { width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:20px; background:#000; }
    .adnn-call-card audio { display:none; }
    .adnn-call-controls, .adnn-call-incoming { display:flex; justify-content:center; gap:10px; margin-top:4px; flex-wrap:wrap; }
    .adnn-call-control { width:74px; min-height:62px; border:1px solid var(--adnn-line); border-radius:18px; background:rgba(255,255,255,.07); color:var(--adnn-text); cursor:pointer; display:grid; place-items:center; gap:4px; font-size:18px; }
    .adnn-call-control svg { width:22px; height:22px; display:block; }
    .adnn-call-control span { font-size:10px; font-family:var(--font-mono, monospace); color:var(--adnn-muted); }
    .adnn-call-control:hover, .adnn-call-control.is-on { background:var(--adnn-accent); color:#fff; }
    .adnn-call-control:hover span, .adnn-call-control.is-on span { color:rgba(255,255,255,.8); }
    .adnn-call-control.is-muted { opacity:.58; }
    .adnn-call-control.is-accept { background:#25d366; color:#fff; border-color:rgba(37,211,102,.55); }
    .adnn-call-control.is-accept span { color:rgba(255,255,255,.82); }
    .adnn-call-control.is-end { background:#ff3b30; color:#fff; border-color:rgba(255,59,48,.55); }
    .adnn-call-control.is-end span { color:rgba(255,255,255,.82); }

    .adnn-direct-chat-panel { height:min(680px, calc(100dvh - 230px)); min-height:520px; display:grid; grid-template-columns:minmax(260px,.36fr) minmax(0,1fr); border:1px solid var(--adnn-line); border-radius:24px; overflow:hidden; background:transparent; }
    .adnn-direct-list { min-height:0; overflow:auto; padding:8px; border-right:1px solid var(--adnn-line); }
    .adnn-direct-user { width:100%; border:0; border-radius:16px; padding:10px 12px; display:grid; grid-template-columns:42px minmax(0,1fr); gap:12px; align-items:center; color:var(--adnn-text); background:transparent; text-align:left; cursor:pointer; margin-bottom:4px; }
    .adnn-direct-user:hover, .adnn-direct-user.is-active { background:rgba(255,255,255,.055); }
    .adnn-direct-user-avatar, .adnn-direct-avatar { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; background:var(--adnn-accent); color:#fff; font-family:var(--font-mono, monospace); font-size:12px; }
    .adnn-direct-user strong, .adnn-direct-user small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-direct-user strong { font-size:14px; font-weight:500; }
    .adnn-direct-user small { margin-top:3px; color:var(--adnn-muted); font-size:11px; }
    .adnn-direct-room { min-width:0; min-height:0; display:grid; grid-template-rows:64px minmax(0,1fr) auto; }
    .adnn-direct-title { min-height:64px; padding:0 16px; display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--adnn-line); color:var(--adnn-text); }
    .adnn-direct-title-copy { min-width:0; flex:1; display:block; }
    .adnn-direct-title-copy strong, .adnn-direct-title-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-direct-title-copy strong { font-size:16px; font-weight:500; }
    .adnn-direct-title-copy small { margin-top:2px; color:var(--adnn-muted); font-size:11px; font-family:var(--font-mono, monospace); }
    .adnn-direct-back { display:none; width:34px; height:34px; border:1px solid var(--adnn-line); border-radius:50%; background:rgba(255,255,255,.04); color:var(--adnn-text); font-size:24px; line-height:1; }
    .adnn-direct-actions { display:flex; align-items:center; gap:8px; }
    @media (max-width: 760px) {
      .adnn-call-card { width:min(340px, calc(100vw - 20px)); right:10px; bottom:10px; padding:14px; border-radius:22px; gap:8px; }
      .adnn-call-avatar { width:54px; height:54px; font-size:17px; }
      .adnn-call-card strong { font-size:18px; }
      .adnn-call-card video { border-radius:16px; max-height:34dvh; }
      .adnn-call-control { width:64px; min-height:56px; border-radius:16px; }
      .adnn-call-control svg { width:20px; height:20px; }
      .adnn-direct-chat-panel { height:calc(100dvh - 110px); min-height:0; grid-template-columns:1fr; border-radius:0; border-left:0; border-right:0; margin:0 calc(-1 * clamp(16px, 3.5vw, 44px)); }
      .adnn-direct-list { border-right:0; }
      .adnn-direct-room { display:none; }
      body.adnn-direct-chat-open .adnn-direct-list { display:none; }
      body.adnn-direct-chat-open .adnn-direct-room { display:grid; }
      .adnn-direct-back { display:grid; place-items:center; }
    }

    :root.light-theme {
      --adnn-muted: rgba(11, 11, 13, 0.62);
      --adnn-line: rgba(0, 0, 0, 0.08);
      --adnn-panel-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.56));
      --adnn-bubble-mine: linear-gradient(135deg, rgba(39, 45, 207, 0.9), rgba(20, 25, 160, 0.8));
      --adnn-bubble-other: rgba(0, 0, 0, 0.03);
      --adnn-text: #0b0b0d;
    }
    :root.light-theme .adnn-chat-bubble.is-mine { color:#fff; }
    :root.light-theme .adnn-chat-form input { background: #fff; color:#111b21; border:1px solid rgba(17,27,33,.08); }
    :root.light-theme .adnn-admin-chat-item.is-active { background: rgba(0, 0, 0, 0.03); }

    @media (max-width: 760px) {
      .adnn-admin-chat-panel { height:calc(100vh - 89px); min-height:0; border-radius:0 !important; margin:0 calc(-1 * clamp(16px, 3.5vw, 44px)); border-left:0 !important; border-right:0 !important; border-bottom: 0 !important; }
      .adnn-admin-chat-appbar { display:none; }
      .adnn-admin-chat-grid { height:100%; grid-template-columns:1fr; }
      .adnn-admin-chat-list { border-right:0; height:100%; display:block; }
      .adnn-admin-chat-room { height:100%; display:none; border-left: 0; }
      body.adnn-admin-chat-open .adnn-admin-chat-list { display:none; }
      body.adnn-admin-chat-open .adnn-admin-chat-room { display:grid; }
      .adnn-admin-chat-back { display:grid; }
      .adnn-admin-chat-title { min-height:60px; padding:0 12px; gap:10px; }
      .adnn-admin-chat-avatar { width:38px; height:38px; }
      .adnn-chat-bubble { max-width:82%; }
      .adnn-admin-chat-panel { height:calc(100dvh - 65px) !important; max-height:calc(100dvh - 65px) !important; min-height:0; overflow:hidden; }
      .adnn-admin-chat-room { grid-template-rows:60px minmax(0,1fr) auto !important; min-height:0; }
      .adnn-admin-chat-room .adnn-chat-form { position:sticky; bottom:0; z-index:4; padding-bottom:calc(10px + env(safe-area-inset-bottom)); }
      .adnn-chat-form { grid-template-columns:42px minmax(0,1fr) 42px; }
      .adnn-chat-form input { height:42px; border-radius: 14px; }
      .adnn-chat-form button, .adnn-chat-media { width:42px; height:42px; }
      .admin-main-viewport:has(#adnnAdminChatPanel) { overflow:hidden; padding-bottom:0 !important; }
    }
  `;
  document.head.appendChild(style);
}

function initialsFromName(value) {
  const parts = String(value || "AD").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "A";
  const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) || "D";
  return `${first}${second}`.toUpperCase();
}

function supportChatId(uid) {
  return `support_${uid}`;
}

function isPublicIndexPage() {
  const page = location.pathname.split("/").pop() || "index.html";
  return page === "index.html" || page === "";
}

function getCachedDesignerUser() {
  try {
    return JSON.parse(localStorage.getItem("adnnDesignerUser") || "null");
  } catch {
    return null;
  }
}

function maybeOpenClientChatFromHash() {
  if (!activeUser || !(location.pathname.includes("account.html") || location.pathname.includes("designer-account.html"))) return;
  if (location.hash === "#admin-support" || location.hash === "#support") {
    window.setTimeout(openClientChat, 180);
  }
}

function wireFilePreview(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  const mediaButton = input?.closest(".adnn-chat-media");
  if (!input || !label || input.dataset.filePreviewReady === "true") return;
  input.dataset.filePreviewReady = "true";

  mediaButton?.addEventListener("click", (event) => {
    if (!mediaButton.classList.contains("has-file")) return;
    event.preventDefault();
    event.stopPropagation();
    input.value = "";
    clearFilePreview(labelId);
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    if (!file) {
      clearFilePreview(labelId);
      return;
    }

    if (label.dataset.previewUrl) {
      URL.revokeObjectURL(label.dataset.previewUrl);
      delete label.dataset.previewUrl;
    }

    const safeName = escapeHtml(file.name || "Attachment selected");
    const sizeMb = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    let preview = `<span class="adnn-file-icon">+</span>`;
    if (file.type?.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      label.dataset.previewUrl = url;
      preview = `<img src="${url}" alt="Selected file preview">`;
    }

    label.innerHTML = `${preview}<span class="adnn-file-copy"><strong>${safeName}</strong><small>Tap × to remove · ${sizeMb}</small></span>`;
    label.hidden = false;
    mediaButton?.classList.add("has-file");
    mediaButton?.setAttribute("title", "Remove selected file");
    mediaButton?.setAttribute("aria-label", "Remove selected file");
  });
}

function clearFilePreview(labelId) {
  const label = document.getElementById(labelId);
  if (!label) return;
  if (label.dataset.previewUrl) {
    URL.revokeObjectURL(label.dataset.previewUrl);
    delete label.dataset.previewUrl;
  }
  const mediaButton = label.closest(".adnn-chat-media");
  label.textContent = "";
  label.hidden = true;
  mediaButton?.classList.remove("has-file");
  mediaButton?.setAttribute("title", "Add media");
  mediaButton?.setAttribute("aria-label", "Add media");
}

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return emailKey(email) === ADMIN_EMAIL;
}

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function relativeTime(value) {
  const millis = toMillis(value);
  if (!millis) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
