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
  deleteField
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const MSG_LIMIT = 140;
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 4000;
const TYPING_IDLE_MS = 1400;
const PRESENCE_MS = 25000;

const firebaseConfig = window.ADNN_FIREBASE_CONFIG;
const app = firebaseConfig ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

let activeUser = null;
let activeProfile = null;
let presenceTimer = null;
let incomingCallUnsub = null;
let chatListUnsub = null;
let activeCall = null;
let callTimer = null;
const rooms = new Map();

const ICON = {
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v2.4a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.63 2 2 0 0 1 4.11 1.5h2.4a2 2 0 0 1 2 1.72c.13.96.35 1.9.67 2.8a2 2 0 0 1-.45 2.1L7.7 9.16a16 16 0 0 0 7.14 7.14l1.04-1.03a2 2 0 0 1 2.1-.45c.9.32 1.84.54 2.8.67A2 2 0 0 1 22 16.92Z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>`,
  videoOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5H13a3 3 0 0 1 3 3v2.3l5-3v9.4l-2.1-1.26M16 16.5A3 3 0 0 1 13 19H6a3 3 0 0 1-3-3V8a3 3 0 0 1 2-2.83"/><path d="m3 3 18 18"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.35V6a3 3 0 0 0-5.68-1.33"/><path d="M19 11a7 7 0 0 1-1.3 4.06M5 11a7 7 0 0 0 9.76 6.43"/><path d="M12 18v3"/></svg>`,
  hang: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5.7 15.6c4.2-3.5 8.4-3.5 12.6 0l1.7-1.7c.7-.7.7-1.8 0-2.5-4.9-4.4-11.1-4.4-16 0-.7.7-.7 1.8 0 2.5l1.7 1.7Z"/></svg>`,
  clip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5 22 12 3 3.5v6.6L15.7 12 3 13.9v6.6Z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>`
};

if (db && auth) {
  injectChatStyles();
  onAuthStateChanged(auth, async (user) => {
    cleanupAll();
    activeUser = user;
    if (!user) {
      if (location.pathname.includes("admin.html")) buildAdminChatShellOnly("Sign in with the tagged admin Google account to activate chats.");
      return;
    }
    activeProfile = await getProfile(user.uid, user.email);
    startPresence(user);
    watchIncomingCalls();
    if (location.pathname.includes("admin.html")) buildAdminChatPortal();
    else buildUserChatPortals();
  });
}

function buildUserChatPortals() {
  const directMount = document.getElementById("directChatMount");
  const supportMount = document.getElementById("clientChatMount");
  if (directMount) {
    directMount.className = "adnn-chat-app";
    directMount.innerHTML = appFrameMarkup("User Chats", "directThreads", "directRoom");
    watchChatThreads("user", "directThreads", "directRoom", { directOnly: true });
  }
  if (supportMount) {
    supportMount.className = "adnn-chat-app";
    supportMount.innerHTML = `<div class="adnn-chat-layout is-single"><section class="adnn-chat-room" id="supportRoom"></section></div>`;
    ensureSupportChat().then((chat) => openRoom(chat.id, chat, "supportRoom"));
  }
}

function buildAdminChatPortal() {
  const target = document.getElementById("adminChatMount") || document.getElementById("chats_view");
  if (!target) return;
  target.className = "adnn-chat-app";
  target.innerHTML = appFrameMarkup("Studio Chats", "adminThreads", "adminRoom", true);
  renderPassiveRoom("adminRoom", "Studio chats", "Loading conversations...", "Select a client chat to send a message");
  watchChatThreads("admin", "adminThreads", "adminRoom", {});
}

function buildAdminChatShellOnly(message) {
  const target = document.getElementById("adminChatMount") || document.getElementById("chats_view");
  if (!target) return;
  target.className = "adnn-chat-app";
  target.innerHTML = appFrameMarkup("Studio Chats", "adminThreads", "adminRoom", true);
  const list = document.getElementById("adminThreads");
  if (list) list.innerHTML = `<div class="adnn-chat-empty">${escapeHtml(message)}</div>`;
  renderPassiveRoom("adminRoom", "Studio chats", message, "Admin verification required");
}

function appFrameMarkup(title, listId, roomId, searchable = false) {
  return `
    <div class="adnn-chat-layout">
      <aside class="adnn-chat-thread-panel">
        <div class="adnn-chat-thread-head">
          <strong>${escapeHtml(title)}</strong>
          ${searchable ? `<input id="${listId}Search" placeholder="Search">` : ""}
        </div>
        <div class="adnn-chat-thread-list" id="${listId}"><div class="adnn-chat-empty">Loading chats...</div></div>
      </aside>
      <section class="adnn-chat-room" id="${roomId}">
        <div class="adnn-chat-welcome">
          <div class="adnn-chat-logo">a</div>
          <h3>Select a chat</h3>
          <p>Messages, files, calls, and updates will appear here.</p>
        </div>
      </section>
    </div>
  `;
}

async function ensureSupportChat() {
  const chatId = `support_${activeUser.uid}`;
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef).catch(() => null);
  const displayName = ownDisplayName();
  const payload = {
    type: "support",
    title: "AdnnStudio Support",
    clientUid: activeUser.uid,
    clientName: displayName,
    clientEmail: emailKey(activeUser.email),
    participantUids: [activeUser.uid, ADMIN_ALIAS_UID],
    participantNames: { [activeUser.uid]: displayName, [ADMIN_ALIAS_UID]: "AdnnStudio Admin" },
    participantEmailMap: { [activeUser.uid]: emailKey(activeUser.email), [ADMIN_ALIAS_UID]: ADMIN_EMAIL },
    updatedAt: serverTimestamp()
  };
  if (!snap?.exists()) await setDoc(chatRef, { ...payload, lastMessage: "Support channel ready.", unreadForAdmin: 0, unreadForClient: 0, createdAt: serverTimestamp() }, { merge: true });
  else await setDoc(chatRef, payload, { merge: true }).catch(() => {});
  const fresh = await getDoc(chatRef);
  return { id: chatId, ...fresh.data() };
}

function watchChatThreads(scope, listId, roomId, options = {}) {
  if (chatListUnsub) chatListUnsub();
  const list = document.getElementById(listId);
  const ref = scope === "admin"
    ? collection(db, "chats")
    : query(collection(db, "chats"), where("participantUids", "array-contains", activeUser.uid));
  chatListUnsub = onSnapshot(ref, (snapshot) => {
    if (!list) return;
    let chats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    if (options.directOnly) chats = chats.filter((chat) => chat.type === "direct");
    chats.sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
    renderThreadList(chats, list, roomId, scope);
  }, () => {
    if (list) list.innerHTML = `<div class="adnn-chat-empty">Unable to load chats.</div>`;
    if (scope === "admin") renderPassiveRoom(roomId, "Chats unavailable", "Open a client chat after your admin account is verified.", "Waiting for chat access");
  });
  const search = document.getElementById(`${listId}Search`);
  search?.addEventListener("input", () => {
    const needle = search.value.toLowerCase().trim();
    list?.querySelectorAll(".adnn-thread").forEach((row) => {
      row.hidden = needle && !row.innerText.toLowerCase().includes(needle);
    });
  });
}

function renderThreadList(chats, list, roomId, scope) {
  list.innerHTML = "";
  if (!chats.length) {
    list.innerHTML = `<div class="adnn-chat-empty">No conversations yet.</div>`;
    if (scope === "admin") renderPassiveRoom(roomId, "No client chats yet", "Client conversations will appear here.", "Waiting for a client chat");
    return;
  }
  const currentState = rooms.get(roomId);
  let currentRow = null;
  chats.forEach((chat) => {
    const title = getChatTitle(chat, scope);
    const unread = scope === "admin" ? Number(chat.unreadForAdmin || 0) : Number(chat.unreadForClient || 0);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "adnn-thread";
    row.dataset.chatId = chat.id;
    const preview = isCallSummaryText(chat.lastMessage) ? "No messages yet." : (chat.lastMessage || "No messages yet.");
    row.innerHTML = `
      <span class="adnn-avatar">${initials(title)}</span>
      <span class="adnn-thread-copy">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(preview)}</small>
      </span>
      ${unread > 0 ? `<b>${unread}</b>` : ""}
    `;
    row.addEventListener("click", () => {
      list.querySelectorAll(".adnn-thread").forEach((item) => item.classList.remove("is-active"));
      row.classList.add("is-active");
      openRoom(chat.id, chat, roomId);
      document.querySelector(".adnn-chat-layout")?.classList.add("is-room-open");
    });
    if (currentState?.chatId === chat.id) {
      row.classList.add("is-active");
      currentRow = row;
    }
    list.appendChild(row);
  });
  if (scope === "admin" && !currentRow && chats[0]) {
    const firstRow = list.querySelector(".adnn-thread");
    firstRow?.classList.add("is-active");
    openRoom(chats[0].id, chats[0], roomId);
  }
}

function renderPassiveRoom(roomId, title, message, placeholder) {
  const target = document.getElementById(roomId);
  if (!target) return;
  
  const state = {
    roomId,
    chatId: "passive_" + roomId,
    chatData: { type: "support" },
    files: [],
    replyTo: null,
    voice: null,
    recorder: null,
    chunks: [],
    recordTimer: null,
    seconds: 0,
    unsubs: []
  };
  rooms.set(roomId, state);

  target.innerHTML = `
    <div class="adnn-room-shell" data-room="${roomId}">
      <div class="adnn-room-head" role="toolbar" aria-label="Chat status">
        <span class="adnn-avatar">${initials(title)}</span>
        <div class="adnn-room-title">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(message)}</small>
        </div>
      </div>
      <div class="adnn-call-dock" data-call-dock style="display:none !important;"></div>
      <main class="adnn-message-scroll" data-message-scroll>
        <div class="adnn-chat-empty">${escapeHtml(message)}</div>
      </main>
      <div class="adnn-drop-layer" data-drop-layer>Drop files to attach</div>
      <footer class="adnn-composer-wrap">
        <div class="adnn-typing-line" data-typing-line hidden></div>
        <div class="adnn-reply-bar" data-reply-bar hidden>
          <span></span>
          <button type="button" data-clear-reply>${ICON.x}</button>
        </div>
        <div class="adnn-file-preview" data-file-preview hidden></div>
        <div class="adnn-voice-preview" data-voice-preview hidden></div>
        <form class="adnn-composer" data-composer>
          <label class="adnn-attach-btn" title="Attach files">
            ${ICON.clip}
            <input type="file" data-file-input multiple>
          </label>
          <textarea data-text rows="1" maxlength="1800" placeholder="${escapeAttr(placeholder)}"></textarea>
          <button type="button" class="adnn-voice-btn" data-voice>${ICON.mic}</button>
          <button type="submit" class="adnn-send-btn" data-send hidden>${ICON.send}</button>
        </form>
      </footer>
    </div>
  `;
  bindRoomControls(state);
}

function openRoom(chatId, chatData, roomId) {
  const target = document.getElementById(roomId);
  if (!target) return;
  const old = rooms.get(roomId);
  old?.unsubs?.forEach((unsub) => unsub?.());
  if (old?.typingTimer) clearTimeout(old.typingTimer);
  const state = {
    roomId,
    chatId,
    chatData,
    files: [],
    replyTo: null,
    voice: null,
    recorder: null,
    chunks: [],
    recordTimer: null,
    seconds: 0,
    unsubs: []
  };
  rooms.set(roomId, state);
  target.innerHTML = roomMarkup(roomId);
  ensureRoomChrome(state);
  bindRoomControls(state);
  watchRoomMeta(state);
  watchMessages(state);
  watchTyping(state);
  resetUnread(chatData);
}

function ensureRoomChrome(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const dock = shell.querySelector("[data-call-dock]");
  if (!dock) return;
  dock.querySelectorAll("[data-call]").forEach((btn) => {
    btn.hidden = false;
    btn.removeAttribute("hidden");
    btn.style.setProperty("display", "grid", "important");
    btn.style.setProperty("visibility", "visible", "important");
    btn.style.setProperty("opacity", "1", "important");
    btn.style.setProperty("pointer-events", "auto", "important");
  });
}

function roomMarkup(roomId) {
  return `
    <div class="adnn-room-shell" data-room="${roomId}">
      <div class="adnn-room-head" role="toolbar" aria-label="Chat tools">
        <button type="button" class="adnn-back-btn" data-chat-back>${ICON.back}</button>
        <span class="adnn-avatar" data-chat-avatar>AD</span>
        <div class="adnn-room-title">
          <strong data-chat-title>Opening chat...</strong>
          <small data-chat-presence>Checking status...</small>
        </div>
      </div>
      <div class="adnn-call-dock" data-call-dock>
        <button type="button" class="adnn-call-btn" data-call="audio" title="Audio call" aria-label="Audio call">${ICON.phone}</button>
        <button type="button" class="adnn-call-btn" data-call="video" title="Video call" aria-label="Video call">${ICON.video}</button>
      </div>
      <main class="adnn-message-scroll" data-message-scroll>
        <div class="adnn-chat-empty">Loading messages...</div>
      </main>
      <div class="adnn-drop-layer" data-drop-layer>Drop files to attach</div>
      <footer class="adnn-composer-wrap">
        <div class="adnn-typing-line" data-typing-line hidden></div>
        <div class="adnn-reply-bar" data-reply-bar hidden>
          <span></span>
          <button type="button" data-clear-reply>${ICON.x}</button>
        </div>
        <div class="adnn-file-preview" data-file-preview hidden></div>
        <div class="adnn-voice-preview" data-voice-preview hidden></div>
        <form class="adnn-composer" data-composer>
          <label class="adnn-attach-btn" title="Attach files">
            ${ICON.clip}
            <input type="file" data-file-input multiple>
          </label>
          <textarea data-text rows="1" maxlength="1800" placeholder="Message"></textarea>
          <button type="button" class="adnn-voice-btn" data-voice>${ICON.mic}</button>
          <button type="submit" class="adnn-send-btn" data-send hidden>${ICON.send}</button>
        </form>
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

  shell.querySelector("[data-chat-back]")?.addEventListener("click", () => {
    document.querySelector(".adnn-chat-layout")?.classList.remove("is-room-open");
  });
  shell.querySelectorAll("[data-call]").forEach((btn) => {
    btn.addEventListener("click", () => startCall(btn.dataset.call, state.chatId, state.chatData));
  });
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
    if (state.chatId.startsWith("passive_")) {
      showToast("Please select an active conversation thread first.");
      return;
    }
    sendCurrentMessage(state);
  });
  fileInput?.addEventListener("change", () => {
    addFilesToState(state, Array.from(fileInput.files || []));
    fileInput.value = "";
  });
  shell.querySelector("[data-clear-reply]")?.addEventListener("click", () => {
    state.replyTo = null;
    renderReplyBar(state);
  });
  voiceBtn?.addEventListener("click", () => toggleVoiceRecording(state));
  ["dragenter", "dragover"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      shell.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "drop") addFilesToState(state, Array.from(event.dataTransfer?.files || []));
      shell.classList.remove("is-dragging");
    });
  });
}

function watchRoomMeta(state) {
  const unsub = onSnapshot(doc(db, "chats", state.chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    state.chatData = { id: state.chatId, ...snapshot.data() };
    const title = getChatTitle(state.chatData, isAdminEmail(activeUser.email) ? "admin" : "user");
    const shell = roomShell(state);
    if (!shell) return;
    const avatar = shell.querySelector("[data-chat-avatar]");
    const titleNode = shell.querySelector("[data-chat-title]");
    if (avatar) avatar.textContent = initials(title);
    if (titleNode) titleNode.textContent = title;
    watchPresence(state);
  });
  state.unsubs.push(unsub);
}

function watchPresence(state) {
  const uid = getRemoteUid(state.chatData);
  const shell = roomShell(state);
  if (!shell) return;
  const status = shell.querySelector("[data-chat-presence]");
  state.presenceUnsub?.();
  if (!uid || !status) {
    if (status) status.textContent = "Available";
    return;
  }
  state.presenceUnsub = onSnapshot(doc(db, "presence", uid), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const seen = toMillis(data.lastSeen || data.updatedAt);
    const online = data.online !== false && seen && Date.now() - seen < 75000;
    status.textContent = online ? "Online" : seen ? `Last seen ${relativeTime(seen)}` : "Offline";
    status.classList.toggle("is-online", !!online);
  });
  state.unsubs.push(state.presenceUnsub);
}

function watchTyping(state) {
  const unsub = onSnapshot(collection(db, "chats", state.chatId, "typing"), (snapshot) => {
    const typing = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.id !== activeUser.uid && item.isTyping && Date.now() - Number(item.updatedAt || 0) < 5000);
    const shell = roomShell(state);
    if (!shell) return;
    const line = shell.querySelector("[data-typing-line]");
    const status = shell.querySelector("[data-chat-presence]");
    if (line) {
      line.hidden = typing.length === 0;
      line.innerHTML = typing.length ? `<span></span><span></span><span></span> ${escapeHtml(typing[0].name || "User")} is typing` : "";
    }
    if (status && typing.length) status.textContent = "Typing...";
  });
  state.unsubs.push(unsub);
}

function watchMessages(state) {
  const q = query(collection(db, "chats", state.chatId, "messages"), orderBy("createdAt", "asc"), limit(MSG_LIMIT));
  const unsub = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderMessages(state, messages);
    markMessagesRead(state, messages);
  }, () => {
    const shell = roomShell(state);
    if (shell) shell.querySelector("[data-message-scroll]").innerHTML = `<div class="adnn-chat-empty">Could not load messages.</div>`;
  });
  state.unsubs.push(unsub);
}

function renderMessages(state, messages) {
  const shell = roomShell(state);
  if (!shell) return;
  const scroller = shell.querySelector("[data-message-scroll]");
  if (!scroller) return;
  scroller.innerHTML = "";
  const visibleMessages = messages.filter((message) => !isHiddenSystemMessage(message));
  if (!visibleMessages.length) {
    scroller.innerHTML = `<div class="adnn-chat-empty">No messages yet.</div>`;
    return;
  }
  visibleMessages.forEach((message) => {
    const mine = message.senderUid === activeUser.uid || (isAdminEmail(activeUser.email) && message.senderUid === ADMIN_ALIAS_UID);
    const row = document.createElement("div");
    row.className = `adnn-message-row ${mine ? "is-mine" : "is-peer"}`;
    const bubble = document.createElement("article");
    bubble.className = "adnn-message";
    bubble.innerHTML = `
      ${!mine ? `<strong class="adnn-message-name">${escapeHtml(message.senderName || "User")}</strong>` : ""}
      ${renderReplyPreview(message)}
      ${renderAttachments(message)}
      ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}
      <div class="adnn-message-meta">
        <time>${formatTime(message.createdAt)}</time>
        ${mine ? `<span class="adnn-ticks ${Array.isArray(message.readBy) && message.readBy.length > 1 ? "is-read" : ""}">✓✓</span>` : ""}
      </div>
      ${renderReactions(message)}
      <div class="adnn-message-actions">
        <button type="button" data-action="reply">Reply</button>
        <button type="button" data-action="react" data-emoji="👍">👍</button>
        <button type="button" data-action="react" data-emoji="❤️">❤️</button>
        <button type="button" data-action="react" data-emoji="😂">😂</button>
        <button type="button" data-action="react" data-emoji="🔥">🔥</button>
        <button type="button" data-action="react" data-emoji="✅">✅</button>
        ${mine ? `<button type="button" data-action="delete" class="is-danger">Delete</button>` : ""}
      </div>
    `;
    bubble.addEventListener("click", (event) => handleMessageAction(event, state, message));
    row.appendChild(bubble);
    scroller.appendChild(row);
  });
  scroller.scrollTop = scroller.scrollHeight;
}

function handleMessageAction(event, state, message) {
  const btn = event.target.closest("[data-action]");
  if (!btn) {
    document.querySelectorAll(".adnn-message.is-menu-open").forEach((item) => {
      if (item !== event.currentTarget) item.classList.remove("is-menu-open");
    });
    event.currentTarget.classList.toggle("is-menu-open");
    return;
  }
  event.stopPropagation();
  const action = btn.dataset.action;
  if (action === "reply") {
    state.replyTo = {
      id: message.id,
      senderName: message.senderName || "User",
      text: message.text || firstAttachmentName(message) || "Attachment"
    };
    renderReplyBar(state);
    roomShell(state)?.querySelector("[data-text]")?.focus();
  }
  if (action === "react") toggleReaction(state.chatId, message, btn.dataset.emoji);
  if (action === "delete") deleteDoc(doc(db, "chats", state.chatId, "messages", message.id)).catch(() => {});
}

async function sendCurrentMessage(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const textNode = shell.querySelector("[data-text]");
  const text = textNode.value.trim();
  if (!text && state.files.length === 0 && !state.voice) return;
  const stagedFiles = [...state.files];
  const stagedVoice = state.voice;
  state.files = [];
  state.voice = null;
  renderFilePreview(state);
  renderVoicePreview(state);
  refreshComposerMode(state);
  textNode.value = "";
  autoSizeTextArea(textNode);
  setTyping(state, false);

  try {
    const attachments = [];
    for (const item of stagedFiles) attachments.push(await uploadChatFile(item.file, state.chatId, false));
    if (stagedVoice) {
      const voiceAttachment = await uploadChatFile(stagedVoice.file, state.chatId, true);
      voiceAttachment.duration = stagedVoice.seconds;
      attachments.push(voiceAttachment);
    }
    const payload = {
      text,
      attachments,
      senderUid: activeUser.uid,
      senderAliasUid: ownCallUid(),
      senderRealUid: activeUser.uid,
      senderEmail: emailKey(activeUser.email),
      senderName: ownDisplayName(),
      createdAt: serverTimestamp(),
      readBy: [activeUser.uid]
    };
    if (state.replyTo) payload.replyTo = state.replyTo;
    if (attachments[0]) {
      payload.mediaUrl = attachments[0].url;
      payload.mediaName = attachments[0].name;
      payload.mediaType = attachments[0].type;
    }
    await addDoc(collection(db, "chats", state.chatId, "messages"), payload);
    const lastMessage = text || (attachments.some((item) => item.voice) ? "Voice message" : `${attachments.length} file${attachments.length > 1 ? "s" : ""}`);
    await updateChatAfterSend(state, lastMessage);
    state.replyTo = null;
    renderReplyBar(state);
  } catch (error) {
    showToast("Could not send message. Check Firebase Storage rules.");
    state.files = stagedFiles;
    state.voice = stagedVoice;
    renderFilePreview(state);
    renderVoicePreview(state);
    refreshComposerMode(state);
  }
}

async function updateChatAfterSend(state, lastMessage) {
  const payload = {
    lastMessage,
    lastSenderUid: activeUser.uid,
    updatedAt: serverTimestamp()
  };
  if (state.chatData.type === "support") {
    if (isAdminEmail(activeUser.email)) payload.unreadForClient = increment(1);
    else payload.unreadForAdmin = increment(1);
  } else {
    payload.unreadForClient = increment(1);
    payload.unreadForAdmin = increment(1);
  }
  await setDoc(doc(db, "chats", state.chatId), payload, { merge: true });
}

function addFilesToState(state, files) {
  const accepted = files.filter(Boolean).slice(0, 10);
  accepted.forEach((file) => {
    state.files.push({ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, file, url: URL.createObjectURL(file) });
  });
  renderFilePreview(state);
  refreshComposerMode(state);
}

function renderFilePreview(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const target = shell.querySelector("[data-file-preview]");
  if (!target) return;
  target.hidden = state.files.length === 0;
  target.innerHTML = state.files.map((item) => `
    <div class="adnn-file-chip" data-file-id="${item.id}">
      ${item.file.type.startsWith("image/") ? `<img src="${item.url}" alt="">` : `<span>${fileExt(item.file.name)}</span>`}
      <div><strong>${escapeHtml(item.file.name)}</strong><small>${formatBytes(item.file.size)}</small></div>
      <button type="button" data-remove-file="${item.id}">${ICON.x}</button>
    </div>
  `).join("");
  target.querySelectorAll("[data-remove-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.files = state.files.filter((item) => item.id !== btn.dataset.removeFile);
      renderFilePreview(state);
      refreshComposerMode(state);
    });
  });
}

async function toggleVoiceRecording(state) {
  const shell = roomShell(state);
  if (!shell) return;
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    showToast("Voice recording is not available in this browser.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    state.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.chunks = [];
    state.seconds = 0;
    const voiceBtn = shell.querySelector("[data-voice]");
    voiceBtn?.classList.add("is-recording");
    voiceBtn.innerHTML = `<span class="adnn-rec-dot"></span><b>0s</b>`;
    state.recordTimer = setInterval(() => {
      state.seconds += 1;
      const label = shell.querySelector("[data-voice] b");
      if (label) label.textContent = `${state.seconds}s`;
    }, 1000);
    state.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.chunks.push(event.data);
    };
    state.recorder.onstop = () => {
      clearInterval(state.recordTimer);
      stream.getTracks().forEach((track) => track.stop());
      const type = state.recorder.mimeType || "audio/webm";
      const blob = new Blob(state.chunks, { type });
      if (blob.size > 0 && state.seconds > 0) {
        const file = new File([blob], `voice_${Date.now()}.webm`, { type });
        state.voice = { file, url: URL.createObjectURL(file), seconds: Math.max(1, state.seconds) };
      }
      state.recorder = null;
      voiceBtn?.classList.remove("is-recording");
      voiceBtn.innerHTML = ICON.mic;
      renderVoicePreview(state);
      refreshComposerMode(state);
    };
    state.recorder.start();
  } catch (error) {
    showToast("Microphone permission is needed for voice messages.");
  }
}

function renderVoicePreview(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const target = shell.querySelector("[data-voice-preview]");
  if (!target) return;
  target.hidden = !state.voice;
  target.innerHTML = state.voice ? `
    <span class="adnn-voice-preview-icon">${ICON.mic}</span>
    <audio controls src="${state.voice.url}"></audio>
    <span>${formatDuration(state.voice.seconds)}</span>
    <button type="button" data-delete-voice>${ICON.x}</button>
  ` : "";
  target.querySelector("[data-delete-voice]")?.addEventListener("click", () => {
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
  shell.querySelector("[data-send]").hidden = !hasPayload;
  shell.querySelector("[data-voice]").hidden = hasPayload;
}

async function uploadChatFile(file, chatId, voice = false) {
  if (!storage) throw new Error("Storage is not configured");
  const safeName = file.name.replace(/[^a-z0-9_.-]/gi, "_").toLowerCase();
  const path = `chat-media/${chatId}/${activeUser.uid}/${Date.now()}_${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    url: await getDownloadURL(ref),
    path,
    voice
  };
}

async function setTyping(state, on) {
  await setDoc(doc(db, "chats", state.chatId, "typing", activeUser.uid), {
    isTyping: !!on,
    name: ownDisplayName(),
    updatedAt: Date.now()
  }, { merge: true }).catch(() => {});
  if (state.typingTimer) clearTimeout(state.typingTimer);
  if (on) state.typingTimer = setTimeout(() => setTyping(state, false), TYPING_IDLE_MS);
}

async function toggleReaction(chatId, message, emoji) {
  const key = `reactions.${activeUser.uid}`;
  const current = message.reactions?.[activeUser.uid];
  await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
    [key]: current === emoji ? deleteField() : emoji
  }).catch(() => {});
}

async function markMessagesRead(state, messages) {
  const mineIds = [activeUser.uid, ownCallUid()];
  const updates = messages
    .filter((msg) => !mineIds.includes(msg.senderUid) && !(msg.readBy || []).includes(activeUser.uid))
    .map((msg) => updateDoc(doc(db, "chats", state.chatId, "messages", msg.id), { readBy: arrayUnion(activeUser.uid) }).catch(() => {}));
  await Promise.all(updates);
  resetUnread(state.chatData);
}

function resetUnread(chat) {
  if (!chat?.id && !chat?.type) return;
  const chatId = chat.id || rooms.values().next().value?.chatId;
  if (!chatId) return;
  const field = isAdminEmail(activeUser.email) ? "unreadForAdmin" : "unreadForClient";
  updateDoc(doc(db, "chats", chatId), { [field]: 0 }).catch(() => {});
}

function startPresence(user) {
  const write = async (online = true) => {
    const base = {
      uid: user.uid,
      email: emailKey(user.email),
      name: ownDisplayName(),
      online,
      page: location.pathname,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "presence", user.uid), base, { merge: true }).catch(() => {});
    if (isAdminEmail(user.email)) await setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { ...base, uid: ADMIN_ALIAS_UID, realUid: user.uid, name: "AdnnStudio Admin" }, { merge: true }).catch(() => {});
  };
  write(true);
  presenceTimer = setInterval(() => write(true), PRESENCE_MS);
  window.addEventListener("beforeunload", markOffline);
}

function markOffline() {
  if (!activeUser) return;
  setDoc(doc(db, "presence", activeUser.uid), { online: false, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  if (isAdminEmail(activeUser.email)) setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { online: false, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
}

function watchIncomingCalls() {
  incomingCallUnsub?.();
  incomingCallUnsub = onSnapshot(doc(db, "callInbox", ownCallUid()), async (snapshot) => {
    if (!snapshot.exists() || activeCall) return;
    const inbox = snapshot.data();
    if (inbox.status !== "ringing" || !inbox.callId) return;
    const callSnap = await getDoc(doc(db, "calls", inbox.callId)).catch(() => null);
    if (!callSnap?.exists()) return;
    const call = callSnap.data();
    if (call.status !== "ringing" || call.callerUid === ownCallUid() || Date.now() > Number(call.expiresAtMs || 0)) return;
    showIncomingCall(inbox.callId, call);
  });
}

async function startCall(kind, chatId, chatData) {
  if (activeCall) return;
  const receiverUid = getRemoteUid(chatData);
  if (!receiverUid) return showToast("No receiver is available for this chat.");
  try {
    const wantsVideo = kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const callId = `call_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    activeCall = createCallState(callId, "caller", kind, stream, chatId, chatData, receiverUid);
    renderCallOverlay();
    await setupPeerConnection(activeCall, true);
    const offer = await activeCall.pc.createOffer();
    await activeCall.pc.setLocalDescription(offer);
    const media = { [ownCallUid()]: { cameraOn: wantsVideo, updatedAt: Date.now() }, [receiverUid]: { cameraOn: false, updatedAt: Date.now() } };
    await setDoc(doc(db, "calls", callId), {
      chatId,
      kind,
      status: "ringing",
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: ownDisplayName(),
      receiverUid,
      receiverName: getChatTitle(chatData, "user"),
      participants: [ownCallUid(), receiverUid],
      media,
      offer: { type: offer.type, sdp: offer.sdp },
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "callInbox", receiverUid), {
      callId,
      receiverUid,
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: ownDisplayName(),
      chatId,
      kind,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      updatedAt: serverTimestamp()
    }, { merge: true });
    watchActiveCall(callId);
  } catch (error) {
    endCall(false);
    showToast("Camera or microphone permission is needed.");
  }
}

function showIncomingCall(callId, call) {
  const overlay = document.createElement("div");
  overlay.className = "adnn-call-overlay";
  overlay.innerHTML = `
    <div class="adnn-incoming-call">
      <span class="adnn-avatar">${initials(call.callerName || "AD")}</span>
      <h3>${escapeHtml(call.callerName || "Incoming call")}</h3>
      <p>${call.kind === "video" ? "Video" : "Audio"} call</p>
      <div>
        <button type="button" class="is-accept" data-accept>${ICON.phone}</button>
        <button type="button" class="is-end" data-reject>${ICON.hang}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-reject]")?.addEventListener("click", () => {
    overlay.remove();
    updateDoc(doc(db, "calls", callId), { status: "ended", updatedAt: serverTimestamp() }).catch(() => {});
    cleanupCallInbox(callId, ownCallUid());
  });
  overlay.querySelector("[data-accept]")?.addEventListener("click", async () => {
    overlay.remove();
    await acceptCall(callId, call);
  });
}

async function acceptCall(callId, call) {
  try {
    const wantsVideo = call.kind === "video";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    activeCall = createCallState(callId, "receiver", call.kind, stream, call.chatId, { id: call.chatId, type: "direct", participantUids: [call.callerUid, ownCallUid()], participantNames: { [call.callerUid]: call.callerName } }, call.callerUid);
    activeCall.remoteCameraOn = !!call.media?.[call.callerUid]?.cameraOn;
    renderCallOverlay();
    await setupPeerConnection(activeCall, false);
    await activeCall.pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    const answer = await activeCall.pc.createAnswer();
    await activeCall.pc.setLocalDescription(answer);
    await updateDoc(doc(db, "calls", callId), {
      status: "accepted",
      answer: { type: answer.type, sdp: answer.sdp },
      [`media.${ownCallUid()}`]: { cameraOn: wantsVideo, updatedAt: Date.now() },
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "callInbox", ownCallUid()), { status: "accepted", callId }, { merge: true });
    watchActiveCall(callId);
  } catch (error) {
    showToast("Could not answer the call.");
    updateDoc(doc(db, "calls", callId), { status: "ended", updatedAt: serverTimestamp() }).catch(() => {});
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
    blankVideo: null,
    cameraOn: kind === "video",
    remoteCameraOn: kind === "video" && role === "receiver",
    micOn: true,
    startedAt: Date.now(),
    unsubs: []
  };
}

async function setupPeerConnection(call, caller) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
  call.pc = pc;

  call.localStream.getTracks().forEach((track) => pc.addTrack(track, call.localStream));

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const path = caller ? "offerCandidates" : "answerCandidates";
    addDoc(collection(db, "calls", call.callId, path), event.candidate.toJSON()).catch(() => {});
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      event.streams[0].getTracks().forEach((track) => {
        if (!call.remoteStream.getTracks().some((t) => t.id === track.id)) {
          call.remoteStream.addTrack(track);
        }
      });
    } else {
      if (!call.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        call.remoteStream.addTrack(event.track);
      }
    }
    attachCallMedia();
  };

  const remotePath = caller ? "answerCandidates" : "offerCandidates";
  call.unsubs.push(onSnapshot(collection(db, "calls", call.callId, remotePath), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
    });
  }));
}

function watchActiveCall(callId) {
  const unsub = onSnapshot(doc(db, "calls", callId), async (snapshot) => {
    if (!snapshot.exists() || !activeCall || activeCall.callId !== callId) return;
    const data = snapshot.data();
    if (activeCall.role === "caller" && data.status === "accepted" && data.answer && activeCall.pc.signalingState === "have-local-offer") {
      await activeCall.pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
    }
    const remoteMedia = data.media?.[activeCall.remoteUid];
    activeCall.remoteCameraOn = !!remoteMedia?.cameraOn;
    attachCallMedia();
    if (data.status === "accepted") startCallTimer();
    if (data.status === "ended" || data.status === "missed") endCall(false);
  });
  activeCall?.unsubs.push(unsub);
}

function renderCallOverlay() {
  document.getElementById("adnnCallOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "adnnCallOverlay";
  overlay.className = "adnn-call-overlay";
  overlay.innerHTML = `
    <div class="adnn-call-card">
      <div class="adnn-call-stage" data-call-stage>
        <div class="adnn-video-tile is-remote" data-remote-tile><video autoplay playsinline data-remote-video></video><span>${escapeHtml(getChatTitle(activeCall.chatData, "user"))}</span></div>
        <div class="adnn-video-tile is-local" data-local-tile><video autoplay muted playsinline data-local-video></video><span>You</span></div>
        <div class="adnn-audio-call-face" data-audio-face><span class="adnn-avatar">${initials(getChatTitle(activeCall.chatData, "user"))}</span></div>
      </div>
      <div class="adnn-call-meta"><strong>${escapeHtml(getChatTitle(activeCall.chatData, "user"))}</strong><small data-call-time>Connecting...</small></div>
      <div class="adnn-call-controls">
        <button type="button" data-call-mic>${ICON.mic}</button>
        <button type="button" data-call-camera>${activeCall.cameraOn ? ICON.videoOff : ICON.video}</button>
        <button type="button" class="is-end" data-call-end>${ICON.hang}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-call-mic]")?.addEventListener("click", toggleCallMic);
  overlay.querySelector("[data-call-camera]")?.addEventListener("click", toggleCallCamera);
  overlay.querySelector("[data-call-end]")?.addEventListener("click", () => endCall(true));
  attachCallMedia();
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
  
  if (localVideo && localVideo.srcObject !== activeCall.localStream) localVideo.srcObject = activeCall.localStream;
  if (remoteVideo && remoteVideo.srcObject !== activeCall.remoteStream) remoteVideo.srcObject = activeCall.remoteStream;
  
  localVideo?.play?.().catch(() => {});
  remoteVideo?.play?.().catch(() => {});
  
  const localOn = activeCall.cameraOn && activeCall.localStream.getVideoTracks().some((track) => track.readyState !== "ended");
  const remoteOn = activeCall.remoteCameraOn && activeCall.remoteStream.getVideoTracks().some((track) => track.readyState !== "ended");
  
  if (localTile) localTile.hidden = !localOn;
  if (remoteTile) remoteTile.hidden = !remoteOn;
  if (audioFace) audioFace.hidden = localOn || remoteOn;
}

async function toggleCallMic(event) {
  if (!activeCall) return;
  activeCall.micOn = !activeCall.micOn;
  activeCall.localStream.getAudioTracks().forEach((track) => { track.enabled = activeCall.micOn; });
  event.currentTarget.innerHTML = activeCall.micOn ? ICON.mic : ICON.micOff;
  event.currentTarget.classList.toggle("is-off", !activeCall.micOn);
}

async function toggleCallCamera(event) {
  if (!activeCall) return;
  if (activeCall.cameraOn) {
    activeCall.localStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
    });
    activeCall.cameraOn = false;
  } else {
    if (activeCall.localStream.getVideoTracks().length === 0) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        activeCall.localStream.addTrack(videoTrack);
        
        const sender = activeCall.pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      } catch (err) {
        showToast("Unable to start camera.");
        return;
      }
    } else {
      activeCall.localStream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
    }
    activeCall.cameraOn = true;
  }
  
  event.currentTarget.innerHTML = activeCall.cameraOn ? ICON.videoOff : ICON.video;
  await updateDoc(doc(db, "calls", activeCall.callId), {
    [`media.${ownCallUid()}`]: { cameraOn: activeCall.cameraOn, updatedAt: Date.now() },
    updatedAt: serverTimestamp()
  }).catch(() => {});
  attachCallMedia();
}

function startCallTimer() {
  if (callTimer || !activeCall) return;
  const startedAt = Date.now();
  callTimer = setInterval(() => {
    const node = document.querySelector("[data-call-time]");
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (node) node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);
}

function endCall(updateRemote = true) {
  const call = activeCall;
  if (!call) return;
  if (updateRemote) updateDoc(doc(db, "calls", call.callId), { status: "ended", updatedAt: serverTimestamp() }).catch(() => {});
  call.unsubs.forEach((unsub) => unsub?.());
  call.localStream?.getTracks?.().forEach((track) => track.stop());
  call.blankVideo?.track?.stop?.();
  call.pc?.close?.();
  cleanupCallInbox(call.callId, ownCallUid());
  document.getElementById("adnnCallOverlay")?.remove();
  if (callTimer) clearInterval(callTimer);
  callTimer = null;
  activeCall = null;
}

function cleanupCallInbox(callId, uid) {
  setTimeout(() => {
    deleteDoc(doc(db, "callInbox", uid)).catch(() => {});
    getDocs(collection(db, "calls", callId, "offerCandidates")).then((snap) => snap.forEach((item) => deleteDoc(item.ref))).catch(() => {});
    getDocs(collection(db, "calls", callId, "answerCandidates")).then((snap) => snap.forEach((item) => deleteDoc(item.ref))).catch(() => {});
  }, CALL_SIGNAL_CLEANUP_DELAY_MS);
}

async function getProfile(uid, email) {
  const client = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (client?.exists()) return { uid, email, role: "client", ...client.data() };
  const designer = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designer?.exists()) return { uid, email, role: "designer", ...designer.data() };
  return { uid, email, role: isAdminEmail(email) ? "admin" : "client", name: emailKey(email).split("@")[0] };
}

function getChatTitle(chat, scope = "user") {
  if (!chat) return "Chat";
  if (chat.type === "support") {
    if (isAdminEmail(activeUser?.email) || scope === "admin") return chat.clientName || chat.clientEmail || "Client";
    return "AdnnStudio Support";
  }
  const names = chat.participantNames || {};
  const uid = getRemoteUid(chat);
  return names[uid] || chat.title || chat.clientName || chat.clientEmail || "Workspace Chat";
}

function getRemoteUid(chat) {
  if (!chat) return "";
  if (chat.type === "support") return isAdminEmail(activeUser?.email) ? chat.clientUid : ADMIN_ALIAS_UID;
  const mine = ownCallUid();
  return (chat.participantUids || []).find((uid) => uid !== activeUser?.uid && uid !== mine) || (chat.participantUids || []).find((uid) => uid !== activeUser?.uid) || "";
}

function ownCallUid() {
  return isAdminEmail(activeUser?.email) ? ADMIN_ALIAS_UID : activeUser?.uid;
}

function ownDisplayName() {
  return activeProfile?.name || activeProfile?.displayName || activeProfile?.designerName || activeProfile?.email || activeUser?.displayName || activeUser?.email || "User";
}

function roomShell(state) {
  return document.querySelector(`[data-room="${state.roomId}"]`);
}

function renderReplyBar(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const bar = shell.querySelector("[data-reply-bar]");
  if (!bar) return;
  bar.hidden = !state.replyTo;
  if (state.replyTo) bar.querySelector("span").innerHTML = `<strong>${escapeHtml(state.replyTo.senderName)}</strong><small>${escapeHtml(state.replyTo.text)}</small>`;
}

function renderReplyPreview(message) {
  const reply = message.replyTo;
  if (!reply && !message.replyToMessageId) return "";
  return `<div class="adnn-reply-preview"><strong>${escapeHtml(reply?.senderName || "Reply")}</strong><small>${escapeHtml(reply?.text || "Quoted message")}</small></div>`;
}

function renderAttachments(message) {
  const items = Array.isArray(message.attachments) && message.attachments.length
    ? message.attachments
    : message.mediaUrl ? [{ url: message.mediaUrl, name: message.mediaName, type: message.mediaType, voice: message.mediaType?.startsWith("audio/") }] : [];
  return items.map((item) => {
    if (item.type?.startsWith("image/")) return `<a href="${escapeAttr(item.url)}" target="_blank" class="adnn-attachment-img"><img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.name || "image")}"></a>`;
    if (item.type?.startsWith("audio/") || item.voice) return `<div class="adnn-voice-bubble"><span>${ICON.mic}</span><audio controls src="${escapeAttr(item.url)}"></audio><small>${formatDuration(item.duration || 0)}</small></div>`;
    return `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener" class="adnn-doc-bubble"><span>${fileExt(item.name || "file")}</span><strong>${escapeHtml(item.name || "Open file")}</strong></a>`;
  }).join("");
}

function renderReactions(message) {
  const reactions = message.reactions || {};
  const entries = Object.entries(reactions);
  if (!entries.length) return "";
  return `<button type="button" class="adnn-reactions" data-action="react" data-emoji="${escapeAttr(reactions[activeUser.uid] || entries[0][1])}">${entries.map(([, emoji]) => escapeHtml(emoji)).join(" ")}</button>`;
}

function firstAttachmentName(message) {
  return message.attachments?.[0]?.name || message.mediaName || "";
}

function isHiddenSystemMessage(message) {
  return !!message.callEvent || isCallSummaryText(message.text);
}

function isCallSummaryText(value) {
  const text = String(value || "").toLowerCase();
  return /^incoming (audio|video) call/.test(text) || /^outgoing (audio|video) call/.test(text) || /^call (ended|missed|rejected)/.test(text);
}

function resetBodyMobileLock() {
  document.body.classList.remove("adnn-chat-mobile-lock");
}

function cleanupAll() {
  chatListUnsub?.();
  incomingCallUnsub?.();
  rooms.forEach((state) => {
    state.unsubs?.forEach((unsub) => unsub?.());
    if (state.typingTimer) clearTimeout(state.typingTimer);
  });
  rooms.clear();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  window.removeEventListener("beforeunload", markOffline);
  resetBodyMobileLock();
}

function autoSizeTextArea(node) {
  node.style.height = "auto";
  node.style.height = `${Math.min(118, node.scrollHeight)}px`;
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
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
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

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "adnn-chat-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function injectChatStyles() {
  if (document.getElementById("adnnChatRuntimeStyles")) return;
  const style = document.createElement("style");
  style.id = "adnnChatRuntimeStyles";
  style.textContent = `
    .adnn-chat-app, .adnn-chat-app * { box-sizing:border-box; }
    .adnn-chat-app [hidden], .adnn-call-overlay [hidden] { display:none !important; }
    .adnn-chat-app { width:100%; min-height:0; color:#fff; }
    .adnn-chat-layout { height:clamp(600px, calc(100svh - 210px), 820px); min-height:0; display:grid; grid-template-columns:minmax(240px, 330px) minmax(0,1fr); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:24px; background:linear-gradient(145deg, rgba(22,22,28,.92), rgba(4,4,7,.96)); box-shadow:0 24px 90px rgba(0,0,0,.32); }
    .adnn-chat-layout.is-single { grid-template-columns:1fr; }
    .adnn-chat-thread-panel { display:grid; grid-template-rows:auto 1fr; min-width:0; border-right:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); }
    .adnn-chat-thread-head { min-height:68px; padding:14px 16px; display:grid; gap:10px; align-content:center; border-bottom:1px solid rgba(255,255,255,.07); }
    .adnn-chat-thread-head strong { font-size:16px; letter-spacing:-.02em; }
    .adnn-chat-thread-head input { width:100%; height:36px; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:#050507; color:#fff; padding:0 12px; outline:0; }
    .adnn-chat-thread-list { overflow:auto; padding:10px; }
    .adnn-thread { width:100%; min-width:0; border:0; border-radius:16px; padding:12px; display:grid; grid-template-columns:44px minmax(0,1fr) auto; align-items:center; gap:12px; background:transparent; color:#fff; text-align:left; cursor:pointer; transition:.2s ease; }
    .adnn-thread:hover, .adnn-thread.is-active { background:rgba(39,45,207,.18); }
    .adnn-thread-copy { min-width:0; display:grid; gap:3px; }
    .adnn-thread-copy strong, .adnn-thread-copy small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-thread-copy strong { font-size:14px; font-weight:500; }
    .adnn-thread-copy small { color:rgba(255,255,255,.48); font-size:12px; }
    .adnn-thread b { min-width:18px; height:18px; border-radius:999px; display:grid; place-items:center; background:#ff2602; font-size:10px; }
    .adnn-avatar { width:42px; height:42px; border-radius:16px; display:grid; place-items:center; background:linear-gradient(145deg,#3036e8,#161bba); color:#fff; font-size:12px; flex:0 0 auto; box-shadow:inset 0 1px 0 rgba(255,255,255,.18); }
    .adnn-chat-room { min-width:0; min-height:0; height:100%; position:relative; overflow:hidden; }
    .adnn-chat-welcome, .adnn-chat-empty { height:100%; display:grid; place-items:center; align-content:center; gap:8px; text-align:center; color:rgba(255,255,255,.48); padding:28px; }
    .adnn-chat-logo { width:58px; height:58px; border-radius:18px; display:grid; place-items:center; background:#272dcf; color:#fff; font-size:36px; font-weight:700; }
    .adnn-chat-app .adnn-room-shell { position:absolute !important; inset:0 !important; height:100% !important; min-height:0 !important; max-height:100% !important; overflow:hidden !important; background:radial-gradient(circle at 92% 6%, rgba(39,45,207,.16), transparent 32%), #050506; --adnn-head-h:70px; --adnn-composer-h:78px; }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head { position:absolute !important; top:0 !important; left:0 !important; right:0 !important; height:70px !important; min-height:70px !important; display:flex !important; align-items:center !important; gap:12px; padding:12px 120px 12px 16px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(10,10,14,.94); backdrop-filter:blur(18px); z-index:90 !important; visibility:visible !important; opacity:1 !important; transform:none !important; }
    .adnn-chat-app .adnn-room-shell > .adnn-call-dock { position:absolute !important; top:14px !important; right:16px !important; z-index:160 !important; display:flex !important; align-items:center !important; gap:8px !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important; }
    .adnn-back-btn { display:none; }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-room-title { flex:1; min-width:0; display:grid !important; gap:2px; }
    .adnn-room-title strong, .adnn-room-title small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-room-title strong { font-size:15px; font-weight:500; }
    .adnn-room-title small { font-size:12px; color:rgba(255,255,255,.5); }
    .adnn-room-title small.is-online { color:#53d769; }
    .adnn-call-btn, .adnn-back-btn, .adnn-attach-btn, .adnn-voice-btn, .adnn-send-btn, .adnn-composer button { width:42px; height:42px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.06); cursor:pointer; transition:.2s ease; flex:0 0 auto; }
    .adnn-chat-app .adnn-room-shell .adnn-call-btn { display:grid !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important; background:rgba(255,255,255,.08); box-shadow:inset 0 1px 0 rgba(255,255,255,.08); }
    .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-back-btn { display:none !important; }
    .adnn-call-btn:hover, .adnn-attach-btn:hover, .adnn-voice-btn:hover { background:rgba(255,255,255,.1); transform:translateY(-1px); }
    .adnn-call-btn svg, .adnn-back-btn svg, .adnn-attach-btn svg, .adnn-voice-btn svg, .adnn-send-btn svg { width:19px; height:19px; }
    .adnn-chat-app .adnn-room-shell > .adnn-message-scroll { position:absolute !important; top:70px !important; left:0 !important; right:0 !important; bottom:78px !important; min-height:0 !important; overflow-y:auto !important; overflow-x:hidden !important; padding:18px; display:flex !important; flex-direction:column; gap:10px; scroll-behavior:smooth; z-index:1; }
    .adnn-message-row { display:flex; width:100%; }
    .adnn-message-row.is-mine { justify-content:flex-end; }
    .adnn-message-row.is-peer { justify-content:flex-start; }
    .adnn-message { max-width:min(68%, 560px); position:relative; padding:10px 12px 8px; border-radius:18px; color:#fff; background:rgba(255,255,255,.075); border:1px solid rgba(255,255,255,.06); box-shadow:0 12px 28px rgba(0,0,0,.16); }
    .is-mine .adnn-message { background:linear-gradient(145deg,#292fd2,#181da8); border-color:rgba(255,255,255,.11); border-bottom-right-radius:5px; }
    .is-peer .adnn-message { border-bottom-left-radius:5px; }
    .adnn-message p { margin:0; line-height:1.45; font-size:14px; word-break:break-word; white-space:pre-wrap; }
    .adnn-message-name { display:block; margin-bottom:4px; color:#9da4ff; font-size:12px; font-weight:500; }
    .adnn-message-meta { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:5px; color:rgba(255,255,255,.45); font-size:10px; }
    .adnn-ticks.is-read { color:#63c6ff; }
    .adnn-message-actions { position:absolute; top:50%; display:flex; gap:4px; padding:5px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:rgba(9,9,12,.96); opacity:0; pointer-events:none; transform:translateY(-50%) scale(.96); transition:.18s ease; z-index:30; box-shadow:0 18px 50px rgba(0,0,0,.35); }
    .is-mine .adnn-message-actions { right:calc(100% + 8px); }
    .is-peer .adnn-message-actions { left:calc(100% + 8px); }
    .adnn-message:hover .adnn-message-actions, .adnn-message:focus-within .adnn-message-actions, .adnn-message.is-menu-open .adnn-message-actions { opacity:1; pointer-events:auto; transform:translateY(-50%) scale(1); }
    .adnn-message-actions button { border:0; border-radius:10px; background:rgba(255,255,255,.07); color:#fff; padding:7px 9px; font-size:12px; cursor:pointer; }
    .adnn-message-actions .is-danger { color:#ff6b5c; }
    .adnn-reactions { position:absolute; right:10px; bottom:-14px; border:1px solid rgba(255,255,255,.1); border-radius:999px; background:#09090c; color:#fff; padding:2px 7px; font-size:12px; cursor:pointer; }
    .adnn-reply-preview, .adnn-reply-bar { display:grid; grid-template-columns:3px minmax(0,1fr) auto; gap:8px; align-items:center; margin-bottom:7px; border-radius:12px; background:rgba(0,0,0,.24); padding:8px; }
    .adnn-reply-preview:before, .adnn-reply-bar:before { content:""; width:3px; height:100%; border-radius:4px; background:#8d96ff; }
    .adnn-reply-preview strong, .adnn-reply-bar strong { display:block; font-size:12px; color:#b7bbff; }
    .adnn-reply-preview small, .adnn-reply-bar small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:rgba(255,255,255,.55); font-size:11px; }
    .adnn-attachment-img img { display:block; width:min(320px, 100%); max-height:260px; object-fit:cover; border-radius:14px; margin-bottom:7px; }
    .adnn-doc-bubble { display:flex; align-items:center; gap:10px; min-width:220px; text-decoration:none; color:#fff; padding:10px; border-radius:14px; background:rgba(0,0,0,.22); margin-bottom:7px; }
    .adnn-doc-bubble span { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:#272dcf; font-size:11px; }
    .adnn-voice-bubble { min-width:250px; display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:999px; background:rgba(0,0,0,.22); margin-bottom:7px; }
    .adnn-voice-bubble span { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.1); color:#fff; flex:0 0 auto; }
    .adnn-voice-bubble span svg { width:15px; height:15px; }
    .adnn-voice-bubble audio { width:190px; max-width:100%; height:32px; }
    .adnn-voice-bubble small { color:rgba(255,255,255,.55); font-size:11px; }
    .adnn-chat-app .adnn-room-shell > .adnn-composer-wrap { position:absolute !important; left:0 !important; right:0 !important; bottom:0 !important; min-height:78px !important; z-index:92 !important; border-top:1px solid rgba(255,255,255,.08); background:rgba(8,8,12,.96); padding:10px; box-shadow:0 -18px 45px rgba(0,0,0,.24); visibility:visible !important; opacity:1 !important; transform:none !important; }
    .adnn-composer { display:flex; align-items:flex-end; gap:9px; }
    .adnn-composer textarea { flex:1; min-height:42px; max-height:118px; resize:none; border:1px solid rgba(255,255,255,.09); border-radius:22px; background:#020203; color:#fff; outline:0; padding:12px 15px; font:inherit; font-size:14px; line-height:1.35; }
    .adnn-attach-btn input { display:none; }
    .adnn-send-btn { background:#272dcf; }
    .adnn-voice-btn.is-recording { width:auto; padding:0 14px; border-radius:22px; background:#ff2602; display:flex; gap:8px; }
    .adnn-rec-dot { width:8px; height:8px; border-radius:50%; background:#fff; animation:adnnPulse 1s infinite; }
    @keyframes adnnPulse { 50% { opacity:.3; transform:scale(.72); } }
    .adnn-typing-line { height:24px; display:flex; align-items:center; gap:4px; color:#8d96ff; font-size:12px; }
    .adnn-typing-line span { width:5px; height:5px; border-radius:50%; background:#8d96ff; animation:adnnTyping 1.1s infinite; }
    .adnn-typing-line span:nth-child(2) { animation-delay:.15s; }
    .adnn-typing-line span:nth-child(3) { animation-delay:.3s; margin-right:5px; }
    @keyframes adnnTyping { 50% { transform:translateY(-4px); opacity:.45; } }
    .adnn-file-preview { display:flex; gap:8px; overflow:auto; padding:0 0 9px; }
    .adnn-file-chip { min-width:190px; max-width:250px; display:grid; grid-template-columns:42px minmax(0,1fr) 28px; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:8px; background:rgba(255,255,255,.045); }
    .adnn-file-chip img, .adnn-file-chip > span { width:42px; height:42px; border-radius:12px; object-fit:cover; background:#272dcf; display:grid; place-items:center; font-size:10px; color:#fff; }
    .adnn-file-chip strong, .adnn-file-chip small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .adnn-file-chip strong { font-size:12px; }
    .adnn-file-chip small { color:rgba(255,255,255,.5); font-size:11px; }
    .adnn-file-chip button, .adnn-reply-bar button, .adnn-voice-preview button { width:28px; height:28px; border-radius:50%; border:0; background:rgba(255,255,255,.08); color:#fff; display:grid; place-items:center; cursor:pointer; }
    .adnn-file-chip button svg, .adnn-reply-bar button svg, .adnn-voice-preview button svg { width:14px; height:14px; }
    .adnn-voice-preview { display:flex; align-items:center; gap:10px; padding:0 0 9px; color:#fff; }
    .adnn-voice-preview-icon { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; background:#272dcf; flex:0 0 auto; }
    .adnn-voice-preview-icon svg { width:16px; height:16px; }
    .adnn-voice-preview audio { height:34px; max-width:260px; }
    .adnn-drop-layer { position:absolute; inset:72px 12px 82px; display:none; place-items:center; border:1px dashed rgba(141,150,255,.5); border-radius:24px; background:rgba(39,45,207,.16); color:#fff; z-index:8; backdrop-filter:blur(12px); }
    .adnn-room-shell.is-dragging .adnn-drop-layer { display:grid; }
    .adnn-call-overlay { position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center; background:rgba(0,0,0,.76); backdrop-filter:blur(20px); }
    .adnn-incoming-call, .adnn-call-card { width:min(520px, calc(100vw - 28px)); border:1px solid rgba(255,255,255,.12); border-radius:28px; background:linear-gradient(145deg, rgba(20,20,26,.96), rgba(5,5,8,.98)); color:#fff; padding:22px; text-align:center; box-shadow:0 30px 100px rgba(0,0,0,.5); }
    .adnn-incoming-call h3 { margin:14px 0 4px; }
    .adnn-incoming-call p { color:rgba(255,255,255,.58); margin:0 0 20px; }
    .adnn-incoming-call div, .adnn-call-controls { display:flex; justify-content:center; gap:12px; }
    .adnn-incoming-call button, .adnn-call-controls button { width:50px; height:50px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.08); cursor:pointer; }
    .adnn-incoming-call button svg, .adnn-call-controls button svg { width:21px; height:21px; }
    .adnn-incoming-call .is-accept { background:#25d366; }
    .adnn-incoming-call .is-end, .adnn-call-controls .is-end { background:#ff3b30; }
    .adnn-call-stage { position:relative; aspect-ratio:16/10; border-radius:20px; background:#000; overflow:hidden; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr; gap:1px; }
    .adnn-call-stage .adnn-video-tile:only-child { grid-column:1 / -1; }
    .adnn-video-tile { min-width:0; min-height:0; position:relative; background:#000; }
    .adnn-video-tile video { width:100%; height:100%; object-fit:cover; display:block; }
    .adnn-video-tile.is-local video { transform:scaleX(-1); }
    .adnn-video-tile span { position:absolute; left:10px; bottom:10px; padding:5px 8px; border-radius:999px; background:rgba(0,0,0,.48); font-size:11px; }
    .adnn-audio-call-face { grid-column:1 / -1; display:grid; place-items:center; }
    .adnn-call-meta { text-align:left; margin:0 0 14px; }
    .adnn-call-meta strong, .adnn-call-meta small { display:block; }
    .adnn-call-meta small { color:rgba(255,255,255,.55); margin-top:3px; }
    .adnn-chat-toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:2147483640; padding:10px 14px; border-radius:999px; background:#111; color:#fff; border:1px solid rgba(255,255,255,.1); box-shadow:0 16px 50px rgba(0,0,0,.3); }
    
    @media (max-width:760px) {
      .adnn-chat-app { display: block !important; }
      .adnn-chat-app .adnn-chat-layout.is-room-open, 
      body.adnn-chat-mobile-lock .adnn-chat-layout { 
        position:fixed !important; 
        inset:0 !important; 
        z-index:2147483200 !important; 
        height:100svh !important; 
        width:100vw !important;
        border:0 !important; 
        border-radius:0 !important; 
      }
      .adnn-chat-layout { grid-template-columns:1fr; height: 100%; }
      .adnn-chat-thread-panel { border-right:0; }
      .adnn-chat-layout .adnn-chat-room { display:none; }
      .adnn-chat-layout.is-single .adnn-chat-room { display:block; height:100svh; }
      .adnn-chat-layout.is-room-open .adnn-chat-thread-panel { display:none; }
      .adnn-chat-layout.is-room-open .adnn-chat-room { display:block; height:100svh; }
      .adnn-chat-app .adnn-room-shell > .adnn-room-head .adnn-back-btn { display:grid !important; }
      .adnn-chat-app .adnn-room-shell { height:100svh !important; --adnn-head-h:62px; --adnn-composer-h:76px; }
      .adnn-message { max-width:86%; }
      .adnn-chat-app .adnn-room-shell > .adnn-message-scroll { top:62px !important; bottom:76px !important; padding:12px 10px; }
      .adnn-chat-app .adnn-room-shell > .adnn-room-head { height:62px !important; min-height:62px !important; padding:10px 100px 10px 10px; gap:8px; }
      .adnn-chat-app .adnn-room-shell > .adnn-call-dock { top:11px !important; right:10px !important; gap:6px !important; }
      .adnn-call-btn, .adnn-back-btn, .adnn-attach-btn, .adnn-voice-btn, .adnn-send-btn { width:39px; height:39px; }
      .adnn-chat-app .adnn-room-shell > .adnn-composer-wrap { min-height:76px !important; padding:8px; }
      .adnn-composer textarea { font-size:16px; }
      .is-mine .adnn-message-actions, .is-peer .adnn-message-actions { top:auto; bottom:calc(100% + 8px); left:0; right:auto; transform:translateY(4px) scale(.96); max-width:calc(100vw - 28px); overflow:auto; }
      .adnn-message:hover .adnn-message-actions, .adnn-message:focus-within .adnn-message-actions, .adnn-message.is-menu-open .adnn-message-actions { transform:translateY(0) scale(1); }
      .adnn-call-stage { grid-template-columns:1fr; aspect-ratio:9/12; }
    }
  `;
  document.head.appendChild(style);
}
