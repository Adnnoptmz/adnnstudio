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
        await ensureDesignerRoom(user, designer).catch(() => {});
        startDesignerChat(user, designer);
      } else {
        activeDesignerProfile = null;
        renderDesignerChatStatus("Designer Firebase access is not connected yet.");
      }
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
      <button type="button" class="adnn-chat-close" aria-label="Close chat">×</button>
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
      <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Type a message">
      <button type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; display: block;">
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>
      </button>
    </form>
  `;

  document.body.appendChild(drawer);
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
  trigger.hidden = !hasUser || hideOnAdminPanel || hideOnDesignerPanel;
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
      <span>WhatsApp style</span>
    </div>
    <div class="adnn-admin-chat-grid" id="adnnAdminChatGrid">
      <div class="adnn-admin-chat-list" id="adnnAdminChatList">
        <div class="adnn-chat-empty">Waiting for chats.</div>
      </div>
      <div class="adnn-admin-chat-room" id="adnnAdminChatRoom">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnAdminChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnAdminChatAvatar">AD</span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnAdminChatTitle">Select a client</strong>
            <small id="adnnAdminChatSubtitle">Choose a chat to reply</small>
          </span>
        </div>
        <div class="adnn-chat-messages" id="adnnAdminMessages">
          <div class="adnn-chat-empty">Choose a chat to reply.</div>
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
  wireFilePreview("adnnAdminChatFile", "adnnAdminChatFileName");
}

async function startAdminChat() {
  const adminDoc = await getDoc(doc(db, "admins", activeUser.uid)).catch(() => null);
  if (!adminDoc?.exists()) {
    renderAdminChatStatus("Admin Firebase access missing.");
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
  panel.className = "adnn-designer-chat-panel";
  panel.innerHTML = `
    <div class="adnn-chat-messages" id="adnnDesignerMessages">
      <div class="adnn-chat-empty">Designer chat connects after Firebase designer login.</div>
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
    wrap.innerHTML = `<div class="adnn-chat-empty">No designer messages yet.</div>`;
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
    const preview = chat.lastMessage || chat.clientEmail || "No messages yet";
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
  document.getElementById("adnnAdminChatTitle").textContent = chatLabel;
  document.getElementById("adnnAdminChatSubtitle").textContent = chat.clientEmail || (chat.type === "designer-room" ? "Designer lounge" : "online");
  document.getElementById("adnnAdminChatAvatar").textContent = initialsFromName(chatLabel);
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
  if (!storage) throw new Error("Firebase Storage is not connected.");
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
      --adnn-wa-green: #272dcf;
      --adnn-wa-dark: #0b141a;
      --adnn-wa-panel: #111b21;
      --adnn-wa-panel-2: #202c33;
      --adnn-wa-incoming: #202c33;
      --adnn-wa-outgoing: #272dcf;
      --adnn-wa-text: #e9edef;
      --adnn-wa-muted: #8696a0;
      --adnn-wa-line: rgba(134,150,160,.22);
      --adnn-wa-blue: #53bdeb;
    }

    .adnn-chat-trigger {
      width: 44px;
      height: 44px;
      min-width: 44px;
      padding: 0;
      justify-content: center;
      position: relative;
      border: 0;
      border-radius: 50%;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      line-height: 1;
      text-decoration: none;
      background: #272dcf;
      box-shadow: 0 14px 36px rgba(39,45,207,.30);
    }
    .adnn-chat-trigger[hidden] { display: none !important; }
    .adnn-chat-trigger svg { width: 20px; height: 20px; }
    .adnn-chat-trigger.is-floating { position: fixed; right: 20px; bottom: 20px; z-index: 70; }
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
      border: 1px solid var(--adnn-wa-line);
      border-radius: 24px;
      overflow: hidden;
      background: var(--adnn-wa-dark);
      box-shadow: 0 28px 90px rgba(0,0,0,.46);
      opacity: 0;
      transform: translateY(18px) scale(.98);
      pointer-events: none;
      transition: opacity .25s ease, transform .3s cubic-bezier(.16,1,.3,1);
    }
    .adnn-chat-drawer.is-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .adnn-chat-head {
      min-height: 64px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--adnn-wa-line);
      color: var(--adnn-wa-text);
      background: var(--adnn-wa-panel-2);
    }
    .adnn-chat-head span { display:block; color: var(--adnn-wa-muted); font-size: 11px; margin-bottom: 2px; }
    .adnn-chat-head strong { font-size: 16px; font-weight: 600; }
    .adnn-chat-close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: transparent; color: var(--adnn-wa-text); cursor: pointer; font-size: 24px; }

    .adnn-chat-messages {
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 18px 5.8%;
      color: var(--adnn-wa-text);
      background:
        radial-gradient(circle at 20px 20px, rgba(255,255,255,.035) 1px, transparent 1.5px),
        #0b141a;
      background-size: 38px 38px, auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(134,150,160,.45) transparent;
    }
    .adnn-chat-messages::-webkit-scrollbar { width: 6px; }
    .adnn-chat-messages::-webkit-scrollbar-thumb { background: rgba(134,150,160,.36); border-radius: 999px; }
    .adnn-chat-empty { margin: auto; color: var(--adnn-wa-muted); font-size: 13px; text-align:center; }

    .adnn-chat-bubble {
      max-width: min(68%, 620px);
      align-self: flex-start;
      position: relative;
      border-radius: 7.5px;
      padding: 6px 8px 5px;
      background: var(--adnn-wa-incoming);
      color: var(--adnn-wa-text);
      box-shadow: 0 1px 1px rgba(0,0,0,.18);
      margin: 1px 0;
    }
    .adnn-chat-bubble.is-mine { align-self: flex-end; background: var(--adnn-wa-outgoing); }
    .adnn-chat-bubble p { margin: 0; font-size: 14.2px; line-height: 1.38; overflow-wrap: anywhere; padding-right: 42px; }
    .adnn-chat-bubble span { display:block; margin-top: 2px; color: rgba(233,237,239,.62); font-size: 10.5px; text-align:right; line-height:1; }
    .adnn-chat-sender { display:block; margin-bottom: 3px; color: var(--adnn-wa-blue); font-size: 12px; font-weight: 600; }
    .adnn-chat-attachment { display:block; margin-bottom: 6px; max-width:100%; color:#d9fdd3; text-decoration: underline; text-underline-offset: 3px; overflow-wrap:anywhere; font-size:13px; }
    .adnn-chat-attachment.is-image { text-decoration: none; }
    .adnn-chat-attachment img { display:block; width:100%; max-height:240px; object-fit:cover; border-radius:8px; }
    .adnn-chat-delete { width: 26px; height: 26px; margin-top: 4px; border:0; border-radius:50%; display:grid; place-items:center; color: rgba(233,237,239,.75); background: rgba(0,0,0,.16); cursor:pointer; opacity:0; transition: opacity .2s ease, background .2s ease; }
    .adnn-chat-bubble:hover .adnn-chat-delete, .adnn-chat-delete:focus-visible { opacity: 1; }
    .adnn-chat-delete:hover { background: rgba(255,38,2,.45); color:#fff; }
    .adnn-chat-delete svg { width:14px; height:14px; }

    .adnn-chat-form {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--adnn-wa-line);
      background: var(--adnn-wa-panel);
      align-items: end;
    }
    .adnn-chat-media { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; position:relative; background: transparent; color: var(--adnn-wa-muted); cursor:pointer; border:0; }
    .adnn-chat-media input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
    .adnn-chat-media svg { width:22px; height:22px; transition: transform .22s ease; }
    .adnn-chat-media.has-file { color:#fff; background:#272dcf; }
    .adnn-chat-media.has-file svg { transform: rotate(45deg); }
    .adnn-chat-file-name { position:absolute; left:0; bottom:calc(100% + 9px); width:max-content; max-width:min(280px, calc(100vw - 48px)); min-height:42px; padding:7px 10px 7px 8px; border-radius:16px; color:#fff; background:#272dcf; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; box-shadow:0 14px 34px rgba(39,45,207,.30); display:flex; align-items:center; gap:8px; }
    .adnn-chat-file-name img { width:30px; height:30px; border-radius:10px; object-fit:cover; background:rgba(255,255,255,.16); }
    .adnn-chat-file-name .adnn-file-icon { width:30px; height:30px; border-radius:10px; display:grid; place-items:center; background:rgba(255,255,255,.16); font-weight:700; }
    .adnn-chat-file-name .adnn-file-copy { min-width:0; max-width:210px; display:flex; flex-direction:column; gap:2px; overflow:hidden; }
    .adnn-chat-file-name .adnn-file-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:600; }
    .adnn-chat-file-name .adnn-file-copy small { opacity:.74; font-size:9px; }
    .adnn-chat-file-name[hidden] { display:none !important; }
    .adnn-chat-form input { min-width:0; height:44px; border:0; border-radius:999px; padding:0 16px; background:#2a3942; color:var(--adnn-wa-text); outline:0; font-size:14px; }
    .adnn-chat-form input::placeholder { color: var(--adnn-wa-muted); }
    .adnn-chat-form button { width:44px; height:44px; border:0; border-radius:50%; display:grid; place-items:center; background:#272dcf; color:#fff; cursor:pointer; }
    .adnn-chat-form button svg { width:19px; height:19px; }

    .adnn-chat-alert { position:fixed; right:clamp(16px,4vw,34px); bottom:clamp(18px,4vw,34px); z-index:10000; width:min(320px, calc(100vw - 32px)); border:1px solid var(--adnn-wa-line); border-radius:16px; padding:12px 14px; color:var(--adnn-wa-text); background:var(--adnn-wa-panel-2); box-shadow:0 24px 70px rgba(0,0,0,.34); opacity:0; transform:translateY(16px); pointer-events:none; transition:opacity .35s ease, transform .4s cubic-bezier(.16,1,.3,1); }
    .adnn-chat-alert.is-visible { opacity:1; transform:translateY(0); }
    .adnn-chat-alert span, .adnn-chat-alert strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-chat-alert span { color:var(--adnn-wa-green); font-size:11px; margin-bottom:4px; }
    .adnn-chat-alert strong { font-size:14px; font-weight:600; }

    .adnn-admin-chat-panel {
      margin-top: 0;
      height: min(760px, calc(100vh - 120px));
      min-height: 620px;
      border-radius: 0 !important;
      padding: 0 !important;
      overflow: hidden;
      background: var(--adnn-wa-dark) !important;
      border: 1px solid var(--adnn-wa-line) !important;
      box-shadow: 0 28px 80px rgba(0,0,0,.32) !important;
    }
    .adnn-admin-chat-appbar { height: 58px; display:flex; align-items:center; justify-content:space-between; padding:0 18px; background:var(--adnn-wa-panel); color:var(--adnn-wa-text); border-bottom:1px solid var(--adnn-wa-line); }
    .adnn-admin-chat-appbar .kicker { margin:0 0 2px; color:var(--adnn-wa-green) !important; font-size:10px; }
    .adnn-admin-chat-appbar strong { font-size:18px; font-weight:600; letter-spacing:-.02em; }
    .adnn-admin-chat-appbar > span { color:var(--adnn-wa-muted); font-size:12px; }
    .adnn-admin-chat-grid { display:grid; grid-template-columns: minmax(300px, 36%) minmax(0, 1fr); gap:0; margin:0; height:calc(100% - 58px); min-height:0; }
    .adnn-admin-chat-list, .adnn-admin-chat-room { min-height:0; border:0; border-radius:0; overflow:hidden; background:var(--adnn-wa-dark); box-shadow:none; }
    .adnn-admin-chat-list { display:block; overflow:auto; background:var(--adnn-wa-panel); border-right:1px solid var(--adnn-wa-line); padding:0; }
    .adnn-admin-chat-list::before { content:"Chats"; display:block; position:sticky; top:0; z-index:2; padding:13px 16px; color:var(--adnn-wa-text); background:var(--adnn-wa-panel); border-bottom:1px solid var(--adnn-wa-line); font-size:20px; font-weight:700; letter-spacing:-.03em; }
    .adnn-admin-chat-item { width:100%; min-height:72px; border:0; border-radius:0; padding:10px 14px 10px 72px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; color:var(--adnn-wa-text); background:transparent; text-align:left; cursor:pointer; position:relative; border-bottom:1px solid rgba(134,150,160,.12); }
    .adnn-admin-chat-item::before { content:""; position:absolute; left:16px; top:50%; width:44px; height:44px; border-radius:50%; transform:translateY(-50%); background:linear-gradient(135deg,#7d8a91,#4b5961); }
    .adnn-admin-chat-item::after { content:""; position:absolute; left:49px; bottom:17px; width:10px; height:10px; border-radius:50%; background:var(--adnn-wa-green); border:2px solid var(--adnn-wa-panel); }
    .adnn-admin-chat-item:hover, .adnn-admin-chat-item.is-active { background:#202c33; }
    .adnn-admin-chat-item strong, .adnn-admin-chat-item small { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-admin-chat-item strong { font-size:15px; font-weight:500; color:var(--adnn-wa-text); }
    .adnn-admin-chat-item small { margin-top:4px; color:var(--adnn-wa-muted); font-size:13px; }
    .adnn-admin-chat-item b { min-width:21px; height:21px; border-radius:999px; display:grid; place-items:center; background:#272dcf; color:#fff; font-size:11px; font-weight:700; }
    .adnn-admin-chat-room { display:grid; grid-template-rows:64px minmax(0,1fr) auto; }
    .adnn-admin-chat-title { min-height:64px; padding:0 16px; border-bottom:1px solid var(--adnn-wa-line); color:var(--adnn-wa-text); display:flex; align-items:center; gap:12px; background:var(--adnn-wa-panel-2); }
    .adnn-admin-chat-back { display:none; width:38px; height:38px; border:0; border-radius:50%; background:transparent; color:var(--adnn-wa-text); font-size:30px; line-height:1; cursor:pointer; }
    .adnn-admin-chat-avatar { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; flex:0 0 auto; color:#fff; background:linear-gradient(135deg,#7d8a91,#4b5961); font-size:13px; font-weight:700; }
    .adnn-admin-chat-title-text { min-width:0; display:block; }
    .adnn-admin-chat-title-text strong { display:block; font-size:16px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-admin-chat-title-text small { display:block; margin-top:2px; color:var(--adnn-wa-muted); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-admin-chat-room .adnn-chat-messages { padding:20px 6%; background:radial-gradient(circle at 20px 20px, rgba(255,255,255,.035) 1px, transparent 1.5px), #0b141a; background-size:38px 38px, auto; }
    .adnn-admin-chat-room .adnn-chat-form { background:var(--adnn-wa-panel); }

    .adnn-designer-chat-panel { margin-top:34px; min-height:440px; display:grid; grid-template-rows:minmax(320px,1fr) auto; border:1px solid var(--adnn-wa-line); border-radius:24px; overflow:hidden; background:var(--adnn-wa-dark); }

    :root.light-theme {
      --adnn-wa-dark: #efeae2;
      --adnn-wa-panel: #ffffff;
      --adnn-wa-panel-2: #f0f2f5;
      --adnn-wa-incoming: #ffffff;
      --adnn-wa-outgoing: #272dcf;
      --adnn-wa-text: #111b21;
      --adnn-wa-muted: #667781;
      --adnn-wa-line: rgba(17,27,33,.12);
    }
    :root.light-theme .adnn-chat-bubble.is-mine { color:#fff; }
    :root.light-theme .adnn-chat-form input { background:#fff; color:#111b21; border:1px solid rgba(17,27,33,.08); }

    @media (max-width: 760px) {
      .adnn-admin-chat-panel { height:calc(100vh - 89px); min-height:0; border-radius:0 !important; margin:0 calc(-1 * clamp(16px, 3.5vw, 44px)); border-left:0 !important; border-right:0 !important; }
      .adnn-admin-chat-appbar { display:none; }
      .adnn-admin-chat-grid { height:100%; grid-template-columns:1fr; }
      .adnn-admin-chat-list { border-right:0; height:100%; display:block; }
      .adnn-admin-chat-room { height:100%; display:none; }
      body.adnn-admin-chat-open .adnn-admin-chat-list { display:none; }
      body.adnn-admin-chat-open .adnn-admin-chat-room { display:grid; }
      .adnn-admin-chat-back { display:grid; place-items:center; }
      .adnn-admin-chat-title { min-height:60px; padding:0 8px; gap:8px; }
      .adnn-admin-chat-avatar { width:38px; height:38px; }
      .adnn-chat-bubble { max-width:82%; }
      .adnn-admin-chat-room .adnn-chat-messages { padding:14px 4.5%; }
      .adnn-admin-chat-panel { height:calc(100dvh - 65px) !important; max-height:calc(100dvh - 65px) !important; min-height:0; overflow:hidden; }
      .adnn-admin-chat-room { grid-template-rows:60px minmax(0,1fr) auto !important; min-height:0; }
      .adnn-admin-chat-room .adnn-chat-form { position:sticky; bottom:0; z-index:4; padding-bottom:calc(10px + env(safe-area-inset-bottom)); }
      .adnn-chat-form { grid-template-columns:42px minmax(0,1fr) 42px; }
      .adnn-chat-form input { height:42px; }
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
