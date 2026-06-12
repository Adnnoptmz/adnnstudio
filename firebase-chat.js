import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limitToLast,
  serverTimestamp,
  arrayUnion,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const ADMIN_ALIAS_EMAIL = "admin@adnnstudio.com";
const SUPPORT_EMAIL = "support@adnnstudio.com";
const MESSAGE_LIMIT = 180;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PRESENCE_HEARTBEAT_MS = 25000;
const TYPING_IDLE_MS = 1400;
const CALL_EXPIRES_MS = 60000;
const REACTIONS = ["❤️", "👍", "😂", "🔥", "🙏", "✅"];

const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L8 9.68a16 16 0 0 0 6.32 6.32l1.25-1.25a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 10 6-3v10l-6-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  attach: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.7 8.7a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m22 2-7 20-4-9-9-4 20-7Z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  smile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 14s1.4 2 4 2 4-2 4-2M9 9h.01M15 9h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 9V5l-7 7 7 7v-4h5a6 6 0 0 1 6 6v-2a10 10 0 0 0-10-10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 13 4 4L20 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  doubleCheck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 13 4 4L18 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m11 17 2 2 9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

let app;
let auth;
let db;
let storage;
let activeUser = null;
let activeProfile = null;
let activeIsAdmin = false;
let activeIsDesigner = false;
let globalUnsubs = [];
let activeCall = null;
let messageTone = null;

const isMobile = () => window.matchMedia("(max-width: 760px)").matches;
const nowMs = () => Date.now();
const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const ownCallUid = () => (activeIsAdmin ? ADMIN_ALIAS_UID : activeUser?.uid || "");
const profileName = () => activeProfile?.displayName || activeUser?.displayName || activeUser?.email?.split("@")[0] || "AdnnStudio user";
const profileEmail = () => activeProfile?.email || activeUser?.email || "";
const profilePhoto = () => activeProfile?.photoURL || activeUser?.photoURL || "";

function boot() {
  injectStyles();
  const config = window.ADNN_FIREBASE_CONFIG;
  if (!config) return;
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  messageTone = new Audio("Message Notification.wav");
  messageTone.preload = "auto";

  onAuthStateChanged(auth, async (user) => {
    cleanupGlobal();
    document.body.classList.remove("adnn-chat-mobile-lock");
    if (!user) return;
    activeUser = user;
    activeProfile = await readProfile(user);
    activeIsAdmin = await isAdminAccount(user);
    activeIsDesigner = await isDesignerAccount(user);
    startPresence();
    watchIncomingCalls();
    mountMessengerApps();
  });
}

async function readProfile(user) {
  const base = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "AdnnStudio user",
    photoURL: user.photoURL || ""
  };
  try {
    const designer = await getDoc(doc(db, "designers", user.uid));
    if (designer.exists()) {
      const data = designer.data();
      return {
        ...base,
        ...data,
        email: data.authEmail || user.email || base.email,
        displayName: data.displayName || data.name || base.displayName
      };
    }
  } catch (_) {}
  try {
    const client = await getDoc(doc(db, "clients", user.uid));
    if (client.exists()) {
      const data = client.data();
      return {
        ...base,
        ...data,
        email: data.email || user.email || base.email,
        displayName: data.displayName || data.name || base.displayName
      };
    }
  } catch (_) {}
  return base;
}

async function isAdminAccount(user) {
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    if (snap.exists()) return true;
  } catch (_) {}
  return cleanEmail(user.email) === ADMIN_EMAIL;
}

async function isDesignerAccount(user) {
  try {
    const snap = await getDoc(doc(db, "designers", user.uid));
    return snap.exists();
  } catch (_) {
    return false;
  }
}

function cleanupGlobal() {
  globalUnsubs.forEach((unsub) => {
    try { unsub(); } catch (_) {}
  });
  globalUnsubs = [];
  document.querySelectorAll("[data-adnn-call-overlay]").forEach((node) => node.remove());
  if (activeCall) endCall("ended", true);
  activeUser = null;
  activeProfile = null;
  activeIsAdmin = false;
  activeIsDesigner = false;
}

function mountMessengerApps() {
  const directMount = document.getElementById("directChatMount");
  const supportMount = document.getElementById("clientChatMount");
  const adminMount = document.getElementById("adminChatMount");

  if (directMount) {
    new MessengerApp(directMount, {
      mode: "direct",
      title: "User Chats",
      emptyTitle: "No chats yet",
      emptyText: "When a direct conversation is connected, it will appear here."
    }).init();
  }

  if (supportMount) {
    new MessengerApp(supportMount, {
      mode: "support",
      title: "Admin Support",
      emptyTitle: "Support is ready",
      emptyText: "Open a private support thread with AdnnStudio."
    }).init();
  }

  if (adminMount && activeIsAdmin) {
    new MessengerApp(adminMount, {
      mode: "admin",
      title: "All Client Chats",
      emptyTitle: "No chat threads",
      emptyText: "Client and designer conversations will appear here."
    }).init();
  } else if (adminMount) {
    adminMount.innerHTML = emptyAccessMarkup("Admin chat locked", "Sign in with the tagged admin Google account to load private chats.");
  }
}

class MessengerApp {
  constructor(mount, options) {
    this.mount = mount;
    this.options = options;
    this.mode = options.mode;
    this.threads = [];
    this.selectedChat = null;
    this.messages = [];
    this.remotePresence = null;
    this.unsubs = [];
    this.messageUnsubs = [];
    this.pendingFiles = [];
    this.voiceDraft = null;
    this.replyDraft = null;
    this.recording = null;
    this.typingTimer = null;
    this.typingThrottle = 0;
    this.lastSeenMessageId = "";
  }

  init() {
    this.mount.classList.add("adnn-chat-root");
    this.renderShell();
    this.watchThreads();
    this.bindShell();
    globalUnsubs.push(() => this.destroy());
  }

  destroy() {
    this.unsubs.forEach((unsub) => {
      try { unsub(); } catch (_) {}
    });
    this.unsubs = [];
    this.clearRoomWatchers();
  }

  clearRoomWatchers() {
    this.messageUnsubs.forEach((unsub) => {
      try { unsub(); } catch (_) {}
    });
    this.messageUnsubs = [];
    this.stopTyping(false);
    this.stopRecording(true);
  }

  renderShell() {
    this.mount.innerHTML = `
      <div class="adnn-chat-layout" data-chat-layout>
        <aside class="adnn-thread-panel" data-thread-panel>
          <div class="adnn-thread-head">
            <div>
              <p class="adnn-mini-label">${escapeHtml(this.options.title)}</p>
              <h2>Messages</h2>
            </div>
            <div class="adnn-thread-actions">
              <button type="button" class="adnn-icon-btn" data-refresh-threads aria-label="Refresh chats">${ICONS.menu}</button>
              <a class="adnn-icon-btn" href="index.html#home" aria-label="Back home">${ICONS.home}</a>
            </div>
          </div>
          <div class="adnn-thread-search">
            <input type="search" data-thread-search placeholder="Search chats">
          </div>
          <div class="adnn-thread-list" data-thread-list>
            ${loadingMarkup("Loading chats")}
          </div>
        </aside>
        <section class="adnn-room-shell" data-room-shell>
          ${this.emptyRoomMarkup()}
        </section>
      </div>
    `;
  }

  bindShell() {
    this.mount.querySelector("[data-refresh-threads]")?.addEventListener("click", () => this.renderThreadList());
    this.mount.querySelector("[data-thread-search]")?.addEventListener("input", (event) => {
      this.renderThreadList(event.currentTarget.value);
    });
  }

  async watchThreads() {
    if (this.mode === "support") {
      const chat = await this.ensureSupportChat();
      if (!chat) {
        this.mount.querySelector("[data-thread-list]").innerHTML = emptyMiniMarkup("Support unavailable", "Refresh after signing in again.");
        return;
      }
      this.threads = [chat];
      this.renderThreadList();
      this.openRoom(chat, { fromAuto: !isMobile() });
      const unsub = onSnapshot(doc(db, "chats", chat.id), (snap) => {
        if (!snap.exists()) return;
        const fresh = normalizeChat(snap);
        this.threads = [fresh];
        this.renderThreadList();
        if (this.selectedChat?.id === fresh.id) this.selectedChat = fresh;
      });
      this.unsubs.push(unsub);
      return;
    }

    if (this.mode === "admin") {
      const unsub = onSnapshot(collection(db, "chats"), (snap) => {
        this.threads = snap.docs.map(normalizeChat).sort(sortChats);
        this.renderThreadList();
        if (!this.selectedChat && this.threads[0] && !isMobile()) this.openRoom(this.threads[0], { fromAuto: true });
      }, (error) => {
        this.mount.querySelector("[data-thread-list]").innerHTML = emptyMiniMarkup("Could not load chats", error.message || "Check admin Firebase rules.");
      });
      this.unsubs.push(unsub);
      return;
    }

    const merge = new Map();
    const repaint = () => {
      this.threads = Array.from(merge.values()).filter((chat) => chat.type !== "support").sort(sortChats);
      this.renderThreadList();
      if (!this.selectedChat && this.threads[0] && !isMobile()) this.openRoom(this.threads[0], { fromAuto: true });
    };

    const userQuery = query(collection(db, "chats"), where("participantUids", "array-contains", activeUser.uid));
    this.unsubs.push(onSnapshot(userQuery, (snap) => {
      snap.docs.forEach((item) => merge.set(item.id, normalizeChat(item)));
      repaint();
    }));

    if (activeIsDesigner) {
      const roomQuery = query(collection(db, "chats"), where("type", "==", "designer-room"));
      this.unsubs.push(onSnapshot(roomQuery, (snap) => {
        snap.docs.forEach((item) => merge.set(item.id, normalizeChat(item)));
        repaint();
      }));
    }
  }

  async ensureSupportChat() {
    if (!activeUser) return null;
    const chatId = `support_${activeUser.uid}`;
    const refDoc = doc(db, "chats", chatId);
    const payload = {
      type: "support",
      title: `AdnnStudio / ${profileName()}`,
      clientUid: activeUser.uid,
      clientEmail: profileEmail(),
      clientName: profileName(),
      participantUids: [activeUser.uid, ADMIN_ALIAS_UID],
      participantEmails: [profileEmail(), SUPPORT_EMAIL],
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs()
    };
    const existing = await getDoc(refDoc);
    if (!existing.exists()) {
      await setDoc(refDoc, {
        ...payload,
        createdAt: serverTimestamp(),
        createdAtMs: nowMs(),
        lastMessage: "",
        lastSenderUid: ""
      });
    } else {
      await setDoc(refDoc, payload, { merge: true });
    }
    const snap = await getDoc(refDoc);
    return snap.exists() ? normalizeChat(snap) : { id: chatId, ...payload };
  }

  renderThreadList(searchTerm = "") {
    const list = this.mount.querySelector("[data-thread-list]");
    if (!list) return;
    const needle = searchTerm.trim().toLowerCase();
    const filtered = this.threads.filter((chat) => {
      if (!needle) return true;
      return `${chatTitle(chat)} ${chat.lastMessage || ""} ${chat.clientEmail || ""}`.toLowerCase().includes(needle);
    });

    if (!filtered.length) {
      list.innerHTML = emptyMiniMarkup(this.options.emptyTitle, this.options.emptyText);
      return;
    }

    list.innerHTML = filtered.map((chat) => {
      const selected = this.selectedChat?.id === chat.id;
      const title = chatTitle(chat);
      const initials = getInitials(title);
      const preview = chat.lastMessage || "No messages yet.";
      const time = relativeTime(chat.updatedAtMs || chat.createdAtMs);
      return `
        <button type="button" class="adnn-thread-row ${selected ? "is-active" : ""}" data-chat-id="${escapeAttr(chat.id)}">
          <span class="adnn-avatar">${escapeHtml(initials)}</span>
          <span class="adnn-thread-copy">
            <span class="adnn-thread-title">${escapeHtml(title)}</span>
            <span class="adnn-thread-preview">${escapeHtml(preview)}</span>
          </span>
          <span class="adnn-thread-time">${escapeHtml(time)}</span>
        </button>
      `;
    }).join("");

    list.querySelectorAll("[data-chat-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const chat = this.threads.find((item) => item.id === button.dataset.chatId);
        if (chat) this.openRoom(chat);
      });
    });
  }

  emptyRoomMarkup() {
    return `
      <div class="adnn-room-empty">
        <span class="adnn-empty-orb">a</span>
        <h3>${escapeHtml(this.options.emptyTitle)}</h3>
        <p>${escapeHtml(this.options.emptyText)}</p>
      </div>
    `;
  }

  openRoom(chat, opts = {}) {
    this.clearRoomWatchers();
    this.selectedChat = chat;
    this.messages = [];
    this.pendingFiles = [];
    this.voiceDraft = null;
    this.replyDraft = null;
    this.remotePresence = null;
    this.lastSeenMessageId = "";

    const layout = this.mount.querySelector("[data-chat-layout]");
    layout?.classList.add("is-room-open");
    if (isMobile()) document.body.classList.add("adnn-chat-mobile-lock");
    this.renderThreadList(this.mount.querySelector("[data-thread-search]")?.value || "");
    this.renderRoom();
    this.bindRoom();
    this.watchPresence();
    this.watchMessages();
    this.watchTyping();
    if (!opts.fromAuto) requestAnimationFrame(() => this.scrollMessages(true));
  }

  closeRoom() {
    this.clearRoomWatchers();
    this.selectedChat = null;
    this.messages = [];
    this.mount.querySelector("[data-chat-layout]")?.classList.remove("is-room-open");
    document.body.classList.remove("adnn-chat-mobile-lock");
    this.mount.querySelector("[data-room-shell]").innerHTML = this.emptyRoomMarkup();
    this.renderThreadList(this.mount.querySelector("[data-thread-search]")?.value || "");
  }

  renderRoom() {
    const shell = this.mount.querySelector("[data-room-shell]");
    if (!shell || !this.selectedChat) return;
    const remoteCallUid = this.getRemoteCallUid();
    const canCall = Boolean(remoteCallUid);
    shell.innerHTML = `
      <header class="adnn-room-head" data-room-head>
        <button type="button" class="adnn-room-back" data-back-room aria-label="Back to chats">${ICONS.back}</button>
        <span class="adnn-avatar">${escapeHtml(getInitials(chatTitle(this.selectedChat)))}</span>
        <div class="adnn-room-title">
          <strong>${escapeHtml(chatTitle(this.selectedChat))}</strong>
          <small data-room-status>Checking status...</small>
          <em data-typing-line></em>
        </div>
        <div class="adnn-room-tools">
          <button type="button" class="adnn-icon-btn" data-audio-call ${canCall ? "" : "disabled"} aria-label="Audio call">${ICONS.phone}</button>
          <button type="button" class="adnn-icon-btn" data-video-call ${canCall ? "" : "disabled"} aria-label="Video call">${ICONS.video}</button>
        </div>
      </header>
      <main class="adnn-message-scroll" data-message-scroll>
        ${loadingMarkup("Loading messages")}
      </main>
      <footer class="adnn-composer-wrap" data-composer-wrap>
        <div class="adnn-reply-preview" data-reply-preview hidden></div>
        <div class="adnn-upload-preview" data-upload-preview hidden></div>
        <div class="adnn-voice-preview" data-voice-preview hidden></div>
        <form class="adnn-composer" data-composer>
          <input type="file" data-file-input multiple hidden>
          <button type="button" class="adnn-round-btn" data-attach-file aria-label="Attach files">${ICONS.attach}</button>
          <textarea data-message-input rows="1" placeholder="Message"></textarea>
          <button type="button" class="adnn-round-btn adnn-primary-action" data-primary-action aria-label="Record voice">${ICONS.mic}</button>
        </form>
      </footer>
    `;
    this.updateComposerState();
  }

  bindRoom() {
    const shell = this.mount.querySelector("[data-room-shell]");
    shell.querySelector("[data-back-room]")?.addEventListener("click", () => this.closeRoom());
    shell.querySelector("[data-audio-call]")?.addEventListener("click", () => this.startCall("audio"));
    shell.querySelector("[data-video-call]")?.addEventListener("click", () => this.startCall("video"));
    shell.querySelector("[data-attach-file]")?.addEventListener("click", () => shell.querySelector("[data-file-input]")?.click());
    shell.querySelector("[data-file-input]")?.addEventListener("change", (event) => this.addFiles(event.currentTarget.files));
    shell.querySelector("[data-primary-action]")?.addEventListener("click", () => this.handlePrimaryAction());
    shell.querySelector("[data-composer]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.sendMessage();
    });

    const input = shell.querySelector("[data-message-input]");
    input?.addEventListener("input", () => {
      autoGrow(input);
      this.updateComposerState();
      this.noteTyping();
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
  }

  watchMessages() {
    if (!this.selectedChat) return;
    const msgQuery = query(
      collection(db, "chats", this.selectedChat.id, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(MESSAGE_LIMIT)
    );
    const unsub = onSnapshot(msgQuery, (snap) => {
      const beforeLast = this.messages[this.messages.length - 1]?.id || "";
      this.messages = snap.docs.map(normalizeMessage).filter((msg) => !(msg.deletedFor || []).includes(activeUser.uid));
      this.renderMessages();
      this.markMessagesRead();
      const afterLast = this.messages[this.messages.length - 1]?.id || "";
      if (afterLast && afterLast !== beforeLast) {
        const newest = this.messages[this.messages.length - 1];
        if (beforeLast && newest.senderUid !== activeUser.uid) softPlayTone();
        this.scrollMessages(!beforeLast || newest.senderUid === activeUser.uid || this.isNearBottom());
      }
    }, (error) => {
      const scroller = this.mount.querySelector("[data-message-scroll]");
      if (scroller) scroller.innerHTML = emptyMiniMarkup("Messages unavailable", error.message || "Please refresh.");
    });
    this.messageUnsubs.push(unsub);
  }

  renderMessages() {
    const scroller = this.mount.querySelector("[data-message-scroll]");
    if (!scroller) return;
    if (!this.messages.length) {
      scroller.innerHTML = emptyMiniMarkup("No messages yet", "Send the first message in this conversation.");
      return;
    }
    let lastDay = "";
    scroller.innerHTML = this.messages.map((message) => {
      const day = dayLabel(message.createdAtMs);
      const divider = day !== lastDay ? `<div class="adnn-day-divider">${escapeHtml(day)}</div>` : "";
      lastDay = day;
      return divider + this.messageMarkup(message);
    }).join("");

    scroller.querySelectorAll("[data-message-id]").forEach((node) => {
      const message = this.messages.find((item) => item.id === node.dataset.messageId);
      if (!message) return;
      bindLongPress(node, (event) => this.openMessageMenu(message, event));
      node.querySelector("[data-message-more]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openMessageMenu(message, event);
      });
      node.querySelector("[data-message-react]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openReactionStrip(message, event.currentTarget);
      });
    });
  }

  messageMarkup(message) {
    const mine = message.senderUid === activeUser.uid;
    const isDeleted = Boolean(message.deletedForAll);
    const read = mine && (message.readBy || []).some((uid) => uid !== activeUser.uid);
    const sender = mine ? "You" : (message.senderName || message.senderEmail || "User");
    const time = formatTime(message.createdAtMs);
    const attachments = Array.isArray(message.attachments) ? message.attachments : legacyAttachment(message);
    const hasBody = message.text || attachments.length || isDeleted;
    if (!hasBody) return "";
    return `
      <article class="adnn-message ${mine ? "is-mine" : "is-theirs"} ${isDeleted ? "is-deleted" : ""}" data-message-id="${escapeAttr(message.id)}">
        <div class="adnn-bubble">
          <div class="adnn-message-tools">
            <button type="button" data-message-react aria-label="React">${ICONS.smile}</button>
            <button type="button" data-message-more aria-label="Message actions">${ICONS.dots}</button>
          </div>
          ${mine ? "" : `<span class="adnn-sender">${escapeHtml(sender)}</span>`}
          ${message.replyTo ? replyMarkup(message.replyTo) : ""}
          ${isDeleted ? `<em class="adnn-deleted-text">Message deleted</em>` : `
            ${message.text ? `<p>${linkify(escapeHtml(message.text))}</p>` : ""}
            ${attachments.map((item) => attachmentMarkup(item)).join("")}
          `}
          ${reactionSummary(message.reactions)}
          <footer>
            <span>${escapeHtml(time)}</span>
            ${mine ? `<span class="adnn-read ${read ? "is-read" : ""}">${read ? ICONS.doubleCheck : ICONS.check}</span>` : ""}
          </footer>
        </div>
      </article>
    `;
  }

  async markMessagesRead() {
    if (!this.selectedChat) return;
    const unread = this.messages.filter((msg) => msg.senderUid !== activeUser.uid && !(msg.readBy || []).includes(activeUser.uid));
    await Promise.all(unread.slice(-20).map((msg) => updateDoc(doc(db, "chats", this.selectedChat.id, "messages", msg.id), {
      readBy: arrayUnion(activeUser.uid)
    }).catch(() => {})));
  }

  async sendMessage() {
    if (!this.selectedChat) return;
    const input = this.mount.querySelector("[data-message-input]");
    const text = (input?.value || "").trim();
    if (!text && !this.pendingFiles.length && !this.voiceDraft) {
      if (!this.recording) this.startRecording();
      return;
    }
    const button = this.mount.querySelector("[data-primary-action]");
    button?.setAttribute("disabled", "disabled");
    try {
      const attachments = [];
      for (const file of this.pendingFiles) {
        attachments.push(await this.uploadAttachment(file.file, file.kind || "file", file.duration || 0));
      }
      if (this.voiceDraft) {
        attachments.push(await this.uploadAttachment(this.voiceDraft.blob, "voice", this.voiceDraft.duration || 0, this.voiceDraft.name));
      }
      const first = attachments[0] || null;
      const message = {
        text,
        senderUid: activeUser.uid,
        senderAliasUid: ownCallUid(),
        senderEmail: profileEmail(),
        senderName: profileName(),
        senderPhoto: profilePhoto(),
        readBy: [activeUser.uid],
        reactions: {},
        deletedFor: [],
        deletedForAll: false,
        attachments,
        mediaUrl: first?.url || "",
        mediaName: first?.name || "",
        mediaType: first?.type || "",
        replyTo: this.replyDraft ? {
          id: this.replyDraft.id,
          senderName: this.replyDraft.senderName || this.replyDraft.senderEmail || "User",
          text: this.replyDraft.text || firstAttachmentName(this.replyDraft) || "Attachment"
        } : null,
        createdAt: serverTimestamp(),
        createdAtMs: nowMs()
      };
      await addDoc(collection(db, "chats", this.selectedChat.id, "messages"), message);
      await setDoc(doc(db, "chats", this.selectedChat.id), {
        lastMessage: text || first?.name || (this.voiceDraft ? "Voice message" : "Attachment"),
        lastSenderUid: activeUser.uid,
        lastSenderName: profileName(),
        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs()
      }, { merge: true });
      input.value = "";
      this.pendingFiles = [];
      this.voiceDraft = null;
      this.replyDraft = null;
      this.stopTyping(false);
      this.updateComposerState();
      this.renderDraftPreviews();
      requestAnimationFrame(() => this.scrollMessages(true));
    } catch (error) {
      alert(`Could not send message: ${error.message || error}`);
    } finally {
      button?.removeAttribute("disabled");
    }
  }

  async uploadAttachment(fileOrBlob, kind, duration = 0, forcedName = "") {
    const originalName = forcedName || fileOrBlob.name || `${kind}-${nowMs()}.webm`;
    const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 90);
    const path = `chat-media/${this.selectedChat.id}/${activeUser.uid}/${nowMs()}_${safeName}`;
    const fileRef = ref(storage, path);
    const metadata = { contentType: fileOrBlob.type || "application/octet-stream" };
    const snap = await uploadBytes(fileRef, fileOrBlob, metadata);
    const url = await getDownloadURL(snap.ref);
    return {
      url,
      path,
      kind,
      name: originalName,
      type: fileOrBlob.type || "application/octet-stream",
      size: fileOrBlob.size || 0,
      duration
    };
  }

  addFiles(fileList) {
    const files = Array.from(fileList || []);
    const accepted = [];
    files.forEach((file) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        alert(`${file.name} is bigger than 10MB.`);
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${nowMs()}-${Math.random().toString(16).slice(2)}`,
        file,
        kind: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file",
        previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : ""
      });
    });
    this.pendingFiles.push(...accepted);
    this.renderDraftPreviews();
    this.updateComposerState();
    const input = this.mount.querySelector("[data-file-input]");
    if (input) input.value = "";
  }

  removePendingFile(id) {
    const item = this.pendingFiles.find((file) => file.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    this.pendingFiles = this.pendingFiles.filter((file) => file.id !== id);
    this.renderDraftPreviews();
    this.updateComposerState();
  }

  renderDraftPreviews() {
    const upload = this.mount.querySelector("[data-upload-preview]");
    if (upload) {
      upload.hidden = !this.pendingFiles.length;
      upload.innerHTML = this.pendingFiles.map((item) => `
        <div class="adnn-draft-file">
          ${item.previewUrl && item.kind === "image" ? `<img src="${escapeAttr(item.previewUrl)}" alt="">` : ""}
          ${item.previewUrl && item.kind === "video" ? `<video src="${escapeAttr(item.previewUrl)}" muted playsinline></video>` : ""}
          <span>${escapeHtml(item.file.name)}</span>
          <button type="button" data-remove-file="${escapeAttr(item.id)}">${ICONS.close}</button>
        </div>
      `).join("");
      upload.querySelectorAll("[data-remove-file]").forEach((button) => {
        button.addEventListener("click", () => this.removePendingFile(button.dataset.removeFile));
      });
    }

    const reply = this.mount.querySelector("[data-reply-preview]");
    if (reply) {
      reply.hidden = !this.replyDraft;
      reply.innerHTML = this.replyDraft ? `
        <div><strong>Replying to ${escapeHtml(this.replyDraft.senderName || "message")}</strong><span>${escapeHtml(this.replyDraft.text || firstAttachmentName(this.replyDraft) || "Attachment")}</span></div>
        <button type="button" data-clear-reply>${ICONS.close}</button>
      ` : "";
      reply.querySelector("[data-clear-reply]")?.addEventListener("click", () => {
        this.replyDraft = null;
        this.renderDraftPreviews();
      });
    }

    const voice = this.mount.querySelector("[data-voice-preview]");
    if (voice) {
      voice.hidden = !this.voiceDraft && !this.recording;
      if (this.recording) {
        voice.innerHTML = `
          <div class="adnn-recording-pill"><span></span> Recording <b data-recording-time>${formatDuration(this.recording.seconds)}</b></div>
          <button type="button" data-stop-recording>${ICONS.stop}</button>
          <button type="button" data-cancel-recording>${ICONS.close}</button>
        `;
        voice.querySelector("[data-stop-recording]")?.addEventListener("click", () => this.stopRecording(false));
        voice.querySelector("[data-cancel-recording]")?.addEventListener("click", () => this.stopRecording(true));
      } else if (this.voiceDraft) {
        voice.innerHTML = `
          <audio controls src="${escapeAttr(this.voiceDraft.url)}"></audio>
          <span>${formatDuration(this.voiceDraft.duration || 0)}</span>
          <button type="button" data-remove-voice>${ICONS.close}</button>
        `;
        voice.querySelector("[data-remove-voice]")?.addEventListener("click", () => {
          URL.revokeObjectURL(this.voiceDraft.url);
          this.voiceDraft = null;
          this.renderDraftPreviews();
          this.updateComposerState();
        });
      }
    }
  }

  updateComposerState() {
    const input = this.mount.querySelector("[data-message-input]");
    const button = this.mount.querySelector("[data-primary-action]");
    if (!button) return;
    const hasPayload = Boolean((input?.value || "").trim() || this.pendingFiles.length || this.voiceDraft);
    button.innerHTML = hasPayload ? ICONS.send : ICONS.mic;
    button.setAttribute("aria-label", hasPayload ? "Send message" : "Record voice");
    button.classList.toggle("is-send", hasPayload);
  }

  handlePrimaryAction() {
    const input = this.mount.querySelector("[data-message-input]");
    const hasPayload = Boolean((input?.value || "").trim() || this.pendingFiles.length || this.voiceDraft);
    if (hasPayload) this.sendMessage();
    else this.startRecording();
  }

  async startRecording() {
    if (this.recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Voice recording is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      this.recording = {
        recorder,
        stream,
        chunks,
        seconds: 0,
        timer: window.setInterval(() => {
          if (!this.recording) return;
          this.recording.seconds += 1;
          const node = this.mount.querySelector("[data-recording-time]");
          if (node) node.textContent = formatDuration(this.recording.seconds);
        }, 1000)
      };
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (!this.recording) return;
        const duration = this.recording.seconds;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        this.recording.stream.getTracks().forEach((track) => track.stop());
        window.clearInterval(this.recording.timer);
        this.voiceDraft = {
          blob,
          duration,
          name: `voice-${nowMs()}.webm`,
          url: URL.createObjectURL(blob)
        };
        this.recording = null;
        this.renderDraftPreviews();
        this.updateComposerState();
      });
      recorder.start();
      this.renderDraftPreviews();
    } catch (error) {
      alert(`Microphone permission failed: ${error.message || error}`);
    }
  }

  stopRecording(cancel) {
    if (!this.recording) return;
    const current = this.recording;
    window.clearInterval(current.timer);
    if (cancel) {
      current.stream.getTracks().forEach((track) => track.stop());
      this.recording = null;
      this.renderDraftPreviews();
      this.updateComposerState();
      return;
    }
    if (current.recorder.state !== "inactive") current.recorder.stop();
  }

  noteTyping() {
    if (!this.selectedChat) return;
    const time = nowMs();
    if (time - this.typingThrottle > 800) {
      this.typingThrottle = time;
      setDoc(doc(db, "chats", this.selectedChat.id, "typing", activeUser.uid), {
        uid: activeUser.uid,
        name: profileName(),
        isTyping: true,
        updatedAtMs: time,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
    window.clearTimeout(this.typingTimer);
    this.typingTimer = window.setTimeout(() => this.stopTyping(true), TYPING_IDLE_MS);
  }

  stopTyping(write = true) {
    window.clearTimeout(this.typingTimer);
    this.typingTimer = null;
    if (write && this.selectedChat && activeUser) {
      setDoc(doc(db, "chats", this.selectedChat.id, "typing", activeUser.uid), {
        uid: activeUser.uid,
        name: profileName(),
        isTyping: false,
        updatedAtMs: nowMs(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  }

  watchTyping() {
    if (!this.selectedChat) return;
    const unsub = onSnapshot(collection(db, "chats", this.selectedChat.id, "typing"), (snap) => {
      const typing = snap.docs.map((item) => item.data()).filter((item) => {
        return item.uid !== activeUser.uid && item.isTyping && nowMs() - Number(item.updatedAtMs || 0) < 6000;
      });
      const node = this.mount.querySelector("[data-typing-line]");
      if (node) node.textContent = typing.length ? `${typing[0].name || "Someone"} is typing...` : "";
    });
    this.messageUnsubs.push(unsub);
  }

  watchPresence() {
    const status = this.mount.querySelector("[data-room-status]");
    if (!this.selectedChat || !status) return;
    const remoteUid = this.getRemotePresenceUid();
    if (!remoteUid) {
      status.textContent = this.selectedChat.type === "designer-room" ? "Designer room" : "Group chat";
      return;
    }
    const unsub = onSnapshot(doc(db, "presence", remoteUid), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      this.remotePresence = data;
      status.textContent = presenceText(data);
    }, () => {
      status.textContent = "Offline";
    });
    this.messageUnsubs.push(unsub);
  }

  getRemotePresenceUid() {
    const chat = this.selectedChat;
    if (!chat) return "";
    if (this.mode === "admin") return chat.clientUid || firstOtherUid(chat);
    if (chat.type === "support") return ADMIN_ALIAS_UID;
    return firstOtherUid(chat);
  }

  getRemoteCallUid() {
    const chat = this.selectedChat;
    if (!chat) return "";
    if (chat.type === "designer-room") return "";
    if (this.mode === "admin") return chat.clientUid || firstOtherUid(chat);
    if (chat.type === "support") return ADMIN_ALIAS_UID;
    return firstOtherUid(chat);
  }

  async openMessageMenu(message, event) {
    closeFloatingMenus();
    const menu = document.createElement("div");
    menu.className = "adnn-message-menu";
    menu.innerHTML = `
      <button type="button" data-action="reply">${ICONS.reply}<span>Reply</span></button>
      <button type="button" data-action="react">${ICONS.smile}<span>React</span></button>
      <button type="button" data-action="delete-me">${ICONS.trash}<span>Delete for me</span></button>
      ${(message.senderUid === activeUser.uid || activeIsAdmin) ? `<button type="button" data-action="delete-all">${ICONS.trash}<span>Delete for all</span></button>` : ""}
    `;
    document.body.appendChild(menu);
    const rect = event.currentTarget?.getBoundingClientRect?.() || { left: event.clientX || 30, top: event.clientY || 30 };
    menu.style.left = `${Math.min(rect.left + 12, window.innerWidth - 230)}px`;
    menu.style.top = `${Math.min(rect.top + 16, window.innerHeight - 210)}px`;
    menu.querySelector("[data-action='reply']")?.addEventListener("click", () => {
      this.replyDraft = message;
      this.renderDraftPreviews();
      closeFloatingMenus();
      this.mount.querySelector("[data-message-input]")?.focus();
    });
    menu.querySelector("[data-action='react']")?.addEventListener("click", () => {
      closeFloatingMenus();
      this.openReactionStrip(message, event.currentTarget || menu);
    });
    menu.querySelector("[data-action='delete-me']")?.addEventListener("click", () => {
      this.deleteMessageForMe(message);
      closeFloatingMenus();
    });
    menu.querySelector("[data-action='delete-all']")?.addEventListener("click", () => {
      this.deleteMessageForAll(message);
      closeFloatingMenus();
    });
    window.setTimeout(() => document.addEventListener("click", closeFloatingMenus, { once: true }), 20);
  }

  openReactionStrip(message, anchor) {
    closeFloatingMenus();
    const strip = document.createElement("div");
    strip.className = "adnn-reaction-strip";
    strip.innerHTML = REACTIONS.map((emoji) => `<button type="button" data-emoji="${escapeAttr(emoji)}">${emoji}</button>`).join("");
    document.body.appendChild(strip);
    const rect = anchor.getBoundingClientRect();
    strip.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
    strip.style.top = `${Math.max(12, rect.top - 54)}px`;
    strip.querySelectorAll("[data-emoji]").forEach((button) => {
      button.addEventListener("click", () => {
        this.toggleReaction(message, button.dataset.emoji);
        closeFloatingMenus();
      });
    });
    window.setTimeout(() => document.addEventListener("click", closeFloatingMenus, { once: true }), 20);
  }

  async toggleReaction(message, emoji) {
    if (!this.selectedChat) return;
    const key = `reactions.${activeUser.uid}`;
    const existing = message.reactions?.[activeUser.uid];
    await updateDoc(doc(db, "chats", this.selectedChat.id, "messages", message.id), {
      [key]: existing === emoji ? deleteField() : emoji
    }).catch((error) => alert(`Reaction failed: ${error.message || error}`));
  }

  async deleteMessageForMe(message) {
    await updateDoc(doc(db, "chats", this.selectedChat.id, "messages", message.id), {
      deletedFor: arrayUnion(activeUser.uid)
    }).catch((error) => alert(`Delete failed: ${error.message || error}`));
  }

  async deleteMessageForAll(message) {
    await updateDoc(doc(db, "chats", this.selectedChat.id, "messages", message.id), {
      deletedForAll: true,
      text: "",
      attachments: [],
      mediaUrl: "",
      mediaName: "",
      mediaType: "",
      deletedAt: serverTimestamp(),
      deletedBy: activeUser.uid
    }).catch((error) => alert(`Delete for all failed: ${error.message || error}`));
  }

  async startCall(kind) {
    if (!this.selectedChat) return;
    const receiverUid = this.getRemoteCallUid();
    if (!receiverUid) {
      alert("Calling is available only for one-to-one chats.");
      return;
    }
    await startCallSession({
      chat: this.selectedChat,
      receiverUid,
      kind,
      title: chatTitle(this.selectedChat)
    });
  }

  isNearBottom() {
    const scroller = this.mount.querySelector("[data-message-scroll]");
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160;
  }

  scrollMessages(force = false) {
    const scroller = this.mount.querySelector("[data-message-scroll]");
    if (scroller && force) scroller.scrollTop = scroller.scrollHeight;
  }
}

async function startPresence() {
  if (!activeUser) return;
  const write = async (state = "online") => {
    const payload = {
      uid: activeUser.uid,
      email: profileEmail(),
      displayName: profileName(),
      photoURL: profilePhoto(),
      state,
      online: state === "online",
      lastSeenMs: nowMs(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "presence", activeUser.uid), payload, { merge: true }).catch(() => {});
    if (activeIsAdmin) {
      await setDoc(doc(db, "presence", ADMIN_ALIAS_UID), {
        uid: ADMIN_ALIAS_UID,
        email: ADMIN_ALIAS_EMAIL,
        displayName: "AdnnStudio",
        state,
        online: state === "online",
        lastSeenMs: nowMs(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  };
  write("online");
  const heartbeat = window.setInterval(() => write("online"), PRESENCE_HEARTBEAT_MS);
  const offline = () => write("offline");
  window.addEventListener("pagehide", offline);
  window.addEventListener("beforeunload", offline);
  globalUnsubs.push(() => {
    window.clearInterval(heartbeat);
    window.removeEventListener("pagehide", offline);
    window.removeEventListener("beforeunload", offline);
  });
}

function watchIncomingCalls() {
  const inboxUid = ownCallUid();
  if (!inboxUid) return;
  const unsub = onSnapshot(doc(db, "callInbox", inboxUid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "ringing" || Number(data.expiresAtMs || 0) < nowMs()) return;
    showIncomingCall(data);
  });
  globalUnsubs.push(unsub);
}

async function startCallSession({ chat, receiverUid, kind, title }) {
  if (activeCall) return;
  try {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
    const callRef = doc(collection(db, "calls"));
    const callId = callRef.id;
    const pc = createPeer(callId, "caller");
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    const remoteStream = new MediaStream();
    pc.addEventListener("track", (event) => event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track)));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const payload = {
      callId,
      chatId: chat.id,
      kind,
      title,
      callerUid: ownCallUid(),
      callerRealUid: activeUser.uid,
      callerName: profileName(),
      receiverUid,
      participants: [ownCallUid(), receiverUid],
      status: "ringing",
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: serverTimestamp(),
      createdAtMs: nowMs(),
      expiresAtMs: nowMs() + CALL_EXPIRES_MS
    };
    await setDoc(callRef, payload);
    await setDoc(doc(db, "callInbox", receiverUid), payload);
    activeCall = { callId, callRef, pc, localStream, remoteStream, role: "caller", kind, title };
    renderCallOverlay("Calling...", title, kind, localStream, remoteStream);
    watchCallDoc(callRef, pc);
    watchRemoteCandidates(callId, "answerCandidates", pc);
  } catch (error) {
    alert(`Call failed: ${error.message || error}`);
  }
}

async function showIncomingCall(data) {
  if (activeCall || document.querySelector(`[data-incoming-call="${CSS.escape(data.callId)}"]`)) return;
  const node = document.createElement("div");
  node.className = "adnn-incoming-call";
  node.dataset.incomingCall = data.callId;
  node.innerHTML = `
    <div>
      <span class="adnn-call-pulse">${data.kind === "video" ? ICONS.video : ICONS.phone}</span>
      <strong>${escapeHtml(data.callerName || "AdnnStudio")}</strong>
      <p>Incoming ${escapeHtml(data.kind || "audio")} call</p>
    </div>
    <footer>
      <button type="button" data-reject-call>Decline</button>
      <button type="button" data-accept-call>Accept</button>
    </footer>
  `;
  document.body.appendChild(node);
  node.querySelector("[data-reject-call]")?.addEventListener("click", async () => {
    await rejectCall(data);
    node.remove();
  });
  node.querySelector("[data-accept-call]")?.addEventListener("click", async () => {
    node.remove();
    await acceptCall(data);
  });
}

async function acceptCall(data) {
  if (activeCall) return;
  try {
    const callRef = doc(db, "calls", data.callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return;
    const call = snap.data();
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.kind === "video" });
    const pc = createPeer(data.callId, "receiver");
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    const remoteStream = new MediaStream();
    pc.addEventListener("track", (event) => event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track)));
    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(callRef, {
      status: "accepted",
      answer: { type: answer.type, sdp: answer.sdp },
      acceptedAt: serverTimestamp()
    });
    await setDoc(doc(db, "callInbox", ownCallUid()), { ...call, status: "accepted" }, { merge: true });
    activeCall = { callId: data.callId, callRef, pc, localStream, remoteStream, role: "receiver", kind: call.kind, title: call.title };
    renderCallOverlay("Connected", call.title || "Call", call.kind, localStream, remoteStream);
    watchCallDoc(callRef, pc);
    watchRemoteCandidates(data.callId, "offerCandidates", pc);
  } catch (error) {
    alert(`Could not answer call: ${error.message || error}`);
  }
}

async function rejectCall(data) {
  await updateDoc(doc(db, "calls", data.callId), { status: "rejected", endedAt: serverTimestamp() }).catch(() => {});
  await deleteDoc(doc(db, "callInbox", ownCallUid())).catch(() => {});
}

function createPeer(callId, role) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
  });
  const candidateCollection = role === "caller" ? "offerCandidates" : "answerCandidates";
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      addDoc(collection(db, "calls", callId, candidateCollection), event.candidate.toJSON()).catch(() => {});
    }
  });
  return pc;
}

function watchCallDoc(callRef, pc) {
  const unsub = onSnapshot(callRef, async (snap) => {
    if (!snap.exists() || !activeCall) return;
    const data = snap.data();
    if (data.status === "accepted" && activeCall.role === "caller" && data.answer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
      updateCallStatus("Connected");
    }
    if (["ended", "rejected", "missed"].includes(data.status)) endCall(data.status, true);
  });
  globalUnsubs.push(unsub);
}

function watchRemoteCandidates(callId, collectionName, pc) {
  const unsub = onSnapshot(collection(db, "calls", callId, collectionName), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      }
    });
  });
  globalUnsubs.push(unsub);
}

function renderCallOverlay(status, title, kind, localStream, remoteStream) {
  document.querySelectorAll("[data-adnn-call-overlay]").forEach((node) => node.remove());
  const node = document.createElement("div");
  node.className = "adnn-call-overlay";
  node.dataset.adnnCallOverlay = "true";
  node.innerHTML = `
    <div class="adnn-call-card">
      <header>
        <div>
          <strong>${escapeHtml(title || "AdnnStudio call")}</strong>
          <span data-call-status>${escapeHtml(status)}</span>
        </div>
      </header>
      <div class="adnn-call-stage ${kind === "video" ? "has-video" : ""}">
        <video data-remote-video autoplay playsinline></video>
        <video data-local-video autoplay playsinline muted></video>
        <div class="adnn-audio-call-face"><span>${kind === "video" ? "Video" : "Audio"}</span></div>
      </div>
      <footer>
        <button type="button" data-toggle-mute aria-label="Mute">${ICONS.mic}</button>
        <button type="button" data-toggle-camera aria-label="Camera" ${kind === "video" ? "" : "hidden"}>${ICONS.video}</button>
        <button type="button" class="is-end" data-end-call aria-label="End call">${ICONS.phone}</button>
      </footer>
    </div>
  `;
  document.body.appendChild(node);
  const localVideo = node.querySelector("[data-local-video]");
  const remoteVideo = node.querySelector("[data-remote-video]");
  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
  node.querySelector("[data-toggle-mute]")?.addEventListener("click", (event) => {
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    event.currentTarget.classList.toggle("is-off", !track.enabled);
  });
  node.querySelector("[data-toggle-camera]")?.addEventListener("click", (event) => {
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    event.currentTarget.classList.toggle("is-off", !track.enabled);
    localVideo.classList.toggle("is-paused", !track.enabled);
  });
  node.querySelector("[data-end-call]")?.addEventListener("click", () => endCall("ended"));
}

function updateCallStatus(text) {
  const node = document.querySelector("[data-call-status]");
  if (node) node.textContent = text;
}

async function endCall(status = "ended", remote = false) {
  if (!activeCall) return;
  const call = activeCall;
  activeCall = null;
  call.localStream?.getTracks().forEach((track) => track.stop());
  call.remoteStream?.getTracks().forEach((track) => track.stop());
  call.pc?.close();
  document.querySelectorAll("[data-adnn-call-overlay]").forEach((node) => node.remove());
  if (!remote) {
    await updateDoc(call.callRef, { status, endedAt: serverTimestamp() }).catch(() => {});
    await deleteDoc(doc(db, "callInbox", ownCallUid())).catch(() => {});
  }
}

function normalizeChat(snap) {
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAtMs: Number(data.createdAtMs || data.createdAt?.toMillis?.() || 0),
    updatedAtMs: Number(data.updatedAtMs || data.updatedAt?.toMillis?.() || data.createdAtMs || data.createdAt?.toMillis?.() || 0)
  };
}

function normalizeMessage(snap) {
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAtMs: Number(data.createdAtMs || data.createdAt?.toMillis?.() || 0)
  };
}

function sortChats(a, b) {
  return Number(b.updatedAtMs || b.createdAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || 0);
}

function chatTitle(chat) {
  if (!chat) return "Chat";
  if (chat.type === "support") return activeIsAdmin ? (chat.clientName || chat.clientEmail || "Client support") : "AdnnStudio Support";
  return chat.title || chat.name || chat.clientName || chat.clientEmail || "AdnnStudio Chat";
}

function firstOtherUid(chat) {
  return (chat.participantUids || []).find((uid) => uid !== activeUser.uid && uid !== ownCallUid()) || "";
}

function legacyAttachment(message) {
  if (!message.mediaUrl) return [];
  return [{
    url: message.mediaUrl,
    name: message.mediaName || "Attachment",
    type: message.mediaType || "",
    kind: message.mediaType?.startsWith?.("image/") ? "image" : "file"
  }];
}

function attachmentMarkup(item) {
  const kind = item.kind || "";
  const type = item.type || "";
  if (kind === "voice") {
    return `<div class="adnn-voice-message"><audio controls src="${escapeAttr(item.url)}"></audio><span>${escapeHtml(formatDuration(item.duration || 0))}</span></div>`;
  }
  if (kind === "image" || type.startsWith("image/")) {
    return `<a class="adnn-media-image" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.name || "Image")}"></a>`;
  }
  if (kind === "video" || type.startsWith("video/")) {
    return `<video class="adnn-media-video" controls src="${escapeAttr(item.url)}"></video>`;
  }
  if (kind === "audio" || type.startsWith("audio/")) {
    return `<audio controls src="${escapeAttr(item.url)}"></audio>`;
  }
  return `<a class="adnn-file-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer"><span>${ICONS.attach}</span>${escapeHtml(item.name || "Download file")}</a>`;
}

function replyMarkup(reply) {
  return `
    <div class="adnn-quoted">
      <strong>${escapeHtml(reply.senderName || "Message")}</strong>
      <span>${escapeHtml(reply.text || "Attachment")}</span>
    </div>
  `;
}

function firstAttachmentName(message) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  return attachments[0]?.name || message.mediaName || "";
}

function reactionSummary(reactions) {
  if (!reactions || !Object.keys(reactions).length) return "";
  const counts = {};
  Object.values(reactions).forEach((emoji) => {
    if (!emoji) return;
    counts[emoji] = (counts[emoji] || 0) + 1;
  });
  const items = Object.entries(counts);
  if (!items.length) return "";
  return `<div class="adnn-reactions">${items.map(([emoji, count]) => `<span>${emoji}${count > 1 ? ` ${count}` : ""}</span>`).join("")}</div>`;
}

function presenceText(data) {
  if (!data) return "Offline";
  if (data.online || data.state === "online") return "Online";
  if (data.lastSeenMs) return `Last seen ${relativeTime(data.lastSeenMs)}`;
  return "Offline";
}

function emptyAccessMarkup(title, text) {
  return `<div class="adnn-chat-access"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

function emptyMiniMarkup(title, text) {
  return `<div class="adnn-chat-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function loadingMarkup(text) {
  return `<div class="adnn-chat-loading"><span></span>${escapeHtml(text)}</div>`;
}

function getInitials(text) {
  const parts = String(text || "A").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2);
  return (parts.map((part) => part[0]).join("") || "A").toUpperCase();
}

function formatTime(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

function dayLabel(ms) {
  if (!ms) return "Today";
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat([], { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function relativeTime(ms) {
  if (!ms) return "";
  const diff = Math.max(0, nowMs() - Number(ms));
  const minute = 60000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}hr ago`;
  if (diff < week) return `${Math.floor(diff / day)} day${Math.floor(diff / day) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diff / week)} week${Math.floor(diff / week) > 1 ? "s" : ""} ago`;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function autoGrow(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
}

function linkify(text) {
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function closeFloatingMenus() {
  document.querySelectorAll(".adnn-message-menu,.adnn-reaction-strip").forEach((node) => node.remove());
}

function bindLongPress(node, callback) {
  let timer = null;
  const clear = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
  };
  node.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    clear();
    timer = window.setTimeout(() => callback(event), 520);
  });
  node.addEventListener("pointerup", clear);
  node.addEventListener("pointerleave", clear);
  node.addEventListener("pointercancel", clear);
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    callback(event);
  });
}

function softPlayTone() {
  if (!messageTone) return;
  messageTone.currentTime = 0;
  messageTone.volume = 0.28;
  messageTone.play().catch(() => {});
}

function injectStyles() {
  if (document.getElementById("adnn-full-messenger-style")) return;
  const style = document.createElement("style");
  style.id = "adnn-full-messenger-style";
  style.textContent = `
    .adnn-chat-root, .adnn-chat-app { width:100%; min-height:clamp(620px,72vh,880px); --adnn-blue:#272dcf; --adnn-line:rgba(255,255,255,.12); --adnn-panel:rgba(14,14,18,.72); --adnn-panel-strong:rgba(18,18,22,.94); --adnn-text:#fff; --adnn-muted:rgba(255,255,255,.58); }
    .adnn-chat-root * { box-sizing:border-box; }
    .adnn-chat-layout { position:relative; width:min(1380px,100%); height:clamp(620px,72vh,860px); margin:0 auto; display:grid; grid-template-columns:minmax(280px,380px) minmax(0,1fr); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:28px; background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)); box-shadow:0 34px 100px rgba(0,0,0,.32); color:var(--adnn-text); }
    .adnn-thread-panel { min-width:0; display:grid; grid-template-rows:auto auto 1fr; border-right:1px solid var(--adnn-line); background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.025)); overflow:hidden; }
    .adnn-thread-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:24px 24px 14px; }
    .adnn-thread-head h2 { margin:4px 0 0; font-size:28px; font-weight:500; letter-spacing:0; }
    .adnn-mini-label { margin:0; font-size:10px; letter-spacing:.28em; text-transform:uppercase; color:#9b9cff; }
    .adnn-thread-actions { display:flex; gap:8px; }
    .adnn-icon-btn, .adnn-round-btn, .adnn-room-back { width:44px; height:44px; border:1px solid rgba(255,255,255,.1); border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.07); cursor:pointer; transition:transform .2s ease, background .2s ease, opacity .2s ease; text-decoration:none; flex:0 0 auto; }
    .adnn-icon-btn:hover, .adnn-round-btn:hover, .adnn-room-back:hover { transform:translateY(-1px); background:rgba(255,255,255,.13); }
    .adnn-icon-btn:disabled { opacity:.35; cursor:not-allowed; transform:none; }
    .adnn-icon-btn svg, .adnn-round-btn svg, .adnn-room-back svg, .adnn-message-tools svg, .adnn-read svg { width:20px; height:20px; }
    .adnn-thread-search { padding:0 24px 16px; }
    .adnn-thread-search input { width:100%; height:42px; border:1px solid rgba(255,255,255,.1); border-radius:999px; background:rgba(0,0,0,.25); color:#fff; outline:0; padding:0 16px; font:inherit; font-size:14px; }
    .adnn-thread-list { min-height:0; overflow:auto; padding:8px 14px 18px; scrollbar-width:thin; }
    .adnn-thread-row { width:100%; display:grid; grid-template-columns:52px minmax(0,1fr) auto; gap:12px; align-items:center; border:0; color:#fff; text-align:left; padding:12px; border-radius:18px; background:transparent; cursor:pointer; transition:background .2s ease, transform .2s ease; }
    .adnn-thread-row:hover, .adnn-thread-row.is-active { background:linear-gradient(135deg,rgba(39,45,207,.45),rgba(255,255,255,.06)); }
    .adnn-thread-row.is-active { box-shadow:inset 0 0 0 1px rgba(111,115,255,.28); }
    .adnn-avatar { width:52px; height:52px; border-radius:18px; display:grid; place-items:center; color:#fff; background:linear-gradient(145deg,#4d55ff,#161dc6); box-shadow:0 12px 26px rgba(39,45,207,.28); font-size:14px; letter-spacing:.05em; flex:0 0 auto; overflow:hidden; }
    .adnn-thread-copy { min-width:0; display:grid; gap:4px; }
    .adnn-thread-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:16px; }
    .adnn-thread-preview, .adnn-thread-time { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--adnn-muted); font-size:12px; }
    .adnn-room-shell { min-width:0; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr) auto; background:rgba(0,0,0,.56); overflow:hidden; position:relative; }
    .adnn-room-head { height:76px; min-height:76px; display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid var(--adnn-line); background:rgba(8,8,13,.9); backdrop-filter:blur(18px); z-index:4; }
    .adnn-room-back { display:none; }
    .adnn-room-title { min-width:0; flex:1; display:grid; gap:1px; }
    .adnn-room-title strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:18px; font-weight:500; }
    .adnn-room-title small { color:#38ff7a; font-size:12px; }
    .adnn-room-title em { min-height:14px; color:#9b9cff; font-style:normal; font-size:12px; }
    .adnn-room-tools { display:flex; gap:8px; }
    .adnn-message-scroll { min-height:0; overflow-y:auto; padding:22px 24px 18px; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth; scrollbar-width:thin; }
    .adnn-day-divider { align-self:center; padding:6px 12px; border-radius:999px; background:rgba(255,255,255,.08); color:var(--adnn-muted); font-size:11px; margin:8px 0; }
    .adnn-message { display:flex; width:100%; }
    .adnn-message.is-mine { justify-content:flex-end; }
    .adnn-message.is-theirs { justify-content:flex-start; }
    .adnn-bubble { position:relative; max-width:min(640px,74%); padding:12px 14px 8px; border-radius:20px; background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.08); color:#fff; box-shadow:0 18px 50px rgba(0,0,0,.2); }
    .adnn-message.is-mine .adnn-bubble { background:linear-gradient(145deg,#363dff,#181ebc); border-color:rgba(160,164,255,.24); border-bottom-right-radius:8px; }
    .adnn-message.is-theirs .adnn-bubble { border-bottom-left-radius:8px; }
    .adnn-bubble p { margin:4px 0 8px; line-height:1.45; white-space:pre-wrap; overflow-wrap:anywhere; }
    .adnn-bubble a { color:#c8cbff; }
    .adnn-sender { display:block; color:#aaaaff; font-size:12px; margin-bottom:4px; }
    .adnn-bubble footer { display:flex; align-items:center; justify-content:flex-end; gap:6px; color:rgba(255,255,255,.48); font-size:11px; min-height:16px; }
    .adnn-read { display:inline-grid; place-items:center; width:22px; height:14px; color:rgba(255,255,255,.48); }
    .adnn-read.is-read { color:#6fd7ff; }
    .adnn-message-tools { position:absolute; top:-14px; right:10px; display:flex; gap:4px; opacity:0; transform:translateY(4px); pointer-events:none; transition:.18s ease; }
    .adnn-message:hover .adnn-message-tools { opacity:1; transform:none; pointer-events:auto; }
    .adnn-message-tools button { width:28px; height:28px; border:1px solid rgba(255,255,255,.12); border-radius:50%; background:rgba(16,16,20,.9); color:#fff; display:grid; place-items:center; cursor:pointer; }
    .adnn-quoted { border-left:3px solid #787dff; background:rgba(255,255,255,.07); padding:8px 10px; border-radius:12px; margin-bottom:8px; display:grid; gap:2px; }
    .adnn-quoted strong { color:#c6c8ff; font-size:12px; }
    .adnn-quoted span { color:rgba(255,255,255,.64); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-reactions { position:absolute; right:12px; bottom:-17px; display:flex; gap:4px; padding:3px 6px; border-radius:999px; background:rgba(10,10,14,.94); border:1px solid rgba(255,255,255,.12); font-size:12px; }
    .adnn-deleted-text { color:rgba(255,255,255,.52); font-style:normal; }
    .adnn-media-image img, .adnn-media-video { display:block; width:min(380px,100%); max-height:360px; object-fit:cover; border-radius:16px; margin:6px 0 8px; border:1px solid rgba(255,255,255,.12); }
    .adnn-file-link { display:flex; align-items:center; gap:10px; color:#fff; text-decoration:none; padding:12px; border-radius:14px; background:rgba(255,255,255,.08); margin:6px 0 8px; }
    .adnn-file-link svg { width:20px; height:20px; }
    .adnn-voice-message { display:flex; align-items:center; gap:10px; min-width:min(330px,100%); margin:6px 0 8px; }
    .adnn-voice-message audio { width:260px; max-width:100%; }
    .adnn-composer-wrap { border-top:1px solid var(--adnn-line); background:rgba(7,7,11,.94); backdrop-filter:blur(18px); padding:10px 12px; z-index:5; }
    .adnn-composer { display:grid; grid-template-columns:48px minmax(0,1fr) 48px; gap:10px; align-items:end; }
    .adnn-composer textarea { min-width:0; width:100%; min-height:48px; max-height:130px; resize:none; border:1px solid rgba(255,255,255,.12); border-radius:24px; background:#000; color:#fff; padding:14px 18px; outline:0; font:inherit; line-height:1.35; overflow:auto; }
    .adnn-primary-action.is-send { background:linear-gradient(145deg,#4e55ff,#1b22cf); border-color:rgba(255,255,255,.18); }
    .adnn-upload-preview, .adnn-reply-preview, .adnn-voice-preview { margin:0 0 10px 58px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .adnn-draft-file { display:flex; align-items:center; gap:8px; max-width:270px; padding:7px; border-radius:14px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); }
    .adnn-draft-file img, .adnn-draft-file video { width:42px; height:42px; object-fit:cover; border-radius:10px; }
    .adnn-draft-file span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
    .adnn-draft-file button, .adnn-reply-preview button, .adnn-voice-preview button { width:28px; height:28px; border:0; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; display:grid; place-items:center; cursor:pointer; }
    .adnn-draft-file svg, .adnn-reply-preview svg, .adnn-voice-preview svg { width:16px; height:16px; }
    .adnn-reply-preview { justify-content:space-between; flex-wrap:nowrap; border-left:3px solid #777cff; padding:8px 10px; border-radius:14px; background:rgba(255,255,255,.08); }
    .adnn-reply-preview div { min-width:0; display:grid; gap:2px; }
    .adnn-reply-preview strong, .adnn-reply-preview span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .adnn-reply-preview strong { font-size:12px; color:#c6c8ff; }
    .adnn-reply-preview span { font-size:12px; color:rgba(255,255,255,.62); }
    .adnn-voice-preview audio { max-width:280px; }
    .adnn-recording-pill { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:999px; background:rgba(255,255,255,.08); }
    .adnn-recording-pill span { width:9px; height:9px; border-radius:50%; background:#ff3b30; box-shadow:0 0 0 0 rgba(255,59,48,.55); animation:adnnPulse 1s infinite; }
    .adnn-chat-empty, .adnn-chat-loading, .adnn-room-empty, .adnn-chat-access { min-height:180px; display:grid; place-items:center; text-align:center; gap:8px; color:var(--adnn-muted); padding:34px; }
    .adnn-chat-empty strong, .adnn-room-empty h3, .adnn-chat-access h3 { color:#fff; font-weight:500; margin:0; }
    .adnn-chat-empty span, .adnn-room-empty p, .adnn-chat-access p { margin:0; max-width:360px; }
    .adnn-empty-orb { width:70px; height:70px; display:grid; place-items:center; border-radius:22px; background:linear-gradient(145deg,#4d55ff,#151cc8); font-size:42px; font-weight:800; line-height:1; }
    .adnn-chat-loading span { width:24px; height:24px; border-radius:50%; border:2px solid rgba(255,255,255,.18); border-top-color:#fff; animation:adnnSpin .7s linear infinite; }
    .adnn-message-menu, .adnn-reaction-strip { position:fixed; z-index:2147483647; border:1px solid rgba(255,255,255,.14); background:rgba(18,18,23,.96); color:#fff; box-shadow:0 22px 70px rgba(0,0,0,.4); backdrop-filter:blur(18px); animation:adnnMenuIn .15s ease; }
    .adnn-message-menu { width:210px; border-radius:18px; padding:8px; display:grid; gap:4px; }
    .adnn-message-menu button { display:flex; align-items:center; gap:10px; border:0; border-radius:12px; padding:10px; color:#fff; background:transparent; cursor:pointer; text-align:left; }
    .adnn-message-menu button:hover { background:rgba(255,255,255,.08); }
    .adnn-message-menu svg { width:18px; height:18px; }
    .adnn-reaction-strip { display:flex; gap:4px; padding:8px; border-radius:999px; }
    .adnn-reaction-strip button { width:38px; height:38px; border:0; border-radius:50%; background:transparent; font-size:20px; cursor:pointer; transition:transform .15s ease, background .15s ease; }
    .adnn-reaction-strip button:hover { transform:translateY(-5px) scale(1.08); background:rgba(255,255,255,.09); }
    .adnn-incoming-call { position:fixed; right:22px; bottom:22px; z-index:2147483600; width:min(360px,calc(100vw - 28px)); padding:18px; border-radius:24px; background:rgba(17,17,22,.96); color:#fff; border:1px solid rgba(255,255,255,.14); box-shadow:0 25px 80px rgba(0,0,0,.45); backdrop-filter:blur(20px); display:grid; gap:14px; }
    .adnn-incoming-call > div { display:grid; grid-template-columns:50px 1fr; gap:12px; align-items:center; }
    .adnn-incoming-call p { grid-column:2; margin:-12px 0 0; color:var(--adnn-muted); }
    .adnn-incoming-call footer { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .adnn-incoming-call button { height:42px; border:0; border-radius:999px; color:#fff; background:rgba(255,255,255,.1); cursor:pointer; }
    .adnn-incoming-call button[data-accept-call] { background:#272dcf; }
    .adnn-call-pulse { width:50px; height:50px; border-radius:18px; display:grid; place-items:center; background:#272dcf; animation:adnnPulse 1.2s infinite; }
    .adnn-call-pulse svg { width:22px; height:22px; }
    .adnn-call-overlay { position:fixed; inset:0; z-index:2147483590; background:rgba(0,0,0,.62); display:grid; place-items:center; padding:18px; backdrop-filter:blur(18px); }
    .adnn-call-card { width:min(880px,100%); border-radius:30px; border:1px solid rgba(255,255,255,.14); background:rgba(12,12,17,.95); color:#fff; overflow:hidden; box-shadow:0 30px 110px rgba(0,0,0,.5); }
    .adnn-call-card header { padding:18px 20px; border-bottom:1px solid rgba(255,255,255,.1); display:flex; justify-content:space-between; }
    .adnn-call-card header div { display:grid; gap:4px; }
    .adnn-call-card header span { color:var(--adnn-muted); font-size:13px; }
    .adnn-call-stage { min-height:320px; display:grid; place-items:center; position:relative; background:#030305; }
    .adnn-call-stage video { max-width:100%; max-height:100%; background:#000; border-radius:18px; object-fit:cover; }
    .adnn-call-stage [data-remote-video] { width:100%; height:420px; }
    .adnn-call-stage [data-local-video] { position:absolute; right:18px; bottom:18px; width:180px; height:120px; border:1px solid rgba(255,255,255,.18); box-shadow:0 18px 60px rgba(0,0,0,.35); }
    .adnn-call-stage [data-local-video].is-paused { opacity:.08; background:#000; }
    .adnn-call-stage:not(.has-video) video { display:none; }
    .adnn-audio-call-face { display:grid; place-items:center; width:130px; height:130px; border-radius:42px; background:linear-gradient(145deg,#4d55ff,#151cc8); }
    .adnn-call-stage.has-video .adnn-audio-call-face { display:none; }
    .adnn-call-card footer { padding:16px; display:flex; justify-content:center; gap:12px; }
    .adnn-call-card footer button { width:54px; height:54px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(255,255,255,.11); cursor:pointer; }
    .adnn-call-card footer button svg { width:22px; height:22px; }
    .adnn-call-card footer button.is-off { background:rgba(255,255,255,.04); color:rgba(255,255,255,.45); }
    .adnn-call-card footer button.is-end { background:#ff3b30; transform:rotate(135deg); }
    @keyframes adnnSpin { to { transform:rotate(360deg); } }
    @keyframes adnnPulse { 0% { box-shadow:0 0 0 0 rgba(39,45,207,.45); } 100% { box-shadow:0 0 0 18px rgba(39,45,207,0); } }
    @keyframes adnnMenuIn { from { opacity:0; transform:translateY(6px) scale(.97); } to { opacity:1; transform:none; } }
    @media (max-width: 760px) {
      .adnn-chat-root, .adnn-chat-app { min-height:calc(100svh - 80px); }
      .adnn-chat-layout { height:calc(100svh - 96px); min-height:560px; grid-template-columns:1fr; border-radius:0; border-left:0; border-right:0; }
      .adnn-thread-panel { border-right:0; }
      .adnn-room-shell { display:none; }
      .adnn-chat-layout.is-room-open { position:fixed; inset:0; width:100vw; height:100svh; min-height:100svh; z-index:2147483200; border:0; border-radius:0; grid-template-columns:1fr; background:#050507; }
      .adnn-chat-layout.is-room-open .adnn-thread-panel { display:none; }
      .adnn-chat-layout.is-room-open .adnn-room-shell { display:grid; grid-template-rows:64px minmax(0,1fr) auto; height:100svh; min-height:0; }
      .adnn-chat-layout.is-room-open .adnn-room-head { position:sticky; top:0; height:64px; min-height:64px; padding:8px 10px; }
      .adnn-chat-layout.is-room-open .adnn-room-back { display:grid; width:42px; height:42px; }
      .adnn-room-tools { gap:6px; }
      .adnn-room-tools .adnn-icon-btn { width:40px; height:40px; }
      .adnn-room-title strong { font-size:15px; }
      .adnn-message-scroll { padding:14px 10px 12px; overscroll-behavior:contain; }
      .adnn-bubble { max-width:86%; border-radius:18px; }
      .adnn-composer-wrap { position:sticky; bottom:0; padding:8px 8px max(8px,env(safe-area-inset-bottom)); }
      .adnn-composer { grid-template-columns:42px minmax(0,1fr) 42px; gap:8px; }
      .adnn-composer textarea { min-height:44px; border-radius:22px; padding:12px 15px; font-size:16px; }
      .adnn-round-btn { width:42px; height:42px; }
      .adnn-upload-preview, .adnn-reply-preview, .adnn-voice-preview { margin-left:0; }
      .adnn-message-tools { opacity:1; transform:none; pointer-events:auto; }
      .adnn-call-overlay { padding:0; }
      .adnn-call-card { height:100svh; border-radius:0; display:grid; grid-template-rows:auto 1fr auto; }
      .adnn-call-stage { min-height:0; }
      .adnn-call-stage [data-remote-video] { height:100%; }
      .adnn-call-stage [data-local-video] { width:120px; height:86px; right:12px; bottom:12px; }
    }
  `;
  document.head.appendChild(style);
}

boot();
