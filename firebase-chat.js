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
  getFirestore,
  increment,
  arrayUnion,
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
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

let activeUser = null;
let clientChatId = "";
let clientChatUnsubscribe = null;
let clientMessagesUnsubscribe = null;
let adminChatsUnsubscribe = null;
let adminMessagesUnsubscribe = null;
let selectedAdminChatId = "";
let selectedAdminChat = null;
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
let clientChatMode = "support";
let designerChatMode = "lounge";
let selectedClientPeer = null;
let selectedDesignerPeer = null;
let userDirectoryUnsubscribes = [];
let clientPeerSearchTerm = "";
let designerPeerSearchTerm = "";

if (auth && db) {
  installChatStyles();
  installClientChatShell();
  if (location.pathname.includes("admin.html")) installAdminChatPanel();
  if (location.pathname.includes("designer-account.html")) installDesignerChatPanel();
  window.addEventListener("adnnDesignerFirebaseReady", () => {
    if (location.pathname.includes("designer-account.html") && auth.currentUser) {
      getDesignerProfile(auth.currentUser).then((designer) => {
        if (!designer) return;
        ensureDesignerRoom(auth.currentUser, designer).catch(() => {});
        startDesignerChat(auth.currentUser, designer);
      }).catch(() => {});
    }
  });

  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    updateClientChatVisibility(user);
    if (!user) {
      stopClientChat();
      stopAdminChat();
      stopDesignerChat();
      return;
    }

    if (isAdminEmail(user.email) && location.pathname.includes("admin.html")) {
      startAdminChat();
      return;
    }

    if (location.pathname.includes("designer-account.html")) {
      stopClientChat();
      const designer = await getDesignerProfile(user).catch(() => null);
      if (designer) {
        await syncChatUserProfile(user, "designer", designer).catch(() => {});
        await ensureDesignerRoom(user, designer).catch(() => {});
        startDesignerChat(user, designer);
      } else {
        activeDesignerProfile = null;
        renderDesignerChatStatus("Sign in to open designer chat.");
      }
      return;
    }

    if (!isAdminEmail(user.email)) {
      const designer = await getDesignerProfile(user).catch(() => null);
      if (designer) {
        activeDesignerProfile = designer;
        await syncChatUserProfile(user, "designer", designer).catch(() => {});
        stopClientChat();
        return;
      }
      await syncChatUserProfile(user, "client", null).catch(() => {});
      await ensureClientChat(user).catch(() => {});
      startClientChat(user);
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
  drawer.className = "adnn-chat-drawer adnn-user-chat-panel";
  drawer.setAttribute("aria-hidden", "true");
  drawer.innerHTML = `
    <div class="adnn-admin-chat-appbar adnn-user-chat-appbar">
      <div>
        <p class="kicker">Studio chat</p>
        <strong>Messages</strong>
      </div>
      <span>Account Console</span>
      <button type="button" class="adnn-chat-close" aria-label="Close chat">×</button>
    </div>
    <div class="adnn-admin-chat-grid adnn-user-chat-grid">
      <div class="adnn-admin-chat-list adnn-user-chat-list-shell">
        <div class="adnn-user-search-wrap">
          <input id="adnnClientPeerSearch" class="adnn-user-search" type="search" autocomplete="off" placeholder="Search users by name">
        </div>
        <div class="adnn-user-chat-list" id="adnnClientPeerList"></div>
      </div>
      <div class="adnn-admin-chat-room adnn-user-chat-room">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnClientChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnClientChatAvatar">AS</span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnClientChatTitle">AdnnStudio</strong>
            <small id="adnnClientChatSubtitle">Admin support</small>
          </span>
        </div>
        <div class="adnn-chat-messages" id="adnnChatMessages">
          <div class="adnn-chat-empty">No messages yet.</div>
        </div>
        <form class="adnn-chat-form" id="adnnChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="adnn-chat-file-name" id="adnnChatFileName" hidden></span>
          </label>
          <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Message">
          <button type="submit" aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
    </div>
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
  drawer.querySelector("#adnnClientChatBack")?.addEventListener("click", () => document.body.classList.remove("adnn-user-chat-open"));
  drawer.querySelector("#adnnChatForm")?.addEventListener("submit", sendClientMessage);
  drawer.querySelector("#adnnClientPeerSearch")?.addEventListener("input", (event) => {
    clientPeerSearchTerm = String(event.target.value || "").trim().toLowerCase();
    renderClientPeerSelection();
  });
  wireFilePreview("adnnChatFile", "adnnChatFileName");
  updateClientChatHeader();
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
  clientChatMode = "support";
  selectedClientPeer = null;
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
  clientChatMode = "support";
  selectedClientPeer = null;
  clientChatId = supportChatId(user.uid);
  const chatRef = doc(db, "chats", clientChatId);
  clientChatUnsubscribe = onSnapshot(chatRef, (snap) => {
    const data = snap.data() || {};
    setClientUnread(data.unreadForClient || 0);
  });
  subscribeClientMessages(user);
  startUserDirectory(user, "client");
  renderClientPeerSelection();
  updateClientChatHeader();
  maybeOpenClientChatFromHash();
}

function subscribeClientMessages(user) {
  if (clientMessagesUnsubscribe) clientMessagesUnsubscribe();
  firstClientMessagesSnapshot = true;
  knownClientMessageIds = new Set();
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
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], clientChatMode === "direct" ? "User message" : "New message");
    if (document.getElementById("adnnChatDrawer")?.classList.contains("is-open")) markClientChatRead();
  });
}

function stopClientChat() {
  if (clientChatUnsubscribe) clientChatUnsubscribe();
  if (clientMessagesUnsubscribe) clientMessagesUnsubscribe();
  clientChatUnsubscribe = null;
  clientMessagesUnsubscribe = null;
  firstClientMessagesSnapshot = true;
  knownClientMessageIds = new Set();
  setClientUnread(0);
  stopUserDirectory();
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
  if (clientChatMode === "support") await ensureClientChat(activeUser);
  else if (selectedClientPeer) await ensureDirectChat(activeUser, selectedClientPeer, "client");
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
  const chatUpdate = {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp()
  };
  if (clientChatMode === "support") chatUpdate.unreadForAdmin = increment(1);
  else chatUpdate.unreadForPeer = increment(1);
  await setDoc(doc(db, "chats", clientChatId), chatUpdate, { merge: true });
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
    empty.textContent = "No messages yet.";
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
  if (!badge) return;
  badge.textContent = String(value);
  badge.hidden = value <= 0;
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
  panel.className = "adnn-designer-chat-panel adnn-user-chat-panel";
  panel.innerHTML = `
    <div class="adnn-admin-chat-appbar adnn-user-chat-appbar">
      <div>
        <p class="kicker">Studio chat</p>
        <strong>Messages</strong>
      </div>
      <span>Designer Console</span>
    </div>
    <div class="adnn-admin-chat-grid adnn-user-chat-grid">
      <div class="adnn-admin-chat-list adnn-user-chat-list-shell">
        <div class="adnn-user-search-wrap">
          <input id="adnnDesignerPeerSearch" class="adnn-user-search" type="search" autocomplete="off" placeholder="Search users by name">
        </div>
        <div class="adnn-user-chat-list" id="adnnDesignerPeerList"></div>
      </div>
      <div class="adnn-admin-chat-room adnn-user-chat-room">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnDesignerChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnDesignerChatAvatar">DL</span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnDesignerChatTitle">Designer Lounge</strong>
            <small id="adnnDesignerChatSubtitle">Designer group chat</small>
          </span>
        </div>
        <div class="adnn-chat-messages" id="adnnDesignerMessages">
          <div class="adnn-chat-empty">Sign in to open designer chat.</div>
        </div>
        <form class="adnn-chat-form" id="adnnDesignerChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnDesignerChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="adnn-chat-file-name" id="adnnDesignerChatFileName" hidden></span>
          </label>
          <input id="adnnDesignerChatInput" autocomplete="off" maxlength="1800" placeholder="Message">
          <button type="submit" aria-label="Send designer message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
  view.appendChild(panel);
  document.getElementById("adnnDesignerChatForm")?.addEventListener("submit", sendDesignerMessage);
  document.getElementById("adnnDesignerChatBack")?.addEventListener("click", () => document.body.classList.remove("adnn-user-chat-open"));
  document.getElementById("adnnDesignerPeerSearch")?.addEventListener("input", (event) => {
    designerPeerSearchTerm = String(event.target.value || "").trim().toLowerCase();
    renderDesignerPeerSelection();
  });
  wireFilePreview("adnnDesignerChatFile", "adnnDesignerChatFileName");
  updateDesignerChatHeader();
}

async function getDesignerProfile(user) {
  if (!user?.uid) return null;
  const snap = await getDoc(doc(db, "designers", user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function ensureDesignerRoom(user, designer) {
  designerChatMode = "lounge";
  selectedDesignerPeer = null;
  designerChatId = "designer_lounge";
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
  designerChatMode = "lounge";
  selectedDesignerPeer = null;
  designerChatId = "designer_lounge";
  startUserDirectory(user, "designer");
  renderDesignerPeerSelection();
  updateDesignerChatHeader();
  subscribeDesignerMessages(user);
}

function subscribeDesignerMessages(user) {
  if (designerMessagesUnsubscribe) designerMessagesUnsubscribe();
  firstDesignerMessagesSnapshot = true;
  knownDesignerMessageIds = new Set();
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
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], designerChatMode === "direct" ? "User message" : "Designer chat");
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
  stopUserDirectory();
}


function renderDesignerMessages(messages) {
  const wrap = document.getElementById("adnnDesignerMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    wrap.innerHTML = `<div class="adnn-chat-empty">No messages yet.</div>`;
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
  if (designerChatMode === "lounge") await ensureDesignerRoom(activeUser, activeDesignerProfile || {});
  else if (selectedDesignerPeer) await ensureDirectChat(activeUser, selectedDesignerPeer, "designer");
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
  const chatUpdate = {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp()
  };
  if (designerChatMode === "lounge") chatUpdate.unreadForAdmin = increment(1);
  else chatUpdate.unreadForPeer = increment(1);
  await setDoc(doc(db, "chats", designerChatId), chatUpdate, { merge: true });
  input.value = "";
  if (fileInput) fileInput.value = "";
  clearFilePreview("adnnDesignerChatFileName");
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
    const preview = chat.lastMessage || chat.lastClientEmail || chat.clientEmail || "No messages yet";
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
  if (adminSubEl) adminSubEl.textContent = chat.clientEmail || chat.lastClientEmail || (chat.type === "all-users-room" ? "Account + Designer users" : (chat.type === "designer-room" ? "Designer lounge" : "online"));

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
    if (incoming.length) showChatAlert(incoming[incoming.length - 1], "User message");
  });
  setDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }, { merge: true }).catch(() => {});
}

function renderAdminMessages(messages) {
  const wrap = document.getElementById("adnnAdminMessages");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!messages.length) {
    wrap.innerHTML = `<div class="adnn-chat-empty">No messages yet.</div>`;
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
  bubble.className = `adnn-chat-bubble${mine ? " is-mine" : ""}`;
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
  text.textContent = message.text || "";
  time.textContent = relativeTime(message.createdAt);
  if (message.text) bubble.appendChild(text);
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
    
    .adnn-designer-chat-panel { margin-top:34px; min-height:440px; display:grid; grid-template-rows:auto auto minmax(320px,1fr) auto; border:1px solid var(--adnn-line); border-radius:24px; overflow:hidden; background: transparent; }
    .adnn-peer-search-wrap { padding:10px 10px 0; border-bottom:0; background:rgba(255,255,255,.025); }
    .adnn-peer-search { width:100%; height:38px; border:1px solid var(--adnn-line); border-radius:14px; padding:0 12px; background:rgba(255,255,255,.05); color:var(--adnn-text); outline:0; font-family:var(--font-body, ui-sans-serif, system-ui); font-size:13px; }
    .adnn-peer-search::placeholder { color:var(--adnn-muted); }
    .adnn-peer-search:focus { border-color:rgba(83,96,255,.55); box-shadow:0 0 0 3px rgba(39,45,207,.15); }
    .adnn-peer-list { display:flex; gap:8px; overflow-x:auto; padding:10px; border-bottom:1px solid var(--adnn-line); background:rgba(255,255,255,.025); }
    .adnn-peer-chip { flex:0 0 auto; min-height:34px; border:1px solid var(--adnn-line); border-radius:999px; padding:0 12px; background:rgba(255,255,255,.05); color:var(--adnn-text); font-family:var(--font-mono, ui-monospace, monospace); font-size:11px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
    .adnn-peer-chip strong { font-weight:500; }
    .adnn-peer-chip small { color:var(--adnn-muted); text-transform:capitalize; }
    .adnn-peer-chip.is-active { background:var(--accent, #272dcf); color:#fff; border-color:transparent; }
    .adnn-peer-chip.is-active small { color:rgba(255,255,255,.72); }
    .adnn-peer-empty { align-self:center; color:var(--adnn-muted); font-family:var(--font-mono, ui-monospace, monospace); font-size:11px; padding:8px 4px; }


    /* Account + Designer chat now uses the same admin-style two-column messaging layout. */
    #clientChatMount.adnn-designer-chat-panel {
      display:block !important;
      height:auto !important;
      min-height:0 !important;
      border:0 !important;
      border-radius:0 !important;
      overflow:visible !important;
      background:transparent !important;
      box-shadow:none !important;
    }
    .adnn-user-chat-panel {
      margin-top:22px !important;
      border:1px solid var(--adnn-line) !important;
      border-radius:28px !important;
      overflow:hidden !important;
      background:transparent !important;
      box-shadow:none !important;
      display:grid !important;
      grid-template-rows:auto minmax(0,1fr) !important;
      min-height:640px !important;
    }
    .adnn-chat-drawer.adnn-user-chat-panel.is-embedded {
      position:relative !important;
      right:auto !important;
      bottom:auto !important;
      width:100% !important;
      height:640px !important;
      min-height:640px !important;
      opacity:1 !important;
      transform:none !important;
      pointer-events:auto !important;
      backdrop-filter:none !important;
      -webkit-backdrop-filter:none !important;
    }
    .adnn-user-chat-appbar .adnn-chat-close {
      width:36px;
      height:36px;
      display:grid;
      place-items:center;
      margin-left:12px;
    }
    .adnn-chat-drawer.is-embedded .adnn-user-chat-appbar .adnn-chat-close { display:none !important; }
    .adnn-user-chat-grid {
      height:568px !important;
      min-height:0 !important;
      grid-template-columns:minmax(280px,.35fr) minmax(0,1fr) !important;
    }
    .adnn-user-chat-list-shell {
      display:grid !important;
      grid-template-rows:auto minmax(0,1fr) !important;
      padding:0 !important;
    }
    .adnn-user-search-wrap {
      padding:12px !important;
      border-bottom:1px solid var(--adnn-line) !important;
      background:rgba(255,255,255,.015) !important;
    }
    .adnn-user-search {
      width:100% !important;
      height:42px !important;
      border:1px solid var(--adnn-line) !important;
      border-radius:16px !important;
      padding:0 14px !important;
      background:rgba(255,255,255,.045) !important;
      color:var(--adnn-text) !important;
      outline:0 !important;
      font-family:var(--font-body, ui-sans-serif, system-ui) !important;
      font-size:13px !important;
    }
    .adnn-user-search::placeholder { color:var(--adnn-muted) !important; }
    .adnn-user-search:focus { border-color:rgba(83,96,255,.55) !important; box-shadow:0 0 0 3px rgba(39,45,207,.15) !important; }
    .adnn-user-chat-list {
      overflow:auto !important;
      padding:8px !important;
    }
    .adnn-user-list-empty {
      margin:14px 10px !important;
      min-height:42px !important;
      display:grid !important;
      place-items:center !important;
      border:0 !important;
      background:transparent !important;
    }
    .adnn-user-chat-room .adnn-chat-messages {
      border:0 !important;
      border-radius:0 !important;
      background:transparent !important;
    }
    @media (max-width:820px) {
      .adnn-user-chat-panel { min-height:620px !important; }
      .adnn-user-chat-grid { grid-template-columns:1fr !important; height:548px !important; }
      .adnn-user-chat-room { display:none !important; }
      body.adnn-user-chat-open .adnn-user-chat-list-shell { display:none !important; }
      body.adnn-user-chat-open .adnn-user-chat-room { display:grid !important; }
      .adnn-user-chat-room .adnn-admin-chat-back { display:grid !important; }
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


async function syncChatUserProfile(user, role, profile) {
  if (!user?.uid) return;
  const displayName = profile?.name || profile?.displayName || profile?.designerName || user.displayName || user.email || (role === "designer" ? "Designer" : "Account");
  await setDoc(doc(db, "chatUsers", user.uid), {
    uid: user.uid,
    email: emailKey(user.email),
    name: displayName,
    nameLower: String(displayName || "").toLowerCase(),
    role: role === "designer" ? "designer" : "account",
    photo: user.photoURL || profile?.photo || profile?.photoURL || "",
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}

function startUserDirectory(user, mode) {
  stopUserDirectory();
  const render = () => mode === "designer" ? renderDesignerPeerSelection() : renderClientPeerSelection();
  window.adnnChatDirectory = { users: [] };
  userDirectoryUnsubscribes = [
    onSnapshot(collection(db, "chatUsers"), (snapshot) => {
      window.adnnChatDirectory.users = snapshot.docs.map((snap) => normalizeDirectoryUser(snap, "user"));
      render();
    }, () => render())
  ];
}

function stopUserDirectory() {
  userDirectoryUnsubscribes.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });
  userDirectoryUnsubscribes = [];
}

function normalizeDirectoryUser(docSnap, role) {
  const data = docSnap.data() || {};
  const email = emailKey(data.email || data.authEmail || data.displayEmail || "");
  const itemRole = data.role || role || "user";
  return {
    uid: data.uid || data.authUid || data.userUid || docSnap.id,
    email,
    name: data.name || data.displayName || data.clientName || data.designerName || data.displayEmail || data.email || data.authEmail || (itemRole === "designer" ? "Designer" : "Account"),
    role: itemRole
  };
}

function getAvailableChatUsers() {
  const directory = window.adnnChatDirectory || { users: [] };
  const currentUid = activeUser?.uid || "";
  const currentEmail = emailKey(activeUser?.email);
  const merged = (directory.users || [])
    .filter((item) => item.uid && item.uid !== currentUid && emailKey(item.email) !== currentEmail);
  const seen = new Set();
  return merged.filter((item) => {
    const key = item.uid || item.email;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
}

function renderClientPeerSelection() {
  const wrap = document.getElementById("adnnClientPeerList");
  if (!wrap) return;
  renderPeerButtons(wrap, "client");
}

function renderDesignerPeerSelection() {
  const wrap = document.getElementById("adnnDesignerPeerList");
  if (!wrap) return;
  renderPeerButtons(wrap, "designer");
}

function renderPeerButtons(wrap, mode) {
  const term = mode === "designer" ? designerPeerSearchTerm : clientPeerSearchTerm;
  const users = getAvailableChatUsers().filter((peer) => {
    if (!term) return true;
    return [peer.name, peer.email, peer.role].some((value) => String(value || "").toLowerCase().includes(term));
  });
  const defaultLabel = mode === "designer" ? "Designer Lounge" : "AdnnStudio";
  const defaultPreview = mode === "designer" ? "Designer group chat" : "Admin support";
  const activeDefault = mode === "designer" ? designerChatMode === "lounge" : clientChatMode === "support";
  wrap.innerHTML = "";

  wrap.appendChild(createPeerListItem({
    label: defaultLabel,
    preview: defaultPreview,
    role: mode === "designer" ? "lounge" : "support",
    active: activeDefault,
    onClick: () => mode === "designer" ? openDesignerLounge() : openClientSupport()
  }));

  if (!users.length && term) {
    const empty = document.createElement("div");
    empty.className = "adnn-chat-empty adnn-user-list-empty";
    empty.textContent = "No matching users";
    wrap.appendChild(empty);
    return;
  }

  users.forEach((peer) => {
    const active = mode === "designer" ? selectedDesignerPeer?.uid === peer.uid : selectedClientPeer?.uid === peer.uid;
    wrap.appendChild(createPeerListItem({
      label: peer.name || peer.email || "User",
      preview: peer.role || peer.email || "user",
      role: peer.role || "user",
      active,
      onClick: () => mode === "designer" ? openDesignerDirectChat(peer) : openClientDirectChat(peer)
    }));
  });
}

function createPeerListItem({ label, preview, role, active, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `adnn-admin-chat-item adnn-user-chat-item${active ? " is-active" : ""}`;
  button.innerHTML = `
    <span>
      <strong>${escapeHtml(label || "User")}</strong>
      <small>${escapeHtml(preview || role || "online")}</small>
    </span>
  `;
  button.addEventListener("click", () => {
    if (typeof onClick === "function") onClick();
    document.body.classList.add("adnn-user-chat-open");
  });
  return button;
}

function updateClientChatHeader() {
  const title = document.getElementById("adnnClientChatTitle");
  const subtitle = document.getElementById("adnnClientChatSubtitle");
  const avatar = document.getElementById("adnnClientChatAvatar");
  const label = clientChatMode === "direct" && selectedClientPeer ? (selectedClientPeer.name || selectedClientPeer.email || "User") : "AdnnStudio";
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = clientChatMode === "direct" && selectedClientPeer ? `${selectedClientPeer.role || "user"} • direct message` : "Admin support";
  if (avatar) avatar.textContent = initialsFromName(label);
}

function updateDesignerChatHeader() {
  const title = document.getElementById("adnnDesignerChatTitle");
  const subtitle = document.getElementById("adnnDesignerChatSubtitle");
  const avatar = document.getElementById("adnnDesignerChatAvatar");
  const label = designerChatMode === "direct" && selectedDesignerPeer ? (selectedDesignerPeer.name || selectedDesignerPeer.email || "User") : "Designer Lounge";
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = designerChatMode === "direct" && selectedDesignerPeer ? `${selectedDesignerPeer.role || "user"} • direct message` : "Designer group chat";
  if (avatar) avatar.textContent = initialsFromName(label);
}

async function openClientSupport() {
  if (!activeUser) return;
  clientChatMode = "support";
  selectedClientPeer = null;
  clientChatId = supportChatId(activeUser.uid);
  await ensureClientChat(activeUser).catch(() => {});
  subscribeClientMessages(activeUser);
  renderClientPeerSelection();
  updateClientChatHeader();
}

async function openClientDirectChat(peer) {
  if (!activeUser || !peer?.uid) return;
  clientChatMode = "direct";
  selectedClientPeer = peer;
  clientChatId = directChatId(activeUser.uid, peer.uid);
  await ensureDirectChat(activeUser, peer, "client").catch(() => {});
  subscribeClientMessages(activeUser);
  renderClientPeerSelection();
  updateClientChatHeader();
}

async function openDesignerLounge() {
  if (!activeUser) return;
  designerChatMode = "lounge";
  selectedDesignerPeer = null;
  designerChatId = "designer_lounge";
  await ensureDesignerRoom(activeUser, activeDesignerProfile || {}).catch(() => {});
  subscribeDesignerMessages(activeUser);
  renderDesignerPeerSelection();
  updateDesignerChatHeader();
}

async function openDesignerDirectChat(peer) {
  if (!activeUser || !peer?.uid) return;
  designerChatMode = "direct";
  selectedDesignerPeer = peer;
  designerChatId = directChatId(activeUser.uid, peer.uid);
  await ensureDirectChat(activeUser, peer, "designer").catch(() => {});
  subscribeDesignerMessages(activeUser);
  renderDesignerPeerSelection();
  updateDesignerChatHeader();
}

async function ensureDirectChat(user, peer, senderRole) {
  const chatId = directChatId(user.uid, peer.uid);
  const currentName = senderRole === "designer"
    ? (activeDesignerProfile?.name || user.displayName || user.email || "Designer")
    : (user.displayName || user.email || "Client");
  await setDoc(doc(db, "chats", chatId), {
    type: "direct",
    title: `${currentName} / ${peer.name || peer.email || "User"}`,
    participantUids: arrayUnion(user.uid, peer.uid),
    participantEmails: arrayUnion(emailKey(user.email), emailKey(peer.email)),
    participantLabels: arrayUnion(currentName, peer.name || peer.email || "User"),
    adminEmail: ADMIN_EMAIL,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
  return chatId;
}

function directChatId(uidA, uidB) {
  return `direct_${[uidA, uidB].map((value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "")).sort().join("_")}`;
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
  if (!activeUser || activeDesignerProfile || !location.pathname.includes("account.html")) return;
  if (location.hash === "#chat") {
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
