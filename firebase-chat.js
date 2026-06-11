import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, orderBy, limit, where, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 5000;
const CALL_MESSAGE_LIMIT = 100;

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

// Application States
let activeUser = null;
let currentProfileCache = null;
let activeChatId = "";
let currentChatType = ""; // 'support' or 'direct'
let activeChatUnsubscribe = null;
let activeMessagesUnsubscribe = null;
let adminChatsUnsubscribe = null;
let knownMessageIds = new Set();

let activeCallState = null;
let activeMediaRecorder = null;
let voiceRecordTimer = null;
let voiceDurationCounter = 0;
let recordedChunks = [];

// Icons System
const IC_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const IC_VIDEO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><polyline points="23 10 19 12 23 14"/></svg>`;
const IC_VIDEO_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10l-2.66-2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const IC_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const IC_MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const IC_END = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`;
const IC_ATTACH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
const IC_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

if (db && auth) {
  injectGlobalAppStyles();
  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    if (!user) {
      terminateAllSystemListeners();
      return;
    }
    currentProfileCache = await resolveUserProfile(user.uid, user.email);
    initializePresenceTracking(user);
    initializeIncomingCallDispatcher(user);
    
    if (location.pathname.includes("admin.html")) {
      setupAdminWorkspacePortal();
    } else {
      setupStandardUserPortal();
    }
  });
}

/* ==========================================================================
   PORTAL INTERFACE SETUP ENGINE
   ========================================================================== */

function setupStandardUserPortal() {
  const userChatContainer = document.getElementById("directChatMount");
  const adminSupportContainer = document.getElementById("clientChatMount");

  if (userChatContainer) {
    userChatContainer.innerHTML = buildMessengerMarkupFrame("direct");
    initializeMessengerControllers("direct");
    bindEcosystemStreams("direct");
  }

  if (adminSupportContainer) {
    adminSupportContainer.innerHTML = buildMessengerMarkupFrame("support");
    initializeMessengerControllers("support");
    bindEcosystemStreams("support");
  }
}

function setupAdminWorkspacePortal() {
  const adminPanelTarget = document.getElementById("chats_view");
  if (!adminPanelTarget) return;

  adminPanelTarget.innerHTML = `
    <div class="adnn-admin-chat-layout glass">
      <div class="adnn-admin-chat-sidebar">
        <div class="adnn-sidebar-search-box">
          <input type="text" id="adminSidebarSearch" placeholder="Search conversations...">
        </div>
        <div class="adnn-admin-chat-list" id="adminConversationList">
          <div class="adnn-chat-view-loader">Connecting live data feeds...</div>
        </div>
      </div>
      <div class="adnn-admin-chat-workspace-room" id="adminChatRoomTarget">
        <div class="adnn-whatsapp-placeholder-screen">
          <div class="adnn-placeholder-branding-icon">AD</div>
          <h3>AdnnStudio Communication Suite</h3>
          <p>Select an approved client conversation stream from the sidebar matrix to start messaging.</p>
        </div>
      </div>
    </div>
  `;

  if (adminChatsUnsubscribe) adminChatsUnsubscribe();
  adminChatsUnsubscribe = onSnapshot(collection(db, "chats"), (snapshot) => {
    const chats = [];
    snapshot.forEach(docSnap => chats.push({ id: docSnap.id, ...docSnap.data() }));
    chats.sort((a, b) => toUnixEpochMillis(b.updatedAt) - toUnixEpochMillis(a.updatedAt));
    renderAdminSidebarMatrix(chats);
  });

  document.getElementById("adminSidebarSearch")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".adnn-admin-list-item-btn").forEach(item => {
      const match = item.innerText.toLowerCase().includes(term);
      item.style.display = match ? "grid" : "none";
    });
  });
}

function renderAdminSidebarMatrix(chats) {
  const container = document.getElementById("adminConversationList");
  if (!container) return;
  container.innerHTML = "";

  if (chats.length === 0) {
    container.innerHTML = `<div class="adnn-chat-empty-slate">No workspace dispatches registered.</div>`;
    return;
  }

  chats.forEach(chat => {
    let displayName = chat.title || "Support Thread";
    let subDisplay = chat.lastMessage || "Click to open workspace channel.";
    
    if (chat.type === "support") {
      displayName = `[Support] ${chat.clientName || chat.clientEmail}`;
    }

    const unreadCount = Number(chat.unreadForAdmin || 0);
    const itemBtn = document.createElement("button");
    itemBtn.type = "button";
    itemBtn.className = `adnn-admin-list-item-btn ${chat.id === activeChatId ? "is-active" : ""}`;
    itemBtn.innerHTML = `
      <div class="adnn-item-avatar-circle">${displayName.replace("[Support] ", "").slice(0, 2).toUpperCase()}</div>
      <div class="adnn-item-metadata-block">
        <strong>${escapeHtmlString(displayName)}</strong>
        <p>${escapeHtmlString(subDisplay)}</p>
      </div>
      ${unreadCount > 0 ? `<span class="adnn-unread-badge-counter">${unreadCount}</span>` : ""}
    `;

    itemBtn.addEventListener("click", () => {
      activeChatId = chat.id;
      currentChatType = chat.type;
      document.body.classList.add("adnn-admin-chat-open");
      document.querySelectorAll(".adnn-admin-list-item-btn").forEach(b => b.classList.remove("is-active"));
      itemBtn.classList.add("is-active");
      loadAdminSelectedConversationStream(chat);
    });

    container.appendChild(itemBtn);
  });
}

function loadAdminSelectedConversationStream(chat) {
  const targetRoom = document.getElementById("adminChatRoomTarget");
  if (!targetRoom) return;

  targetRoom.innerHTML = buildMessengerMarkupFrame(chat.type);
  initializeMessengerControllers(chat.type);
  updateDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }).catch(() => {});
  bindEcosystemStreams(chat.type);
}

/* ==========================================================================
   MARKUP COMPONENT FACTORIES
   ========================================================================== */

function buildMessengerMarkupFrame(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  return `
    <div class="adnn-whatsapp-messenger-frame" id="${prefix}RootFrame">
      <div class="adnn-messenger-header-action-bar">
        <div class="adnn-header-identity-block">
          <button type="button" class="adnn-messenger-mobile-back-btn" id="${prefix}MobileBackBtn">${IC_BACK}</button>
          <div class="adnn-header-avatar" id="${prefix}HeaderAvatar">--</div>
          <div class="adnn-header-title-details">
            <h4 id="${prefix}HeaderTitle">Connecting...</h4>
            <small id="${prefix}HeaderStatus">offline</small>
          </div>
        </div>
        <div class="adnn-header-communications-utilities">
          <button type="button" class="adnn-util-call-btn" id="${prefix}AudioCallTrigger">${IC_PHONE}</button>
          <button type="button" class="adnn-util-call-btn" id="${prefix}VideoCallTrigger">${IC_VIDEO}</button>
        </div>
      </div>
      
      <div class="adnn-messenger-messages-viewport" id="${prefix}Viewport">
        <div class="adnn-chat-view-loader">Synchronizing chat data...</div>
      </div>

      <div class="adnn-messenger-composer-area">
        <div class="adnn-composer-attachment-fullscreen-preview-panel" id="${prefix}UploadPreviewPanel" hidden>
          <button type="button" class="adnn-close-preview-panel-btn" id="${prefix}CancelUploadBtn">&times;</button>
          <div class="adnn-preview-render-mount" id="${prefix}PreviewMount"></div>
          <span class="adnn-preview-file-metadata-label" id="${prefix}PreviewMetadataLabel"></span>
        </div>

        <div class="adnn-composer-quoted-reply-context-bar" id="${prefix}QuoteContextBar" hidden>
          <div class="adnn-quote-line-indicator"></div>
          <div class="adnn-quote-text-details-block">
            <strong id="${prefix}QuoteSenderLabel">Sender</strong>
            <p id="${prefix}QuoteBodyLabel">Quoted context string</p>
          </div>
          <button type="button" class="adnn-close-quote-context-btn" id="${prefix}ClearQuoteBtn">&times;</button>
        </div>

        <form class="adnn-messenger-interactive-form" id="${prefix}Form">
          <label class="adnn-composer-utility-file-label" title="Attach Asset">
            <input type="file" id="${prefix}FileInput" accept="image/*,.pdf,.doc,.docx,.zip" style="display:none;">
            ${IC_ATTACH}
          </label>
          
          <div class="adnn-composer-input-wrapper-container">
            <input type="text" autocomplete="off" maxlength="1800" id="${prefix}TextInput" placeholder="Message">
            <div class="adnn-composer-typing-indicator-dot-matrix" id="${prefix}TypingIndicator" hidden>
              <span></span><span></span><span></span>
            </div>
          </div>

          <button type="button" class="adnn-composer-action-voice-btn" id="${prefix}VoiceActionBtn" title="Hold to record voice">
            ${IC_MIC}
          </button>
          
          <button type="submit" class="adnn-composer-submit-message-btn" id="${prefix}SubmitBtn" title="Send text">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   LIVE SNAPSHOT MONITOR STREAM MODULE
   ========================================================================== */

function bindEcosystemStreams(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  
  if (!isAdminEmail(activeUser.email)) {
    if (type === "support") {
      activeChatId = `support_${activeUser.uid}`;
    } else {
      if (activeChatUnsubscribe) activeChatUnsubscribe();
      activeChatUnsubscribe = onSnapshot(
        query(collection(db, "chats"), where("type", "==", "direct"), where("participantUids", "array-contains", activeUser.uid)),
        (snapshot) => {
          const pairedChannels = [];
          snapshot.forEach(docSnap => pairedChannels.push({ id: docSnap.id, ...docSnap.data() }));
          if (pairedChannels.length > 0) {
            activeChatId = pairedChannels[0].id;
            establishActiveMessagePipelineListeners(activeChatId, prefix, type);
          } else {
            renderEmptyWorkspacePlaceholder(prefix, "User Chats", "No communication channels have been opened for this profile yet. Only administrative dispatches can spin up connections.");
          }
        }
      );
      return;
    }
  }

  establishActiveMessagePipelineListeners(activeChatId, prefix, type);
}

function establishActiveMessagePipelineListeners(chatId, prefix, type) {
  if (!chatId) return;

  const headerTitle = document.getElementById(`${prefix}HeaderTitle`);
  const headerAvatar = document.getElementById(`${prefix}HeaderAvatar`);
  const headerStatus = document.getElementById(`${prefix}HeaderStatus`);
  const backBtn = document.getElementById(`${prefix}MobileBackBtn`);

  backBtn?.addEventListener("click", () => {
    document.body.classList.remove("adnn-direct-chat-open", "adnn-admin-chat-open");
  });

  onSnapshot(doc(db, "chats", chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    
    let resolvedTitle = data.title || "Workspace Group";
    if (type === "support") {
      resolvedTitle = isAdminEmail(activeUser.email) ? `Client: ${data.clientName || data.clientEmail}` : "AdnnStudio Admin Support";
    } else {
      if (!isAdminEmail(activeUser.email)) {
        const names = data.participantNames || {};
        const otherUid = data.participantUids?.find(uid => uid !== activeUser.uid);
        if (otherUid && names[otherUid]) resolvedTitle = names[otherUid];
      }
    }

    if (headerTitle) headerTitle.textContent = resolvedTitle;
    if (headerAvatar) headerAvatar.textContent = resolvedTitle.replace("Client: ", "").slice(0, 2).toUpperCase();

    if (type === "support") {
      monitorTargetPresence(isAdminEmail(activeUser.email) ? data.clientUid : ADMIN_ALIAS_UID, headerStatus);
    } else {
      const otherUid = data.participantUids?.find(uid => uid !== activeUser.uid);
      monitorTargetPresence(otherUid, headerStatus);
    }
  });

  const msgQuery = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(CALL_MESSAGE_LIMIT));
  
  if (activeMessagesUnsubscribe) activeMessagesUnsubscribe();
  knownMessageIds.clear();
  
  activeMessagesUnsubscribe = onSnapshot(msgQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach(docSnap => messages.push({ id: docSnap.id, ...docSnap.data() }));
    renderEcosystemMessagesViewport(messages, prefix, chatId);
    markMessagesAsReadEcosystem(chatId, type);
  });
}

function monitorTargetPresence(uid, element) {
  if (!uid || !element) return;
  onSnapshot(doc(db, "presence", uid), (snap) => {
    if (!snap.exists()) {
      element.textContent = "offline";
      element.classList.remove("adnn-status-online-highlight");
      return;
    }
    const data = snap.data();
    const isOnline = data.online === true && (Date.now() - toUnixEpochMillis(data.lastSeen)) < 75000;
    element.textContent = isOnline ? "online" : "offline";
    element.className = isOnline ? "adnn-status-online-highlight" : "";
  });
}

/* ==========================================================================
   INPUT CONTROLLERS & AUDIO RECORDER MATRIX
   ========================================================================== */

function initializeMessengerControllers(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  const form = document.getElementById(`${prefix}Form`);
  const textInput = document.getElementById(`${prefix}TextInput`);
  const fileInput = document.getElementById(`${prefix}FileInput`);
  const cancelUploadBtn = document.getElementById(`${prefix}CancelUploadBtn`);
  const voiceActionBtn = document.getElementById(`${prefix}VoiceActionBtn`);
  const clearQuoteBtn = document.getElementById(`${prefix}ClearQuoteBtn`);

  let currentAttachmentFile = null;
  let activeQuotedMessageId = null;

  textInput?.addEventListener("input", () => {
    if (!activeChatId) return;
    const isTyping = textInput.value.length > 0;
    setDoc(doc(db, "chats", activeChatId, "typing", activeUser.uid), {
      isTyping, timestamp: Date.now()
    }, { merge: true });
  });

  onSnapshot(collection(db, "chats", activeChatId || "null", "typing"), (snapshot) => {
    let remoteTyping = false;
    snapshot.forEach(docSnap => {
      if (docSnap.id !== activeUser.uid) {
        const data = docSnap.data();
        if (data.isTyping && (Date.now() - data.timestamp) < 4000) remoteTyping = true;
      }
    });
    const indicator = document.getElementById(`${prefix}TypingIndicator`);
    if (indicator) indicator.hidden = !remoteTyping;
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentAttachmentFile = file;
    
    const panel = document.getElementById(`${prefix}UploadPreviewPanel`);
    const mount = document.getElementById(`${prefix}PreviewMount`);
    const label = document.getElementById(`${prefix}PreviewMetadataLabel`);

    if (panel && mount && label) {
      panel.hidden = false;
      label.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      mount.innerHTML = file.type.startsWith("image/") 
        ? `<img src="${URL.createObjectURL(file)}" class="adnn-fullscreen-composer-image-render" />`
        : `<div class="adnn-generic-document-fallback-card"><span>File Document Attached</span></div>`;
    }
  });

  cancelUploadBtn?.addEventListener("click", () => {
    currentAttachmentFile = null;
    if (fileInput) fileInput.value = "";
    const panel = document.getElementById(`${prefix}UploadPreviewPanel`);
    if (panel) panel.hidden = true;
  });

  clearQuoteBtn?.addEventListener("click", () => {
    activeQuotedMessageId = null;
    const bar = document.getElementById(`${prefix}QuoteContextBar`);
    if (bar) bar.hidden = true;
  });

  // Safe Voice Recording Loop Hooks Integration points
  voiceActionBtn?.addEventListener("mousedown", startVoiceRecordingPipeline);
  voiceActionBtn?.addEventListener("mouseup", () => endVoiceRecordingPipeline(prefix));
  voiceActionBtn?.addEventListener("mouseleave", () => endVoiceRecordingPipeline(prefix, true));
  
  voiceActionBtn?.addEventListener("touchstart", (e) => { e.preventDefault(); startVoiceRecordingPipeline(); });
  voiceActionBtn?.addEventListener("touchend", (e) => { e.preventDefault(); endVoiceRecordingPipeline(prefix); });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const text = textInput.value.trim();
    if (!text && !currentAttachmentFile) return;

    textInput.value = "";
    const fileToUpload = currentAttachmentFile;
    currentAttachmentFile = null;
    
    const panel = document.getElementById(`${prefix}UploadPreviewPanel`);
    if (panel) panel.hidden = true;

    const quoteId = activeQuotedMessageId;
    activeQuotedMessageId = null;
    const quoteBar = document.getElementById(`${prefix}QuoteContextBar`);
    if (quoteBar) quoteBar.hidden = true;

    try {
      let mediaData = {};
      if (fileToUpload) {
        mediaData = await executeCloudMediaUpload(fileToUpload, activeChatId);
      }

      const msgPayload = {
        text,
        senderUid: activeUser.uid,
        senderName: currentProfileCache?.name || activeUser.email,
        createdAt: serverTimestamp(),
        readBy: [activeUser.uid],
        ...mediaData
      };

      if (quoteId) msgPayload.replyToMessageId = quoteId;

      await addDoc(collection(db, "chats", activeChatId, "messages"), msgPayload);
      
      const updateData = {
        lastMessage: text || (fileToUpload ? "Deliverable Asset Shared" : "Voice Note"),
        lastSenderUid: activeUser.uid,
        updatedAt: serverTimestamp()
      };

      if (type === "support") {
        updateData[isAdminEmail(activeUser.email) ? "unreadForClient" : "unreadForAdmin"] = increment(1);
      } else {
        updateData.unreadForClient = increment(1);
        updateData.unreadForAdmin = increment(1);
      }

      await updateDoc(doc(db, "chats", activeChatId), updateData);
      setDoc(doc(db, "chats", activeChatId, "typing", activeUser.uid), { isTyping: false }, { merge: true });

    } catch (err) {
      console.warn("Message stream error: ", err);
    }
  });

  document.getElementById(`${prefix}AudioCallTrigger`)?.addEventListener("click", () => initiateEcosystemCall("audio", type));
  document.getElementById(`${prefix}VideoCallTrigger`)?.addEventListener("click", () => initiateEcosystemCall("video", type));

  window[`hookReplyContext_${prefix}`] = function(messageId, senderName, textSummary) {
    activeQuotedMessageId = messageId;
    const bar = document.getElementById(`${prefix}QuoteContextBar`);
    const senderEl = document.getElementById(`${prefix}QuoteSenderLabel`);
    const bodyEl = document.getElementById(`${prefix}QuoteBodyLabel`);
    
    if (bar && senderEl && bodyEl) {
      bar.hidden = false;
      senderEl.textContent = senderName;
      bodyEl.textContent = textSummary || "Media asset document.";
    }
  };
}

/* ==========================================================================
   DOM INCREMENTAL RENDERER & INTERACTIVE VIEWPORTS
   ========================================================================== */

function renderEcosystemMessagesViewport(messages, prefix, chatId) {
  const viewport = document.getElementById(`${prefix}Viewport`);
  if (!viewport) return;

  if (messages.length === 0) {
    viewport.innerHTML = `<div class="adnn-chat-empty-slate">No messages registered yet.</div>`;
    return;
  }

  // Pure memory diff loop preventing flash and re-paint loops
  if (knownMessageIds.size === 0) {
    viewport.innerHTML = "";
  }

  messages.forEach(msg => {
    const isMine = msg.senderUid === activeUser.uid;
    let bubble = document.getElementById(`msg_${msg.id}`);
    
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.id = `msg_${msg.id}`;
      viewport.appendChild(bubble);
    }
    
    bubble.className = `adnn-whatsapp-message-bubble ${isMine ? "is-sender-bubble" : "is-receiver-bubble"}`;
    knownMessageIds.add(msg.id);

    let quoteMarkup = "";
    if (msg.replyToMessageId) {
      quoteMarkup = `<div class="adnn-bubble-quoted-context-wrapper"><strong>--</strong><p>...</p></div>`;
      resolveQuotedBubbleContextAsync(chatId, msg.replyToMessageId, bubble);
    }

    let mediaMarkup = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        mediaMarkup = `<img src="${msg.mediaUrl}" class="adnn-bubble-embedded-image" onclick="window.open('${msg.mediaUrl}','_blank')" />`;
      } else if (msg.mediaType?.startsWith("audio/")) {
        mediaMarkup = `<div class="adnn-bubble-audio-note-row"><audio src="${msg.mediaUrl}" controls class="adnn-bubble-native-audio-player"></audio></div>`;
      } else {
        mediaMarkup = `<a href="${msg.mediaUrl}" target="_blank" rel="noopener" class="adnn-bubble-document-download-link">${IC_ATTACH} ${escapeHtmlString(msg.mediaName || "Open File")}</a>`;
      }
    }

    let receiptsTicks = "";
    if (isMine) {
      const readers = msg.readBy || [];
      const isFullyRead = readers.length > 1;
      receiptsTicks = `<span class="adnn-receipt-tick-marks ${isFullyRead ? "is-fully-read-blue" : ""}">&#10004;&#10004;</span>`;
    }

    const currentReactions = msg.reactions || {};
    let reactionsRowMarkup = "";
    if (Object.keys(currentReactions).length > 0) {
      reactionsRowMarkup = `<div class="adnn-bubble-active-reactions-badge-row">`;
      Object.entries(currentReactions).forEach(([uid, emote]) => {
        reactionsRowMarkup += `<span>${emote}</span>`;
      });
      reactionsRowMarkup += `</div>`;
    }

    bubble.innerHTML = `
      ${quoteMarkup}
      <div class="adnn-bubble-identity-header-row" ${isMine ? "hidden" : ""}>
        <strong>${escapeHtmlString(msg.senderName || "User")}</strong>
      </div>
      ${mediaMarkup}
      ${msg.text ? `<p class="adnn-bubble-text-content-paragraph">${escapeHtmlString(msg.text)}</p>` : ""}
      <div class="adnn-bubble-timestamp-metrics-footer-line">
        <span>${formatUnixTimestampString(msg.createdAt)}</span>
        ${receiptsTicks}
      </div>
      ${reactionsRowMarkup}
      
      <div class="adnn-bubble-interactive-context-menu-utilities">
        <button type="button" onclick="window['hookReplyContext_${prefix}']('${msg.id}','${escapeHtmlString(msg.senderName)}','${escapeHtmlString(msg.text)}')">Reply</button>
        <button type="button" onclick="triggerReactionPayloadDispatch('${chatId}','${msg.id}','&#128077;')">&#128077;</button>
        <button type="button" onclick="triggerReactionPayloadDispatch('${chatId}','${msg.id}','&#10084;&#65039;')">&#10084;&#65039;</button>
        <button type="button" onclick="triggerReactionPayloadDispatch('${chatId}','${msg.id}','&#128514;')">&#128514;</button>
        ${isMine ? `<button type="button" class="adnn-util-delete-action" onclick="executeMessageDeletionDispatch('${chatId}','${msg.id}')">Delete</button>` : ""}
      </div>
    `;
  });

  viewport.scrollTop = viewport.scrollHeight;
}

async function resolveQuotedBubbleContextAsync(chatId, parentId, bubbleElement) {
  try {
    const parentDoc = await getDoc(doc(db, "chats", chatId, "messages", parentId));
    if (parentDoc.exists()) {
      const data = parentDoc.data();
      const quoteBlock = bubbleElement.querySelector(".adnn-bubble-quoted-context-wrapper");
      if (quoteBlock) {
        quoteBlock.innerHTML = `
          <strong>${escapeHtmlString(data.senderName)}</strong>
          <p>${escapeHtmlString(data.text || "Media file record.")}</p>
        `;
      }
    }
  } catch (err) {}
}

/* ==========================================================================
   WHATSAPP MEDIA PROCESSING ENGINE
   ========================================================================== */

async function startVoiceRecordingPipeline() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    activeMediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];

    activeMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    activeMediaRecorder.onstop = async () => {
      const audioBlob = new Blob(recordedChunks, { type: "audio/ogg; codecs=opus" });
      const voiceFile = new File([audioBlob], `voice_note_${Date.now()}.ogg`, { type: "audio/ogg" });
      stream.getTracks().forEach(track => track.stop());
      
      if (voiceDurationCounter > 0) {
        const cloudData = await executeCloudMediaUpload(voiceFile, activeChatId);
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
          senderUid: activeUser.uid,
          senderName: currentProfileCache?.name || activeUser.email,
          createdAt: serverTimestamp(),
          readBy: [activeUser.uid],
          ...cloudData
        });
      }
    };

    activeMediaRecorder.start();
    voiceDurationCounter = 0;
    voiceRecordTimer = setInterval(() => { voiceDurationCounter++; }, 1000);

  } catch (err) {
    console.warn("Hardware layer access denied: ", err);
  }
}

function endVoiceRecordingPipeline(prefix, cancel = false) {
  if (voiceRecordTimer) clearInterval(voiceRecordTimer);
  if (!activeMediaRecorder || activeMediaRecorder.state === "inactive") return;
  if (cancel) voiceDurationCounter = 0;
  activeMediaRecorder.stop();
}

async function executeCloudMediaUpload(file, chatId) {
  if (!storage) throw new Error("Cloud Storage pointers unlinked.");
  const cleanedName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  const path = `messenger-vault/${chatId}/${activeUser.uid}/${Date.now()}_${cleanedName}`;
  const targetRef = storageRef(storage, path);
  
  await uploadBytes(targetRef, file);
  const mediaUrl = await getDownloadURL(targetRef);

  return {
    mediaUrl,
    mediaName: file.name,
    mediaType: file.type || "application/octet-stream",
    mediaStoragePath: path
  };
}

/* ==========================================================================
   METRICS MODIFIERS DISPATCHES
   ========================================================================== */

async function triggerReactionPayloadDispatch(chatId, messageId, emote) {
  try {
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
      [`reactions.${activeUser.uid}`]: emote
    });
  } catch (err) {}
}

async function executeMessageDeletionDispatch(chatId, messageId) {
  if (!confirm("Delete this message for everyone?")) return;
  try {
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
    document.getElementById(`msg_${messageId}`)?.remove();
  } catch (err) {}
}

function markMessagesAsReadEcosystem(chatId, type) {
  if (!chatId) return;
  const colRef = collection(db, "chats", chatId, "messages");
  getDocs(colRef).then(snapshot => {
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const readers = data.readBy || [];
      if (!readers.includes(activeUser.uid)) {
        readers.push(activeUser.uid);
        updateDoc(docSnap.ref, { readBy: readers });
      }
    });
  });

  const trackingObj = {};
  if (type === "support") {
    trackingObj[isAdminEmail(activeUser.email) ? "unreadForAdmin" : "unreadForClient"] = 0;
  } else {
    trackingObj.unreadForAdmin = 0;
    trackingObj.unreadForClient = 0;
  }
  updateDoc(doc(db, "chats", chatId), trackingObj).catch(() => {});
}

/* ==========================================================================
   WEBRTC HARDWARE CONSTRAINTS ENGINE
   ========================================================================== */

function initializeIncomingCallDispatcher(user) {
  const targetInboxId = isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid;
  onSnapshot(doc(db, "callInbox", targetInboxId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const inbox = snapshot.data();
    if (inbox.status !== "ringing" || !inbox.callId) return;

    const callDoc = await getDoc(doc(db, "calls", inbox.callId));
    if (!callDoc.exists()) return;
    const callData = callDoc.data();

    if (Date.now() > Number(callData.expiresAtMs || 0) || callData.status !== "ringing") {
      cleanupSignalingServerGarbage(inbox.callId, targetInboxId);
      return;
    }

    if (callData.callerUid !== targetInboxId) {
      renderActiveIncomingCallOverlay(inbox.callId, callData);
    }
  });
}

async function initiateEcosystemCall(kind, chatType) {
  if (!navigator.mediaDevices || !RTCPeerConnection) {
    alert("WebRTC connections unsupported by browser client engine layer parameters.");
    return;
  }

  const wantsVideo = kind === "video";
  try {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const callId = `call_${Date.now()}_${activeUser.uid.slice(0, 5)}`;
    
    let receiverTargetId = ADMIN_ALIAS_UID;
    let destinationLabelName = "AdnnStudio Support Console";
    
    if (chatType === "direct") {
      const chatDoc = await getDoc(doc(db, "chats", activeChatId));
      const metaData = chatDoc.data();
      receiverTargetId = metaData.participantUids?.find(uid => uid !== activeUser.uid);
      destinationLabelName = metaData.participantNames?.[receiverTargetId] || "Ecosystem Peer";
    } else if (isAdminEmail(activeUser.email)) {
      const chatDoc = await getDoc(doc(db, "chats", activeChatId));
      receiverTargetId = chatDoc.data().clientUid;
      destinationLabelName = chatDoc.data().clientName || "Client Target";
    }

    activeCallState = {
      callId, role: "caller", kind, isPolitePeer: false,
      localStream, remoteStream: new MediaStream(), peerConnection: null, receiverUid: receiverTargetId,
      chatId: activeChatId, label: destinationLabelName
    };

    renderActiveCallHardwareOverlayWindow();
    instantiateWebRTCPeerConnection(callId, wantsVideo);

    const offer = await activeCallState.peerConnection.createOffer();
    await activeCallState.peerConnection.setLocalDescription(offer);

    const expiresAtMs = Date.now() + CALL_RING_TIMEOUT_MS;
    await setDoc(doc(db, "calls", callId), {
      id: callId, chatId: activeChatId, status: "ringing", kind, callerUid: activeUser.uid,
      callerName: currentProfileCache?.name || activeUser.email, receiverUid: receiverTargetId,
      offer: { type: offer.type, sdp: offer.sdp }, expiresAtMs, micMuted: false, cameraOn: wantsVideo
    });

    await setDoc(doc(db, "callInbox", receiverTargetId), { callId, status: "ringing" });

  } catch (err) {
    alert(`Hardware stream permissions rejected: ${err.message}`);
  }
}

function instantiateWebRTCPeerConnection(callId, wantsVideo) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  });

  activeCallState.peerConnection = pc;

  activeCallState.localStream.getTracks().forEach(track => {
    pc.addTrack(track, activeCallState.localStream);
  });

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const pathCollection = activeCallState.role === "caller" ? "offerCandidates" : "answerCandidates";
    addDoc(collection(db, "calls", callId, pathCollection), e.candidate.toJSON());
  };

  pc.ontrack = (e) => {
    if (e.streams && e.streams[0]) {
      e.streams[0].getTracks().forEach(track => {
        activeCallState.remoteStream.addTrack(track);
      });
    } else {
      activeCallState.remoteStream.addTrack(e.track);
    }
    const remoteVideoElement = document.getElementById("adnnRemoteVideoMount");
    if (remoteVideoElement) remoteVideoElement.srcObject = activeCallState.remoteStream;
  };

  onSnapshot(doc(db, "calls", callId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();

    if (data.status === "accepted" && pc.signalingState === "have-local-offer" && activeCallState.role === "caller") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      transitionOverlayToActiveConnectedState();
    }

    if (data.status === "ended") {
      terminateLiveHardwareCallSession(false);
    }

    const remoteVideoPanel = document.getElementById("adnnRemoteVideoMount");
    if (remoteVideoPanel) {
      remoteVideoPanel.style.opacity = data.cameraOn === false ? "0" : "1";
    }
  });

  const targetsCollection = activeCallState.role === "caller" ? "answerCandidates" : "offerCandidates";
  onSnapshot(collection(db, "calls", callId, targetsCollection), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      }
    });
  });
}

function renderActiveIncomingCallOverlay(callId, callData) {
  if (document.getElementById("adnnCallOverlayContainer")) return;

  const ringOverlay = document.createElement("div");
  ringOverlay.id = "adnnCallOverlayContainer";
  ringOverlay.className = "adnn-call-hardware-overlay-master-stage generic-flex-center";
  ringOverlay.innerHTML = `
    <div class="adnn-call-hardware-card-panel glass">
      <div class="adnn-call-card-avatar-row">${callData.callerName.slice(0, 2).toUpperCase()}</div>
      <h2>${escapeHtmlString(callData.callerName)}</h2>
      <p>Incoming ${callData.kind.toUpperCase()} Call...</p>
      <div class="adnn-call-card-interactive-controls-row">
        <button type="button" class="adnn-call-btn-circle is-accept-green-bg" id="adnnAcceptCallBtn">&#10004;</button>
        <button type="button" class="adnn-call-btn-circle is-decline-red-bg" id="adnnDeclineCallBtn">&times;</button>
      </div>
    </div>
  `;

  document.body.appendChild(ringOverlay);

  document.getElementById("adnnAcceptCallBtn")?.addEventListener("click", async () => {
    ringOverlay.remove();
    try {
      const wantsVideo = callData.kind === "video";
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });

      activeCallState = {
        callId, role: "receiver", kind: callData.kind, isPolitePeer: true,
        localStream, remoteStream: new MediaStream(), peerConnection: null,
        receiverUid: callData.callerUid, chatId: callData.chatId, label: callData.callerName
      };

      renderActiveCallHardwareOverlayWindow();
      instantiateWebRTCPeerConnection(callId, wantsVideo);

      await activeCallState.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await activeCallState.peerConnection.createAnswer();
      await activeCallState.peerConnection.setLocalDescription(answer);

      await updateDoc(doc(db, "calls", callId), {
        status: "accepted",
        answer: { type: answer.type, sdp: answer.sdp }
      });
      
      await updateDoc(doc(db, "callInbox", isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid), { status: "accepted" });
      transitionOverlayToActiveConnectedState();

    } catch (err) {
      executeCallRejectionCycle(callId, callData);
    }
  });

  document.getElementById("adnnDeclineCallBtn")?.addEventListener("click", () => {
    ringOverlay.remove();
    executeCallRejectionCycle(callId, callData);
  });
}

function executeCallRejectionCycle(callId, callData) {
  updateDoc(doc(db, "calls", callId), { status: "ended" }).catch(() => {});
  cleanupSignalingServerGarbage(callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
}

function renderActiveCallHardwareOverlayWindow() {
  if (document.getElementById("adnnCallOverlayContainer")) return;

  const callOverlay = document.createElement("div");
  callOverlay.id = "adnnCallOverlayContainer";
  callOverlay.className = "adnn-call-hardware-overlay-master-stage generic-flex-center";
  callOverlay.innerHTML = `
    <div class="adnn-call-hardware-card-panel is-active-call-pane glass">
      <div class="adnn-webrtc-video-tiles-grid-mesh">
        <video id="adnnRemoteVideoMount" autoplay playsinline class="adnn-webrtc-stream-track-video-tile-node is-remote-peer-track"></video>
        <video id="adnnLocalVideoMount" autoplay muted playsinline class="adnn-webrtc-stream-track-video-tile-node is-local-mirror-track"></video>
      </div>
      <div class="adnn-active-call-floating-identity-row">
        <h3>${escapeHtmlString(activeCallState.label)}</h3>
        <p id="adnnCallDurationTimer">Connecting...</p>
      </div>
      <div class="adnn-call-card-interactive-controls-row">
        <button type="button" class="adnn-call-btn-circle" id="adnnToggleMicHardwareBtn">${IC_MIC}</button>
        <button type="button" class="adnn-call-btn-circle" id="adnnToggleCameraHardwareBtn">${IC_VIDEO}</button>
        <button type="button" class="adnn-call-btn-circle is-decline-red-bg" id="adnnTerminateCallBtn">${IC_END}</button>
      </div>
    </div>
  `;

  document.body.appendChild(callOverlay);

  const localVideoElement = document.getElementById("adnnLocalVideoMount");
  if (localVideoElement) localVideoElement.srcObject = activeCallState.localStream;

  document.getElementById("adnnToggleMicHardwareBtn")?.addEventListener("click", (e) => {
    const audioTrack = activeCallState.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      e.currentTarget.innerHTML = audioTrack.enabled ? IC_MIC : IC_MIC_OFF;
      e.currentTarget.classList.toggle("is-muted-highlight", !audioTrack.enabled);
      updateDoc(doc(db, "calls", activeCallState.callId), { micMuted: !audioTrack.enabled });
    }
  });

  document.getElementById("adnnToggleCameraHardwareBtn")?.addEventListener("click", (e) => {
    const videoTrack = activeCallState.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      e.currentTarget.innerHTML = videoTrack.enabled ? IC_VIDEO : IC_VIDEO_OFF;
      e.currentTarget.classList.toggle("is-muted-highlight", !videoTrack.enabled);
      updateDoc(doc(db, "calls", activeCallState.callId), { cameraOn: videoTrack.enabled });
      localVideoElement.style.opacity = videoTrack.enabled ? "1" : "0";
    }
  });

  document.getElementById("adnnTerminateCallBtn")?.addEventListener("click", () => {
    terminateLiveHardwareCallSession(true);
  });
}

function transitionOverlayToActiveConnectedState() {
  let elapsed = 0;
  const label = document.getElementById("adnnCallDurationTimer");
  if (!label) return;

  setInterval(() => {
    elapsed++;
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    if (label) label.textContent = `${m}:${s}`;
  }, 1000);
}

function terminateLiveHardwareCallSession(explicitlyTriggeredByLocalPeer = true) {
  if (!activeCallState) return;
  if (explicitlyTriggeredByLocalPeer) {
    updateDoc(doc(db, "calls", activeCallState.callId), { status: "ended" }).catch(() => {});
  }
  if (activeCallState.localStream) {
    activeCallState.localStream.getTracks().forEach(track => track.stop());
  }
  if (activeCallState.peerConnection) {
    activeCallState.peerConnection.close();
  }
  cleanupSignalingServerGarbage(activeCallState.callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
  document.getElementById("adnnCallOverlayContainer")?.remove();
  activeCallState = null;
}

async function cleanupSignalingServerGarbage(callId, targetInboxId) {
  if (!callId) return;
  setTimeout(async () => {
    await deleteDoc(doc(db, "callInbox", targetInboxId)).catch(() => {});
    await deleteDoc(doc(db, "calls", callId)).catch(() => {});
  }, CALL_SIGNAL_CLEANUP_DELAY_MS);
}

/* ==========================================================================
   SUPPORT CORE DATA UTILITIES
   ========================================================================== */

function initializePresenceTracking(user) {
  const presenceRef = doc(db, "presence", isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid);
  const writeOnline = () => setDoc(presenceRef, { online: true, lastSeen: serverTimestamp() }, { merge: true });
  writeOnline();
  setInterval(writeOnline, 30000);
  window.addEventListener("beforeunload", () => setDoc(presenceRef, { online: false, lastSeen: serverTimestamp() }, { merge: true }));
}

function terminateAllSystemListeners() {
  if (activeChatUnsubscribe) activeChatUnsubscribe();
  if (activeMessagesUnsubscribe) activeMessagesUnsubscribe();
  if (adminChatsUnsubscribe) adminChatsUnsubscribe();
}

async function resolveUserProfile(uid, email) {
  const clientDoc = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (clientDoc?.exists()) return { uid, role: "client", ...clientDoc.data() };

  const designerDoc = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designerDoc?.exists()) return { uid, role: "designer", ...designerDoc.data() };

  return { uid, email, role: isAdminEmail(email) ? "admin" : "client", name: email.split("@")[0] };
}

function renderEmptyWorkspacePlaceholder(prefix, title, body) {
  const frame = document.getElementById(`${prefix}RootFrame`);
  if (frame) {
    frame.innerHTML = `
      <div class="adnn-whatsapp-placeholder-screen">
        <div class="adnn-placeholder-branding-icon">AD</div>
        <h3>${escapeHtmlString(title)}</h3>
        <p>${escapeHtmlString(body)}</p>
      </div>
    `;
  }
}

function toUnixEpochMillis(timestamp) {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  return new Date(timestamp).getTime();
}

function formatUnixTimestampString(timestamp) {
  if (!timestamp) return "Just now";
  const date = new Date(toUnixEpochMillis(timestamp));
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtmlString(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

/* ==========================================================================
   PORTAL INTERACTIVE LAYOUT OVERRIDES (WHATSAPP APP EMULATION)
   ========================================================================== */

function injectGlobalAppStyles() {
  if (document.getElementById("adnnMessengerStyleInjectionNode")) return;
  const stylesheet = document.createElement("style");
  stylesheet.id = "adnnMessengerStyleInjectionNode";
  stylesheet.textContent = `
    .adnn-whatsapp-messenger-frame {
      display: grid;
      grid-template-rows: 64px 1fr auto;
      height: 100%;
      min-height: 480px;
      background: #0b141a;
      border-radius: 0px;
      overflow: hidden;
      position: relative;
    }

    #clientChatMount.adnn-designer-chat-panel {
      display: block !important;
      height: min(650px, calc(100svh - 180px)) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 24px !important;
      overflow: hidden !important;
    }

    #directChatMount .adnn-whatsapp-messenger-frame {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      height: min(650px, calc(100svh - 180px));
    }

    .adnn-admin-chat-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      height: calc(100vh - 140px);
      min-height: 520px;
      border-radius: 24px;
      overflow: hidden;
    }

    .adnn-admin-chat-sidebar {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: grid;
      grid-template-rows: 64px 1fr;
      background: rgba(20, 20, 25, 0.4);
    }

    .adnn-sidebar-search-box { padding: 12px; display: flex; align-items: center; }
    .adnn-sidebar-search-box input {
      height: 40px; border-radius: 10px; background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08); padding: 0 14px; color: #fff; font-size: 14px;
    }

    .adnn-admin-chat-list { overflow-y: auto; padding: 6px; }
    .adnn-admin-list-item-btn {
      width: 100%; display: grid; grid-template-columns: 44px 1fr auto; gap: 12px;
      align-items: center; padding: 12px; background: transparent; border: 0;
      border-radius: 12px; color: #fff; text-align: left; cursor: pointer; margin-bottom: 4px;
    }
    .adnn-admin-list-item-btn:hover, .adnn-admin-list-item-btn.is-active { background: rgba(255, 255, 255, 0.05); }

    .adnn-item-avatar-circle {
      width: 42px; height: 42px; border-radius: 50%; background: #272dcf;
      display: grid; place-items: center; font-size: 14px; font-weight: 500;
    }
    .adnn-item-metadata-block strong { display: block; font-size: 14px; font-weight: 400; margin-bottom: 3px; }
    .adnn-item-metadata-block p { margin: 0; font-size: 12px; color: rgba(255,255,255,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .adnn-admin-chat-workspace-room { background: rgba(0, 0, 0, 0.2); position: relative; }
    .adnn-admin-chat-workspace-room .adnn-whatsapp-messenger-frame { height: 100% !important; border: 0; border-radius: 0; }

    .adnn-messenger-header-action-bar {
      height: 64px; background: #202c33; border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
    }
    .adnn-header-identity-block { display: flex; align-items: center; gap: 12px; }
    .adnn-messenger-mobile-back-btn {
      display: none; background: transparent; border: 0; color: #fff; cursor: pointer; padding: 4px;
    }
    .adnn-messenger-mobile-back-btn svg { width: 24px; height: 24px; }
    .adnn-header-avatar {
      width: 40px; height: 40px; border-radius: 50%; background: #272dcf;
      display: grid; place-items: center; font-size: 13px; font-weight: 500; color: #fff;
    }
    .adnn-header-title-details h4 { margin: 0; font-size: 15px; font-weight: 400; color: #fff; }
    .adnn-header-title-details small { font-size: 12px; color: rgba(255, 255, 255, 0.4); display: block; margin-top: 1px; }
    .adnn-status-online-highlight { color: #00a884 !important; }

    .adnn-header-communications-utilities { display: flex; align-items: center; gap: 8px; }
    .adnn-util-call-btn {
      width: 40px; height: 40px; border-radius: 50%; background: transparent;
      border: 0; color: #aebac1; display: grid; place-items: center; cursor: pointer;
    }
    .adnn-util-call-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .adnn-util-call-btn svg { width: 20px; height: 20px; }

    .adnn-messenger-messages-viewport {
      overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; background: #0b141a;
    }

    .adnn-whatsapp-message-bubble {
      max-width: 65%; padding: 8px 10px; border-radius: 8px; position: relative;
      color: #e9edef; font-size: 14.5px; line-height: 1.45; display: flex; flex-direction: column;
    }
    .is-sender-bubble { align-self: flex-end; background: #005c4b; }
    .is-receiver-bubble { align-self: flex-start; background: #202c33; }

    .adnn-bubble-identity-header-row strong { font-size: 12px; color: #5360ff; display: block; margin-bottom: 3px; }
    .adnn-bubble-text-content-paragraph { margin: 0; word-break: break-word; }
    .adnn-bubble-timestamp-metrics-footer-line {
      display: flex; align-items: center; justify-content: flex-end; gap: 4px;
      margin-top: 4px; font-size: 11px; color: rgba(255, 255, 255, 0.35); font-family: monospace;
    }
    .adnn-receipt-tick-marks { font-size: 12px; color: rgba(255, 255, 255, 0.3); }
    .is-fully-read-blue { color: #53bdeb !important; }

    .adnn-bubble-embedded-image { max-width: 100%; max-height: 250px; border-radius: 6px; object-fit: cover; margin-bottom: 2px; cursor: pointer; }
    .adnn-bubble-document-download-link { display: flex; align-items: center; gap: 8px; color: #53bdeb; text-decoration: none; font-size: 13.5px; background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px; }

    .adnn-bubble-active-reactions-badge-row {
      position: absolute; bottom: -8px; right: 10px; background: #202c33; border: 1px solid rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 10px; display: flex; gap: 1px; font-size: 11px; z-index: 2;
    }

    .adnn-bubble-interactive-context-menu-utilities {
      position: absolute; top: 50%; transform: translateY(-50%); background: #233138; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 2px; display: none; gap: 2px; z-index: 10;
    }
    .is-sender-bubble .adnn-bubble-interactive-context-menu-utilities { left: -145px; }
    .is-receiver-bubble .adnn-bubble-interactive-context-menu-utilities { right: -145px; }
    .adnn-whatsapp-message-bubble:hover .adnn-bubble-interactive-context-menu-utilities { display: flex; }
    .adnn-bubble-interactive-context-menu-utilities button { background: transparent; border: 0; color: #fff; font-size: 11px; cursor: pointer; padding: 2px 4px; }
    .adnn-util-delete-action { color: #ff3b30 !important; }

    .adnn-messenger-composer-area { border-top: 1px solid rgba(255,255,255,0.04); padding: 8px 12px; background: #202c33; position: relative; }
    .adnn-messenger-interactive-form { display: flex; align-items: center; gap: 10px; }

    .adnn-composer-utility-file-label { color: #8696a0; cursor: pointer; display: grid; place-items: center; }
    .adnn-composer-utility-file-label svg { width: 24px; height: 24px; }

    .adnn-composer-input-wrapper-container { flex: 1; position: relative; display: flex; align-items: center; }
    .adnn-composer-input-wrapper-container input {
      height: 42px; border-radius: 8px; background: #2a3942; border: 0; padding: 0 40px 0 14px; color: #fff; font-size: 15px; width: 100%; outline: none;
    }

    .adnn-composer-typing-indicator-dot-matrix { position: absolute; right: 14px; display: flex; gap: 2px; }
    .adnn-composer-typing-indicator-dot-matrix span { width: 4px; height: 4px; background: #00a884; border-radius: 50%; animation: typingDots 1.4s infinite both; }
    .adnn-composer-typing-indicator-dot-matrix span:nth-child(2) { animation-delay: 0.2s; }
    .adnn-composer-typing-indicator-dot-matrix span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingDots { 0%, 100% { transform: scale(0.6); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 1; } }

    .adnn-composer-action-voice-btn, .adnn-composer-submit-message-btn { width: 42px; height: 42px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; color: #fff; }
    .adnn-composer-action-voice-btn { background: transparent; color: #8696a0; }
    .adnn-composer-submit-message-btn { background: #00a884; }
    .adnn-composer-submit-message-btn svg { width: 16px; height: 16px; }

    .adnn-composer-attachment-fullscreen-preview-panel {
      position: absolute; bottom: 100%; left: 0; right: 0; height: 240px; background: #111b21; border-top: 1px solid rgba(255,255,255,0.08); z-index: 100; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    }
    .adnn-preview-render-mount { max-width: 100%; max-height: 160px; overflow: hidden; border-radius: 6px; }
    .adnn-fullscreen-composer-image-render { max-width: 100%; max-height: 160px; object-fit: contain; }
    .adnn-preview-file-metadata-label { font-size: 12px; color: #8696a0; font-family: monospace; }

    .adnn-composer-quoted-reply-context-bar { display: grid; grid-template-columns: 4px 1fr auto; gap: 10px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; }
    .adnn-quote-line-indicator { background: #00a884; border-radius: 2px; }
    .adnn-quote-text-details-block strong { font-size: 12px; color: #00a884; display: block; }
    .adnn-quote-text-details-block p { margin: 0; font-size: 11px; color: #8696a0; }
    .adnn-bubble-quoted-context-wrapper { background: rgba(0,0,0,0.15); border-left: 3px solid #00a884; padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
    .adnn-bubble-quoted-context-wrapper strong { color: #00a884; display: block; }
    .adnn-bubble-quoted-context-wrapper p { margin: 0; opacity: 0.75; }

    .adnn-whatsapp-placeholder-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 30px; color: #8696a0; }
    .adnn-placeholder-branding-icon { width: 60px; height: 60px; border-radius: 50%; background: rgba(0,168,132,0.1); color: #00a884; font-size: 22px; display: grid; place-items: center; margin-bottom: 12px; }
    .adnn-whatsapp-placeholder-screen h3 { margin: 0 0 6px; color: #fff; font-weight: 400; font-size: 18px; }
    .adnn-whatsapp-placeholder-screen p { margin: 0; font-size: 13px; max-width: 280px; line-height: 1.5; }
    .adnn-chat-view-loader, .adnn-chat-empty-slate { margin: auto; font-family: monospace; font-size: 12px; color: #8696a0; }

    /* ==========================================================================
       WEBRTC HARDWARE CONSTRAINTS MODULE STAGES
       ========================================================================== */
    .adnn-call-hardware-overlay-master-stage { position: fixed; inset: 0; background: #111b21; z-index: 2147483640; }
    .generic-flex-center { display: flex; align-items: center; justify-content: center; }
    .adnn-call-hardware-card-panel { width: min(450px, calc(100vw - 32px)); background: #222e35; border-radius: 16px; padding: 24px; text-align: center; color: #fff; }
    .adnn-call-card-avatar-row { width: 80px; height: 80px; border-radius: 50%; background: #272dcf; margin: 0 auto 16px; display: grid; place-items: center; font-size: 26px; }
    .adnn-call-hardware-card-panel h2 { margin: 0 0 4px; font-size: 20px; font-weight: 400; }
    .adnn-call-hardware-card-panel p { margin: 0 0 24px; font-size: 13px; color: #8696a0; }
    .adnn-call-card-interactive-controls-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
    .adnn-call-btn-circle { width: 50px; height: 50px; border-radius: 50%; border: 0; background: #3b4a54; color: #fff; display: grid; place-items: center; cursor: pointer; }
    .is-accept-green-bg { background: #1fa353 !important; }
    .is-decline-red-bg { background: #ea0038 !important; }
    .is-muted-highlight { background: #ea0038 !important; }

    .is-active-call-pane { width: min(750px, calc(100vw - 24px)) !important; padding: 12px !important; }
    .adnn-webrtc-video-tiles-grid-mesh { width: 100%; aspect-ratio: 16/10; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 12px; position: relative; }
    .adnn-webrtc-stream-track-video-tile-node { width: 100%; height: 100%; object-fit: cover; }
    .is-local-mirror-track { position: absolute; bottom: 12px; right: 12px; width: 22%; aspect-ratio: 3/4; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); transform: scaleX(-1); }
    .adnn-active-call-floating-identity-row { margin-bottom: 16px; text-align: left; }
    .adnn-active-call-floating-identity-row h3 { margin: 0; font-size: 16px; font-weight: 400; }
    .adnn-active-call-floating-identity-row p { margin: 0; font-size: 12px; color: #8696a0; }

    /* ==========================================================================
       MOBILE FIXES FOR BROKEN RENDER AND INLINE OVERLAYS
       ========================================================================== */
    @media (max-width: 760px) {
      .adnn-whatsapp-messenger-frame {
        position: fixed !important; inset: 0 !important; z-index: 2147483000 !important;
        height: 100svh !important; width: 100vw !important; border: 0 !important; border-radius: 0 !important;
      }
      
      /* Only render full-screen view if respective routing class maps onto body */
      body:not(.adnn-direct-chat-open):not(.adnn-admin-chat-open) .adnn-whatsapp-messenger-frame {
        display: none !important;
      }

      .adnn-admin-chat-layout { grid-template-columns: 1fr; height: calc(100svh - 65px); border-radius: 0; }
      body.adnn-admin-chat-open .adnn-admin-chat-sidebar { display: none; }
      body.adnn-admin-chat-open .adnn-admin-chat-workspace-room { display: block; }
      
      .adnn-header-title-details strong { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .adnn-messenger-mobile-back-btn { display: grid !important; place-items: center; }
      .adnn-bubble-interactive-context-menu-utilities { top: auto; bottom: -34px; left: 4px !important; right: auto !important; }
      .adnn-whatsapp-message-bubble { max-width: 85%; }
    }
  `;
  document.head.appendChild(stylesheet);
}
