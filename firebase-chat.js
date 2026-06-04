import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  addDoc,
  collection,
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

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

let activeUser = null;
let clientChatId = "";
let clientChatUnsubscribe = null;
let clientMessagesUnsubscribe = null;
let adminChatsUnsubscribe = null;
let adminMessagesUnsubscribe = null;
let selectedAdminChatId = "";
let firstClientMessagesSnapshot = true;
let firstAdminMessagesSnapshot = true;
let knownClientMessageIds = new Set();
let knownAdminMessageIds = new Set();
let chatAudio = null;

if (auth && db) {
  installChatStyles();
  installClientChatShell();
  if (location.pathname.includes("admin.html")) installAdminChatPanel();

  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    updateClientChatVisibility(user);
    if (!user) {
      stopClientChat();
      stopAdminChat();
      return;
    }

    if (isAdminEmail(user.email) && location.pathname.includes("admin.html")) {
      startAdminChat();
      return;
    }

    if (!isAdminEmail(user.email)) {
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
      <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Type a message">
      <button type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </button>
    </form>
  `;

  document.body.appendChild(drawer);
  trigger.addEventListener("click", () => {
    if (isAdminEmail(activeUser?.email)) {
      location.href = "admin.html#chat";
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
  trigger.hidden = !hasUser || hideOnAdminPanel;
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
  const text = String(input?.value || "").trim();
  if (!text) return;
  input.value = "";
  await ensureClientChat(activeUser);
  await addDoc(collection(db, "chats", clientChatId, "messages"), {
    text,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: activeUser.displayName || activeUser.email || "Client",
    senderRole: "client",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", clientChatId), {
    lastMessage: text,
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
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid)));
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
    <p class="kicker">Client chat</p>
    <div class="adnn-admin-chat-grid">
      <div class="adnn-admin-chat-list" id="adnnAdminChatList">
        <div class="adnn-chat-empty">Waiting for client chats.</div>
      </div>
      <div class="adnn-admin-chat-room">
        <div class="adnn-admin-chat-title" id="adnnAdminChatTitle">Select a client</div>
        <div class="adnn-chat-messages" id="adnnAdminMessages">
          <div class="adnn-chat-empty">Choose a chat to reply.</div>
        </div>
        <form class="adnn-chat-form" id="adnnAdminChatForm">
          <input id="adnnAdminChatInput" autocomplete="off" maxlength="1800" placeholder="Reply to client">
          <button type="submit" aria-label="Send reply">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
  const composer = document.querySelector(".panel.glass");
  if (composer) composer.insertAdjacentElement("afterend", panel);
  else document.querySelector(".shell")?.appendChild(panel);
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
    list.innerHTML = `<div class="adnn-chat-empty">Waiting for client chats.</div>`;
    return;
  }
  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "adnn-admin-chat-item";
    button.classList.toggle("is-active", chat.id === selectedAdminChatId);
    const unread = Number(chat.unreadForAdmin) || 0;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(chat.clientName || chat.clientEmail || "Client")}</strong>
        <small>${escapeHtml(chat.lastMessage || chat.clientEmail || "No messages yet")}</small>
      </span>
      ${unread > 0 ? `<b>${unread}</b>` : ""}
    `;
    button.addEventListener("click", () => selectAdminChat(chat));
    list.appendChild(button);
  });
}

function selectAdminChat(chat) {
  selectedAdminChatId = chat.id;
  document.getElementById("adnnAdminChatTitle").textContent = chat.clientName || chat.clientEmail || "Client";
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
  messages.forEach((message) => wrap.appendChild(messageBubble(message, message.senderUid === activeUser?.uid)));
  wrap.scrollTop = wrap.scrollHeight;
}

async function sendAdminMessage(event) {
  event.preventDefault();
  if (!activeUser || !selectedAdminChatId) return;
  const input = document.getElementById("adnnAdminChatInput");
  const text = String(input?.value || "").trim();
  if (!text) return;
  input.value = "";
  await addDoc(collection(db, "chats", selectedAdminChatId, "messages"), {
    text,
    senderUid: activeUser.uid,
    senderEmail: emailKey(activeUser.email),
    senderName: "AdnnStudio",
    senderRole: "admin",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", selectedAdminChatId), {
    lastMessage: text,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp(),
    unreadForClient: increment(1)
  }, { merge: true });
}

function messageBubble(message, mine) {
  const bubble = document.createElement("article");
  bubble.className = `adnn-chat-bubble${mine ? " is-mine" : ""}`;
  const text = document.createElement("p");
  const time = document.createElement("span");
  text.textContent = message.text || "";
  time.textContent = relativeTime(message.createdAt);
  bubble.append(text, time);
  return bubble;
}

function showChatAlert(message, label) {
  playChatSound();
  const alert = document.createElement("div");
  alert.className = "adnn-chat-alert";
  alert.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(message.text || "New message")}</strong>`;
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
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 18px;
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
    .adnn-chat-form {
      display: grid;
      grid-template-columns: 1fr 42px;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.1);
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
