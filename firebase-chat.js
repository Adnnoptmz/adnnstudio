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
    if (isAdminEmail(activeUser?.email)) {
      location.href = "admin.html#chat";
      return;
    }
    if (activeDesignerProfile && !location.pathname.includes("designer-account.html")) {
      location.href = "designer-account.html#chat";
      return;
    }
    openClientChat();
  });
  drawer.querySelector(".adnn-chat-close")?.addEventListener("click", closeClientChat);
  drawer.querySelector("#adnnChatForm")?.addEventListener("submit", sendClientMessage);
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
  input.value = "";
  if (fileInput) fileInput.value = "";
  await ensureClientChat(activeUser);
  const media = await uploadChatFile(file, clientChatId).catch((error) => {
    alert("The media could not be attached. Try a smaller file.");
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
    <p class="kicker">Studio chat</p>
    <div class="adnn-admin-chat-grid">
      <div class="adnn-admin-chat-list" id="adnnAdminChatList">
        <div class="adnn-chat-empty">Waiting for chats.</div>
      </div>
      <div class="adnn-admin-chat-room">
        <div class="adnn-admin-chat-title" id="adnnAdminChatTitle">Select a client</div>
        <div class="adnn-chat-messages" id="adnnAdminMessages">
          <div class="adnn-chat-empty">Choose a chat to reply.</div>
        </div>
        <form class="adnn-chat-form" id="adnnAdminChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnAdminChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </label>
          <input id="adnnAdminChatInput" autocomplete="off" maxlength="1800" placeholder="Reply to client">
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
      </label>
      <input id="adnnDesignerChatInput" autocomplete="off" maxlength="1800" placeholder="Message designers">
      <button type="submit" aria-label="Send designer message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </button>
    </form>
  `;
  view.appendChild(panel);
  document.getElementById("adnnDesignerChatForm")?.addEventListener("submit", sendDesignerMessage);
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
  input.value = "";
  if (fileInput) fileInput.value = "";
  const media = await uploadChatFile(file, designerChatId).catch((error) => {
    alert("The media could not be attached. Try a smaller file.");
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
  document.getElementById("adnnAdminChatTitle").textContent = chat.title || chat.clientName || chat.clientEmail || "Client";
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
  input.value = "";
  if (fileInput) fileInput.value = "";
  const media = await uploadChatFile(file, selectedAdminChatId).catch((error) => {
    alert("The media could not be attached. Try a smaller file.");
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
    .adnn-chat-trigger {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  justify-content: center;
  position: relative;
  border: 0.5px solid rgba(255,255,255,.08);
  border-radius: 16px;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  line-height: 1;
  text-decoration: none;
  background: linear-gradient(135deg, rgba(34,34,38,.72), rgba(22,22,26,.58) 38%, rgba(14,14,18,.42));
  backdrop-filter: blur(26px) saturate(160%);
  -webkit-backdrop-filter: blur(26px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), inset 0 -12px 35px rgba(255,255,255,.03), 0 20px 70px rgba(0,0,0,.34);
}
    .adnn-chat-trigger[hidden] { display: none !important; }
    .adnn-chat-trigger svg { width: 19px; height: 19px; }
    .adnn-chat-trigger.is-floating {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 70;
      background: #272dcf;
      border-radius: 50%;
      box-shadow: 0 18px 48px rgba(39,45,207,.28);
    }
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
      box-shadow: 0 8px 22px rgba(255,38,2,.32);
    }
    .adnn-chat-count[hidden] { display: none !important; }
    .adnn-chat-drawer {
      position: fixed;
      right: clamp(12px, 3vw, 28px);
      bottom: clamp(12px, 3vw, 28px);
      z-index: 120;
      width: min(380px, calc(100vw - 24px));
      height: min(560px, calc(100vh - 24px));
      display: grid;
      grid-template-rows: auto 1fr auto;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 28px;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(34,34,38,.88), rgba(14,14,18,.78));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 28px 90px rgba(0,0,0,.38);
      backdrop-filter: blur(28px) saturate(160%);
      -webkit-backdrop-filter: blur(28px) saturate(160%);
      opacity: 0;
      transform: translateY(18px) scale(.98);
      pointer-events: none;
      transition: opacity .3s ease, transform .36s cubic-bezier(.16,1,.3,1);
    }
    .adnn-chat-drawer.is-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .adnn-chat-head {
      min-height: 72px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,.1);
      color: #fff;
    }
    .adnn-chat-head span {
      display: block;
      color: #8d96ff;
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 10px;
      letter-spacing: .16em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .adnn-chat-head strong {
      font-size: 17px;
      font-weight: 500;
      letter-spacing: -.02em;
    }
    .adnn-chat-close {
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,.08);
      color: #fff;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
    .adnn-chat-messages {
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      color: #fff;
    }
    .adnn-chat-empty {
      margin: auto;
      color: rgba(255,255,255,.56);
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 12px;
      text-align: center;
    }
    .adnn-chat-bubble {
      max-width: 82%;
      align-self: flex-start;
      border-radius: 18px 18px 18px 6px;
      padding: 10px 12px;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.08);
      color: #fff;
    }
    .adnn-chat-bubble.is-mine {
      align-self: flex-end;
      border-radius: 18px 18px 6px 18px;
      background: #272dcf;
      border-color: rgba(255,255,255,.14);
    }
    .adnn-chat-bubble p {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .adnn-chat-bubble span {
      display: block;
      margin-top: 6px;
      color: rgba(255,255,255,.56);
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 10px;
    }
    .adnn-chat-sender {
      display: block;
      margin-bottom: 5px;
      color: rgba(255,255,255,.7);
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: .05em;
    }
    .adnn-chat-attachment {
      display: block;
      margin-bottom: 8px;
      max-width: 100%;
      color: #fff;
      text-decoration: underline;
      text-underline-offset: 3px;
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    .adnn-chat-attachment.is-image {
      text-decoration: none;
    }
    .adnn-chat-attachment img {
      display: block;
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.1);
    }
    .adnn-chat-delete {
      width: 28px;
      height: 28px;
      margin-top: 8px;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: rgba(255,255,255,.78);
      background: rgba(0,0,0,.16);
      cursor: pointer;
      opacity: 0;
      transform: scale(.92);
      transition: opacity .2s ease, transform .2s ease, background .2s ease;
    }
    .adnn-chat-bubble:hover .adnn-chat-delete,
    .adnn-chat-delete:focus-visible {
      opacity: 1;
      transform: scale(1);
    }
    .adnn-chat-delete:hover {
      color: #fff;
      background: rgba(255,38,2,.5);
    }
    .adnn-chat-delete svg {
      width: 14px;
      height: 14px;
      display: block;
    }
    .adnn-chat-form {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) 42px;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.1);
    }
    .adnn-chat-media {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,.08);
      color: #fff;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,.08);
    }
    .adnn-chat-media input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .adnn-chat-media svg {
      width: 18px;
      height: 18px;
      display: block;
    }
    .adnn-chat-form input {
      min-width: 0;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 999px;
      padding: 0 14px;
      background: rgba(255,255,255,.08);
      color: #fff;
      outline: 0;
      font-size: 14px;
    }
    .adnn-chat-form button {
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #272dcf;
      color: #fff;
      cursor: pointer;
    }
    .adnn-chat-form button svg { width: 18px; height: 18px; }
    .adnn-chat-alert {
      position: fixed;
      right: clamp(16px, 4vw, 34px);
      bottom: clamp(18px, 4vw, 34px);
      z-index: 10000;
      width: min(320px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 22px;
      padding: 14px 16px;
      color: #fff;
      background: linear-gradient(135deg, rgba(34,34,38,.78), rgba(14,14,18,.68));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 24px 70px rgba(0,0,0,.34), 0 0 34px rgba(39,45,207,.18);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      opacity: 0;
      transform: translateY(16px) scale(.98);
      pointer-events: none;
      transition: opacity .55s ease, transform .65s cubic-bezier(.16,1,.3,1);
    }
    .adnn-chat-alert.is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .adnn-chat-alert span,
    .adnn-chat-alert strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .adnn-chat-alert span {
      color: #8d96ff;
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .16em;
      margin-bottom: 6px;
    }
    .adnn-chat-alert strong {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -.02em;
    }
    .adnn-admin-chat-panel {
      margin-top: 22px;
    }
    .adnn-admin-chat-grid {
      display: grid;
      grid-template-columns: minmax(220px, .38fr) minmax(0, 1fr);
      gap: 16px;
      margin-top: 22px;
    }
    .adnn-admin-chat-list,
    .adnn-admin-chat-room {
      min-height: 460px;
      border: 1px solid var(--line, rgba(255,255,255,.08));
      border-radius: 22px;
      overflow: hidden;
      background: rgba(255,255,255,.04);
    }
    .adnn-admin-chat-list {
      display: grid;
      align-content: start;
      padding: 8px;
      gap: 6px;
      overflow: auto;
    }
    .adnn-admin-chat-item {
      width: 100%;
      min-height: 62px;
      border: 0;
      border-radius: 16px;
      padding: 10px 12px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      color: var(--text, #fff);
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .adnn-admin-chat-item:hover,
    .adnn-admin-chat-item.is-active {
      background: rgba(39,45,207,.18);
    }
    .adnn-admin-chat-item strong,
    .adnn-admin-chat-item small {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .adnn-admin-chat-item strong { font-size: 13px; font-weight: 500; }
    .adnn-admin-chat-item small { margin-top: 4px; color: var(--muted, rgba(255,255,255,.58)); font-size: 11px; }
    .adnn-admin-chat-item b {
      min-width: 20px;
      height: 20px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #ff2602;
      color: #fff;
      font-size: 10px;
      font-family: var(--font-mono, ui-monospace, Menlo, monospace);
    }
    .adnn-admin-chat-room {
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    .adnn-admin-chat-title {
      padding: 16px;
      border-bottom: 1px solid var(--line, rgba(255,255,255,.08));
      color: var(--text, #fff);
      font-size: 18px;
      letter-spacing: -.03em;
    }
    .adnn-designer-chat-panel {
      margin-top: 34px;
      min-height: 440px;
      display: grid;
      grid-template-rows: minmax(320px, 1fr) auto;
      border: 1px solid var(--line, rgba(0,0,0,.08));
      border-radius: 28px;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(16,16,20,.9), rgba(28,28,34,.78));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 24px 70px rgba(0,0,0,.1);
    }
    @media (max-width: 760px) {
      .adnn-admin-chat-grid { grid-template-columns: 1fr; }
      .adnn-admin-chat-list, .adnn-admin-chat-room { min-height: 320px; }
    }
  `;
  document.head.appendChild(style);
}

function supportChatId(uid) {
  return `support_${uid}`;
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
