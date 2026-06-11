import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, orderBy, limit, where, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global Ecosystem Constants
const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 5000;
const CALL_MESSAGE_LIMIT = 100;

// Configurations & State Matrix
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

let activeUser = null;
let currentProfileCache = null;
let activeChatId = "";
let currentChatType = ""; // 'support' or 'direct'
let activeChatUnsubscribe = null;
let activeMessagesUnsubscribe = null;
let adminChatsUnsubscribe = null;

// Audio context states
let chatNotificationAudio = null;
let activeCallState = null;
let activeMediaRecorder = null;
let voiceRecordTimer = null;
let voiceDurationCounter = 0;

// Premium Apple/Tahoe Icon System Assets
const IC_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const IC_VIDEO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><polyline points="23 10 19 12 23 14"/></svg>`;
const IC_VIDEO_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10l-2.66-2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const IC_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const IC_MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const IC_END = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`;
const IC_ATTACH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

// Initialize Application Scope Execution Loop
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
    
    // Auto-routing initialization based on structural location paths
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
  // Target containers inside user portals
  const userChatContainer = document.getElementById("directChatMount");
  const adminSupportContainer = document.getElementById("clientChatMount");

  // Hook operational layout interfaces directly inside "User Chats" navigation scope
  if (userChatContainer) {
    userChatContainer.innerHTML = buildMessengerMarkupFrame("direct");
    initializeMessengerControllers("direct");
    bindEcosystemStreams("direct");
  }

  // Hook operational layout interfaces directly inside "Admin Support" navigation scope
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

  // Establish Admin Master Snapshot Monitor Streams
  if (adminChatsUnsubscribe) adminChatsUnsubscribe();
  adminChatsUnsubscribe = onSnapshot(collection(db, "chats"), (snapshot) => {
    const chats = [];
    snapshot.forEach(docSnap => chats.push({ id: docSnap.id, ...docSnap.data() }));
    // Sort chronologically by update timestamp metadata markers
    chats.sort((a, b) => toUnixEpochMillis(b.updatedAt) - toUnixEpochMillis(a.updatedAt));
    renderAdminSidebarMatrix(chats);
  });

  // Bind dynamic searching logic directly across the console panel interface
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
      <div class="adnn-item-avatar-circle">${displayName.slice(0, 2).toUpperCase()}</div>
      <div class="adnn-item-metadata-block">
        <strong>${escapeHtmlString(displayName)}</strong>
        <p>${escapeHtmlString(subDisplay)}</p>
      </div>
      ${unreadCount > 0 ? `<span class="adnn-unread-badge-counter">${unreadCount}</span>` : ""}
    `;

    itemBtn.addEventListener("click", () => {
      activeChatId = chat.id;
      currentChatType = chat.type;
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
  
  // Clear administrative notification targets upon reading the stream thread collection docs
  updateDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }).catch(() => {});
  
  bindEcosystemStreams(chat.type);
}

/* ==========================================================================
   MARKUP COMPONENT & VIEWPORT DISPATCH FACTORIES
   ========================================================================== */

function buildMessengerMarkupFrame(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  return `
    <div class="adnn-whatsapp-messenger-frame" id="${prefix}RootFrame">
      <div class="adnn-messenger-header-action-bar">
        <div class="adnn-header-identity-block">
          <div class="adnn-header-avatar" id="${prefix}HeaderAvatar">--</div>
          <div class="adnn-header-title-details">
            <h4 id="${prefix}HeaderTitle">Connecting workspace...</h4>
            <small id="${prefix}HeaderStatus">Tracking offline status markers</small>
          </div>
        </div>
        <div class="adnn-header-communications-utilities">
          <button type="button" class="adnn-util-call-btn" id="${prefix}AudioCallTrigger" aria-label="Audio call">${IC_PHONE}</button>
          <button type="button" class="adnn-util-call-btn" id="${prefix}VideoCallTrigger" aria-label="Video call">${IC_VIDEO}</button>
        </div>
      </div>
      
      <div class="adnn-messenger-messages-viewport" id="${prefix}Viewport">
        <div class="adnn-chat-view-loader">Synchronizing message buffers...</div>
      </div>

      <div class="adnn-messenger-composer-area">
        <div class="adnn-composer-attachment-fullscreen-preview-panel" id="${prefix}UploadPreviewPanel" hidden>
          <button type="button" class="adnn-close-preview-panel-btn" id="${prefix}CancelUploadBtn">&times;</button>
          <div class="adnn-preview-render-mount" id="${prefix}PreviewMount"></div>
          <span class="adnn-preview-file-metadata-label" id="${prefix}PreviewMetadataLabel">File allocation descriptor</span>
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
          <label class="adnn-composer-utility-file-label" title="Attach assets">
            <input type="file" id="${prefix}FileInput" accept="image/*,.pdf,.doc,.docx,.zip" style="display:none;">
            ${IC_ATTACH}
          </label>
          
          <div class="adnn-composer-input-wrapper-container">
            <input type="text" autocomplete="off" maxlength="1800" id="${prefix}TextInput" placeholder="Type a message...">
            <div class="adnn-composer-typing-indicator-dot-matrix" id="${prefix}TypingIndicator" hidden>
              <span></span><span></span><span></span>
            </div>
          </div>

          <button type="button" class="adnn-composer-action-voice-btn" id="${prefix}VoiceActionBtn" title="Hold to record audio message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="adnn-icon-mic-svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </button>
          
          <button type="submit" class="adnn-composer-submit-message-btn" id="${prefix}SubmitBtn" title="Send text dispatch">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   LIVE REALTIME DATA STREAM ENGINE (INTERCONNECTION & SYNC PIPELINES)
   ========================================================================== */

function bindEcosystemStreams(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  
  if (!isAdminEmail(activeUser.email)) {
    if (type === "support") {
      activeChatId = `support_${activeUser.uid}`;
    } else {
      // In User Chats pane, wait for Admin paired connection initialization setup mapping paths
      if (activeChatUnsubscribe) activeChatUnsubscribe();
      activeChatUnsubscribe = onSnapshot(
        query(collection(db, "chats"), where("type", "==", "direct"), where("participantUids", "array-contains", activeUser.uid)),
        (snapshot) => {
          const validPairedChannels = [];
          snapshot.forEach(docSnap => validPairedChannels.push({ id: docSnap.id, ...docSnap.data() }));
          if (validPairedChannels.length > 0) {
            // Pick the chronologically top paired active pipeline session trace target entry
            activeChatId = validPairedChannels[0].id;
            establishActiveMessagePipelineListeners(activeChatId, prefix, type);
          } else {
            renderEmptyWorkspacePlaceholder(prefix, "Awaiting Connection", "Only administrative pairs can spin up a connection trace here. Contact admin support to provision a communication card.");
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

  // Track state targets across channel layout frameworks
  const headerTitle = document.getElementById(`${prefix}HeaderTitle`);
  const headerAvatar = document.getElementById(`${prefix}HeaderAvatar`);
  const headerStatus = document.getElementById(`${prefix}HeaderStatus`);

  onSnapshot(doc(db, "chats", chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    
    let resolvedTitle = data.title || "Workspace Thread";
    if (type === "support") {
      resolvedTitle = isAdminEmail(activeUser.email) ? `Client: ${data.clientName || data.clientEmail}` : "AdnnStudio Support Portal";
    } else {
      // Handle formatting names for direct peer mappings dynamically
      if (!isAdminEmail(activeUser.email)) {
        const names = data.participantNames || {};
        const otherUid = data.participantUids?.find(uid => uid !== activeUser.uid);
        if (otherUid && names[otherUid]) resolvedTitle = names[otherUid];
      }
    }

    if (headerTitle) headerTitle.textContent = resolvedTitle;
    if (headerAvatar) headerAvatar.textContent = resolvedTitle.slice(0, 2).toUpperCase();

    // Trigger explicit secondary check trace monitoring live connection statuses
    if (type === "support") {
      monitorTargetPresence(isAdminEmail(activeUser.email) ? data.clientUid : ADMIN_ALIAS_UID, headerStatus);
    } else {
      const otherUid = data.participantUids?.find(uid => uid !== activeUser.uid);
      monitorTargetPresence(otherUid, headerStatus);
    }
  });

  // Attach structural collection query pipelines listening for message arrivals
  const msgQuery = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(CALL_MESSAGE_LIMIT));
  
  if (activeMessagesUnsubscribe) activeMessagesUnsubscribe();
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
      return;
    }
    const data = snap.data();
    const isOnline = data.online === true && (Date.now() - toUnixEpochMillis(data.lastSeen)) < 75000;
    element.textContent = isOnline ? "online" : "offline";
    element.className = isOnline ? "adnn-status-online-highlight" : "";
  });
}

/* ==========================================================================
   MESSENGER INPUT CONTROLLERS & INTERACTION SYSTEM
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

  // Typing indicators logic metrics stream triggers
  textInput?.addEventListener("input", () => {
    if (!activeChatId) return;
    const isTyping = textInput.value.length > 0;
    setDoc(doc(db, "chats", activeChatId, "typing", activeUser.uid), {
      isTyping, userName: currentProfileCache?.name || "User", timestamp: Date.now()
    }, { merge: true });
  });

  // Track remote status variations to paint dynamic layout elements safely
  onSnapshot(collection(db, "chats", activeChatId || "null", "typing"), (snapshot) => {
    let remoteTypingDetected = false;
    snapshot.forEach(docSnap => {
      if (docSnap.id !== activeUser.uid) {
        const data = docSnap.data();
        if (data.isTyping && (Date.now() - data.timestamp) < 4000) remoteTypingDetected = true;
      }
    });
    const indicator = document.getElementById(`${prefix}TypingIndicator`);
    if (indicator) indicator.hidden = !remoteTypingDetected;
  });

  // Intercept standard attachment events inside the panel architecture
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
        : `<div class="adnn-generic-document-fallback-card"><i>&boxbox;</i><span>Asset Content Attached</span></div>`;
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

  // WhatsApp Voice Message Processing Framework Loop
  voiceActionBtn?.addEventListener("mousedown", startVoiceRecordingPipeline);
  voiceActionBtn?.addEventListener("mouseup", () => endVoiceRecordingPipeline(prefix));
  voiceActionBtn?.addEventListener("mouseleave", () => endVoiceRecordingPipeline(prefix, true)); // Cancel if dragged off
  
  // Mobile touch alignment equivalents mapping native interactions
  voiceActionBtn?.addEventListener("touchstart", (e) => { e.preventDefault(); startVoiceRecordingPipeline(); });
  voiceActionBtn?.addEventListener("touchend", (e) => { e.preventDefault(); endVoiceRecordingPipeline(prefix); });

  // Handle transaction dispatches globally
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const text = textInput.value.trim();
    if (!text && !currentAttachmentFile) return;

    textInput.value = "";
    const originalFile = currentAttachmentFile;
    currentAttachmentFile = null;
    const panel = document.getElementById(`${prefix}UploadPreviewPanel`);
    if (panel) panel.hidden = true;

    // Reset Quote context structures explicitly
    const quotedIdSnapshot = activeQuotedMessageId;
    activeQuotedMessageId = null;
    const quoteBar = document.getElementById(`${prefix}QuoteContextBar`);
    if (quoteBar) quoteBar.hidden = true;

    try {
      let mediaData = {};
      if (originalFile) {
        mediaData = await executeCloudMediaUpload(originalFile, activeChatId);
      }

      const msgPayload = {
        text,
        senderUid: activeUser.uid,
        senderName: currentProfileCache?.name || activeUser.email,
        createdAt: serverTimestamp(),
        readBy: [activeUser.uid],
        ...mediaData
      };

      if (quotedIdSnapshot) {
        msgPayload.replyToMessageId = quotedIdSnapshot;
      }

      await addDoc(collection(db, "chats", activeChatId, "messages"), msgPayload);
      
      // Paint transaction counters based on incoming data variations
      const chatUpdateMeta = {
        lastMessage: text || (originalFile ? "Premium Asset Attached" : "Voice Note"),
        lastSenderUid: activeUser.uid,
        updatedAt: serverTimestamp()
      };

      if (type === "support") {
        if (isAdminEmail(activeUser.email)) {
          chatUpdateMeta.unreadForClient = increment(1);
        } else {
          chatUpdateMeta.unreadForAdmin = increment(1);
        }
      } else {
        chatUpdateMeta.unreadForClient = increment(1);
        chatUpdateMeta.unreadForAdmin = increment(1);
      }

      await updateDoc(doc(db, "chats", activeChatId), chatUpdateMeta);
      
      // Stop local typing loops
      setDoc(doc(db, "chats", activeChatId, "typing", activeUser.uid), { isTyping: false }, { merge: true });

    } catch (err) {
      alert(`Message transmission interrupted: ${err.message}`);
    }
  });

  // Call Button Triggers Injection routing dynamically
  document.getElementById(`${prefix}AudioCallTrigger`)?.addEventListener("click", () => initiateEcosystemCall("audio", type));
  document.getElementById(`${prefix}VideoCallTrigger`)?.addEventListener("click", () => initiateEcosystemCall("video", type));

  // Expose global quote hook context mappings inside window closures safely
  window[`hookReplyContext_${prefix}`] = function(messageId, senderName, textSummary) {
    activeQuotedMessageId = messageId;
    const bar = document.getElementById(`${prefix}QuoteContextBar`);
    const senderEl = document.getElementById(`${prefix}QuoteSenderLabel`);
    const bodyEl = document.getElementById(`${prefix}QuoteBodyLabel`);
    
    if (bar && senderEl && bodyEl) {
      bar.hidden = false;
      senderEl.textContent = senderName;
      bodyEl.textContent = textSummary || "Media deliverable asset.";
    }
  };
}

/* ==========================================================================
   VIEWPORT RENDERING & COMPONENT BUILD HOOK FACTORIES
   ========================================================================== */

function renderEcosystemMessagesViewport(messages, prefix, chatId) {
  const viewport = document.getElementById(`${prefix}Viewport`);
  if (!viewport) return;
  viewport.innerHTML = "";

  if (messages.length === 0) {
    viewport.innerHTML = `<div class="adnn-chat-empty-slate">No messages recorded in this terminal thread block.</div>`;
    return;
  }

  messages.forEach(msg => {
    const isMine = msg.senderUid === activeUser.uid;
    const bubble = document.createElement("div");
    bubble.className = `adnn-whatsapp-message-bubble ${isMine ? "is-sender-bubble" : "is-receiver-bubble"}`;
    
    // Evaluate Quote mapping configurations explicitly
    let quoteMarkup = "";
    if (msg.replyToMessageId) {
      quoteMarkup = `<div class="adnn-bubble-quoted-context-wrapper">Awaiting parent context data...</div>`;
      resolveQuotedBubbleContextAsync(chatId, msg.replyToMessageId, bubble);
    }

    // Evaluate Media Attachment Elements layout parameters
    let mediaMarkup = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        mediaMarkup = `<img src="${msg.mediaUrl}" class="adnn-bubble-embedded-image" onclick="window.open('${msg.mediaUrl}','_blank')" />`;
      } else if (msg.mediaType?.startsWith("audio/")) {
        mediaMarkup = `
          <div class="adnn-bubble-audio-note-row">
            <audio src="${msg.mediaUrl}" controls class="adnn-bubble-native-audio-player"></audio>
          </div>
        `;
      } else {
        mediaMarkup = `<a href="${msg.mediaUrl}" target="_blank" rel="noopener" class="adnn-bubble-document-download-link">${IC_ATTACH} Open Deliverable Asset</a>`;
      }
    }

    // Render precise Read Receipts ticks indicators matrix parameters
    let receiptsTicks = "";
    if (isMine) {
      const readers = msg.readBy || [];
      const readDelivered = readers.length > 1; // Includes sender plus partner target document traces
      receiptsTicks = `<span class="adnn-receipt-tick-marks ${readDelivered ? "is-fully-read-blue" : ""}">&#10004;&#10004;</span>`;
    }

    // Setup Reaction Engine UI elements mapping collection hooks inside layouts
    const currentReactions = msg.reactions || {};
    let reactionsRowMarkup = "";
    if (Object.keys(currentReactions).length > 0) {
      reactionsRowMarkup = `<div class="adnn-bubble-active-reactions-badge-row">`;
      Object.entries(currentReactions).forEach(([uid, emote]) => {
        reactionsRowMarkup += `<span title="Reacted by user profile">${emote}</span>`;
      });
      reactionsRowMarkup += `</div>`;
    }

    bubble.innerHTML = `
      ${quoteMarkup}
      <div class="adnn-bubble-identity-header-row" ${isMine ? "hidden" : ""}>
        <strong>${escapeHtmlString(msg.senderName || "Studio Peer")}</strong>
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

    viewport.appendChild(bubble);
  });

  // Lock scroll metrics straight onto terminal bases instantly
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
          <p>${escapeHtmlString(data.text || "Media attachment asset.")}</p>
        `;
      }
    }
  } catch (err) {}
}

/* ==========================================================================
   WHATSAPP MEDIA PROCESSING ENGINE (VOICE & SYSTEM DISPATCHES)
   ========================================================================== */

async function startVoiceRecordingPipeline() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    activeMediaRecorder = new MediaRecorder(stream);
    let chunks = [];

    activeMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    activeMediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
      const convertedVoiceFile = new File([audioBlob], `voice_note_${Date.now()}.ogg`, { type: "audio/ogg" });
      
      // Stop all capturing audio hardware tracks safely
      stream.getTracks().forEach(track => track.stop());
      
      if (voiceDurationCounter > 1) { // Prevent blank clicks
        const cloudData = await executeCloudMediaUpload(convertedVoiceFile, activeChatId);
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
          senderUid: activeUser.uid,
          senderName: currentProfileCache?.name || activeUser.email,
          createdAt: serverTimestamp(),
          readBy: [activeUser.uid],
          ...cloudData
        });
      }
      voiceDurationCounter = 0;
    };

    activeMediaRecorder.start();
    voiceDurationCounter = 0;
    voiceRecordTimer = setInterval(() => { voiceDurationCounter++; }, 1000);

  } catch (err) {
    console.error("Voice structural access initialization denied: ", err);
  }
}

function endVoiceRecordingPipeline(prefix, cancelPlayback = false) {
  if (voiceRecordTimer) clearInterval(voiceRecordTimer);
  if (!activeMediaRecorder || activeMediaRecorder.state === "inactive") return;

  if (cancelPlayback) {
    voiceDurationCounter = 0; // Drop data collection array sets
  }
  activeMediaRecorder.stop();
}

async function executeCloudMediaUpload(file, chatId) {
  if (!storage) throw new Error("Cloud Storage system integration points unlinked.");
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
   TRANSACTION MODIFIERS (REACTIONS, REVENUE MARKS, DELETIONS)
   ========================================================================== */

async function triggerReactionPayloadDispatch(chatId, messageId, emote) {
  try {
    const targetRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(targetRef, {
      [`reactions.${activeUser.uid}`]: emote
    });
  } catch (err) {}
}

async function executeMessageDeletionDispatch(chatId, messageId) {
  if (!confirm("Delete this message for everyone?")) return;
  try {
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
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

  // Nullify channel navigation alert counters
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
   WEBRTC ARCHITECTURE CORE ENGINE (AUDIO & VIDEO PIPELINES)
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
    alert("Media routing layers unsupported across this browser engine context.");
    return;
  }

  const wantsVideo = kind === "video";
  try {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const callId = `call_${Date.now()}_${activeUser.uid.slice(0, 5)}`;
    
    // Evaluate operational targets
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

    // Provision local signaling state parameters globally
    activeCallState = {
      callId, role: "caller", kind, isPolitePeer: false, // Impolite peer drives renegotiation offer cycles
      localStream, remoteStream: new MediaStream(), peerConnection: null, receiverUid: receiverTargetId,
      chatId: activeChatId, label: destinationLabelName
    };

    renderActiveCallHardwareOverlayWindow();
    instantiateWebRTCPeerConnection(callId, wantsVideo);

    // Build operational WebRTC Offer descriptions
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
    alert(`Microphone/Camera permission models rejected: ${err.message}`);
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

  // Bind local tracking data directly into peer connection tracks pipeline channels
  activeCallState.localStream.getTracks().forEach(track => {
    pc.addTrack(track, activeCallState.localStream);
  });

  // Track operational connection state variations checking link viability status metrics
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

  // Build the live snapshot monitor layer mapping signal parameter paths directly
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

    // Sync remote muting transformations straight inside active viewport layers dynamically
    const remoteVideoPanel = document.getElementById("adnnRemoteVideoMount");
    if (remoteVideoPanel) {
      remoteVideoPanel.style.opacity = data.cameraOn === false ? "0" : "1";
    }
  });

  // Monitor incoming candidate elements from the remote peer signaling data maps
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
  // Prevent stacking identical element nodes on screen
  if (document.getElementById("adnnCallOverlayContainer")) return;

  const ringOverlay = document.createElement("div");
  ringOverlay.id = "adnnCallOverlayContainer";
  ringOverlay.className = "adnn-call-hardware-overlay-master-stage generic-flex-center";
  ringOverlay.innerHTML = `
    <div class="adnn-call-hardware-card-panel glass">
      <div class="adnn-call-card-avatar-row">${callData.callerName.slice(0, 2).toUpperCase()}</div>
      <h2>${escapeHtmlString(callData.callerName)}</h2>
      <p>Incoming Studio ${callData.kind.toUpperCase()} Call...</p>
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
      alert(`Could not patch connection to hardware parameters: ${err.message}`);
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
        <p id="adnnCallDurationTimer">Ringing structural nodes...</p>
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

  // Control modifiers adjustments actions hooks
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
  let timerCounterSeconds = 0;
  const timeLabel = document.getElementById("adnnCallDurationTimer");
  if (!timeLabel) return;

  setInterval(() => {
    timerCounterSeconds++;
    const min = String(Math.floor(timerCounterSeconds / 60)).padStart(2, "0");
    const sec = String(timerCounterSeconds % 60).padStart(2, "0");
    if (timeLabel) timeLabel.textContent = `${min}:${sec}`;
  }, 1000);
}

function terminateLiveHardwareCallSession(explicitlyTriggeredByLocalPeer = true) {
  if (!activeCallState) return;

  if (explicitlyTriggeredByLocalPeer) {
    updateDoc(doc(db, "calls", activeCallState.callId), { status: "ended" }).catch(() => {});
  }

  // Clear hardware streaming assets pointers paths from execution channels safely
  if (activeCallState.localStream) {
    activeCallState.localStream.getTracks().forEach(track => track.stop());
  }

  if (activeCallState.peerConnection) {
    activeCallState.peerConnection.close();
  }

  cleanupSignalingServerGarbage(activeCallState.callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
  
  const container = document.getElementById("adnnCallOverlayContainer");
  if (container) container.remove();

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
  // Check the design database maps dynamically path collection routes
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
   PORTAL EXTRA-PREMIUM GLOW INTERACTION BRAND STYLING LAYOUT RULES
   ========================================================================== */

function injectGlobalAppStyles() {
  if (document.getElementById("adnnMessengerStyleInjectionNode")) return;
  const stylesheet = document.createElement("style");
  stylesheet.id = "adnnMessengerStyleInjectionNode";
  stylesheet.textContent = `
    /* High-Grade Messenger Grid System Layout Overrides */
    .adnn-whatsapp-messenger-frame {
      display: grid;
      grid-template-rows: 64px 1fr auto;
      height: min(640px, calc(100svh - 240px));
      background: linear-gradient(145deg, rgba(20, 20, 25, 0.96), rgba(10, 10, 14, 0.98));
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
    }

    #clientChatMount.adnn-designer-chat-panel {
      display: block !important;
      height: auto !important;
      border: 0 !important;
      background: transparent !important;
    }

    /* System Layout Viewports for Administrative Grid Consoles */
    .adnn-admin-chat-layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      height: calc(100vh - 140px);
      min-height: 500px;
      border-radius: 24px;
      overflow: hidden;
    }

    .adnn-admin-chat-sidebar {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: grid;
      grid-template-rows: 60px 1fr;
      background: rgba(20, 20, 25, 0.3);
    }

    .adnn-sidebar-search-box {
      padding: 10px;
      display: flex;
      align-items: center;
    }

    .adnn-sidebar-search-box input {
      height: 38px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0 14px;
      color: #fff;
      font-size: 13px;
    }

    .adnn-admin-chat-list {
      overflow-y: auto;
      padding: 10px;
    }

    .adnn-admin-list-item-btn {
      width: 100%;
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      background: transparent;
      border: 0;
      border-radius: 14px;
      color: #fff;
      text-align: left;
      cursor: pointer;
      margin-bottom: 6px;
      transition: background 0.2s ease;
    }

    .adnn-admin-list-item-btn:hover, .adnn-admin-list-item-btn.is-active {
      background: rgba(39, 45, 207, 0.15);
    }

    .adnn-item-avatar-circle {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #272dcf;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 500;
    }

    .adnn-item-metadata-block strong { display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
    .adnn-item-metadata-block p { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .adnn-unread-badge-counter {
      background: #ff2602;
      color: #fff;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-family: monospace;
    }

    .adnn-admin-chat-workspace-room {
      background: rgba(0, 0, 0, 0.2);
      position: relative;
    }

    .adnn-admin-chat-workspace-room .adnn-whatsapp-messenger-frame {
      height: 100% !important;
      border-radius: 0;
      border: 0;
    }

    /* WhatsApp Viewport Design Language Architecture */
    .adnn-messenger-header-action-bar {
      height: 64px;
      background: rgba(25, 25, 30, 0.4);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
    }

    .adnn-header-identity-block { display: flex; align-items: center; gap: 12px; }
    .adnn-header-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #272dcf;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
    }

    .adnn-header-title-details h4 { margin: 0; font-size: 15px; font-weight: 500; color: #fff; }
    .adnn-header-title-details small { font-size: 11px; color: rgba(255, 255, 255, 0.4); }
    .adnn-status-online-highlight { color: #25d366 !important; font-weight: 500; }

    .adnn-header-communications-utilities { display: flex; align-items: center; gap: 10px; }
    .adnn-util-call-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      border: 0;
      color: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 0.2s;
    }

    .adnn-util-call-btn:hover { background: rgba(39, 45, 207, 0.3); color: #8d96ff; }
    .adnn-util-call-btn svg { width: 18px; height: 18px; }

    .adnn-messenger-messages-viewport {
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    /* Professional Message Bubble Architecture Mapping WhatsApp Shapes */
    .adnn-whatsapp-message-bubble {
      max-width: 75%;
      padding: 10px 14px;
      border-radius: 16px;
      position: relative;
      color: #fff;
      font-size: 14.5px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      animation: bubbleArrivalAnimation 0.25s cubic-bezier(0.1, 1, 0.1, 1) both;
    }

    @keyframes bubbleArrivalAnimation {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .is-sender-bubble {
      align-self: flex-end;
      background: linear-gradient(135deg, #272dcf, #1a1f94);
      border-bottom-right-radius: 2px;
    }

    .is-receiver-bubble {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.06);
      border-bottom-left-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .adnn-bubble-identity-header-row strong {
      font-size: 11px;
      color: #8d96ff;
      font-family: monospace;
      margin-bottom: 4px;
      display: block;
    }

    .adnn-bubble-text-content-paragraph { margin: 0; word-break: break-word; }

    .adnn-bubble-timestamp-metrics-footer-line {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 4px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      font-family: monospace;
    }

    .adnn-receipt-tick-marks { font-size: 11px; color: rgba(255, 255, 255, 0.3); }
    .is-fully-read-blue { color: #34b7f1 !important; }

    /* Native Media Integration Modules */
    .adnn-bubble-embedded-image {
      max-width: 100%;
      max-height: 280px;
      border-radius: 12px;
      object-fit: cover;
      margin-bottom: 4px;
      cursor: pointer;
    }

    .adnn-bubble-document-download-link {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #8d96ff;
      text-decoration: none;
      font-size: 13px;
      background: rgba(0, 0, 0, 0.2);
      padding: 8px 12px;
      border-radius: 10px;
    }

    .adnn-bubble-native-audio-player {
      height: 36px;
      max-width: 220px;
      margin-top: 4px;
    }

    /* Reactions System Engine Badge Row styling */
    .adnn-bubble-active-reactions-badge-row {
      position: absolute;
      bottom: -10px;
      right: 12px;
      background: #1c1c24;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1px 6px;
      border-radius: 10px;
      display: flex;
      gap: 2px;
      font-size: 11px;
      z-index: 2;
    }

    /* Context Controls Menus Panel on hover layers */
    .adnn-bubble-interactive-context-menu-utilities {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: #1c1c24;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 4px;
      display: none;
      gap: 4px;
      z-index: 10;
    }

    .is-sender-bubble .adnn-bubble-interactive-context-menu-utilities { left: -140px; }
    .is-receiver-bubble .adnn-bubble-interactive-context-menu-utilities { right: -140px; }
    .adnn-whatsapp-message-bubble:hover .adnn-bubble-interactive-context-menu-utilities { display: flex; }

    .adnn-bubble-interactive-context-menu-utilities button {
      background: transparent; border: 0; color: #fff; font-size: 11px; cursor: pointer; padding: 2px 4px;
    }
    .adnn-bubble-interactive-context-menu-utilities button:hover { color: #8d96ff; }
    .adnn-util-delete-action { color: #ff2602 !important; }

    /* Interactive Composer Core Framework Elements layout */
    .adnn-messenger-composer-area {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding: 12px 16px;
      background: rgba(15, 15, 20, 0.6);
      position: relative;
    }

    .adnn-messenger-interactive-form {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .adnn-composer-utility-file-label {
      color: rgba(255, 255, 255, 0.5); cursor: pointer; display: grid; place-items: center; transition: color 0.2s;
    }
    .adnn-composer-utility-file-label:hover { color: #fff; }
    .adnn-composer-utility-file-label svg { width: 22px; height: 22px; }

    .adnn-composer-input-wrapper-container {
      flex: 1; position: relative; display: flex; align-items: center;
    }

    .adnn-composer-input-wrapper-container input {
      height: 44px; border-radius: 22px; background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08); padding: 0 44px 0 16px;
      color: #fff; font-size: 14px; width: 100%;
    }

    /* Native Typing Indicators Inside Input bounds layout */
    .adnn-composer-typing-indicator-dot-matrix {
      position: absolute; right: 16px; display: flex; gap: 3px;
    }
    .adnn-composer-typing-indicator-dot-matrix span {
      width: 5px; height: 5px; background: #272dcf; border-radius: 50%;
      animation: typingIndicatorDotsAnimation 1.4s infinite both;
    }
    .adnn-composer-typing-indicator-dot-matrix span:nth-child(2) { animation-delay: 0.2s; }
    .adnn-composer-typing-indicator-dot-matrix span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingIndicatorDotsAnimation {
      0%, 100% { transform: scale(0.6); opacity: 0.4; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    .adnn-composer-action-voice-btn, .adnn-composer-submit-message-btn {
      width: 44px; height: 44px; border-radius: 50%; border: 0; display: grid;
      place-items: center; cursor: pointer; color: #fff; transition: background 0.2s;
    }

    .adnn-composer-action-voice-btn { background: rgba(255, 255, 255, 0.05); }
    .adnn-composer-action-voice-btn:hover { background: rgba(255, 38, 2, 0.15); color: #ff2602; }
    .adnn-composer-submit-message-btn { background: #272dcf; }
    .adnn-composer-submit-message-btn:hover { background: #3946ff; }
    .adnn-composer-submit-message-btn svg, .adnn-composer-action-voice-btn svg { width: 16px; height: 16px; }

    /* In-Chat Full-Screen Overlay Media Preview Panels styling elements map bounds */
    .adnn-composer-attachment-fullscreen-preview-panel {
      position: absolute; bottom: 100%; left: 0; right: 0; height: 260px;
      background: #0d0d12; border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 100; padding: 16px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
    }

    .adnn-close-preview-panel-btn, .adnn-close-quote-context-btn {
      position: absolute; top: 12px; right: 16px; background: transparent;
      border: 0; color: rgba(255, 255, 255, 0.5); font-size: 22px; cursor: pointer;
    }
    .adnn-close-preview-panel-btn:hover { color: #fff; }

    .adnn-preview-render-mount { max-width: 100%; max-height: 180px; overflow: hidden; border-radius: 10px; }
    .adnn-fullscreen-composer-image-render { max-width: 100%; max-height: 180px; object-fit: contain; }
    .adnn-preview-file-metadata-label { font-size: 12px; color: rgba(245, 245, 247, 0.6); font-family: monospace; }

    /* Quoted Message Link UI Rows Mappings specifications blocks */
    .adnn-composer-quoted-reply-context-bar {
      display: grid; grid-template-columns: 4px 1fr auto; gap: 10px;
      background: rgba(0, 0, 0, 0.3); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;
    }
    .adnn-quote-line-indicator { background: #272dcf; border-radius: 2px; }
    .adnn-quote-text-details-block strong { font-size: 12px; color: #8d96ff; display: block; }
    .adnn-quote-text-details-block p { margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.6); }

    .adnn-bubble-quoted-context-wrapper {
      background: rgba(0, 0, 0, 0.2); border-left: 3px solid #8d96ff;
      padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; font-size: 12px;
    }
    .adnn-bubble-quoted-context-wrapper strong { color: #8d96ff; display: block; margin-bottom: 2px; }
    .adnn-bubble-quoted-context-wrapper p { margin: 0; opacity: 0.8; }

    /* Universal Placeholder View Screens */
    .adnn-whatsapp-placeholder-screen {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.4);
    }
    .adnn-placeholder-branding-icon {
      width: 64px; height: 64px; border-radius: 20px; background: rgba(39, 45, 207, 0.1);
      color: #272dcf; font-size: 24px; font-weight: 500; display: grid; place-items: center;
      margin-bottom: 16px; border: 1px solid rgba(39, 45, 207, 0.2);
    }
    .adnn-whatsapp-placeholder-screen h3 { margin: 0 0 8px; color: #fff; font-weight: 400; font-size: 18px; }
    .adnn-whatsapp-placeholder-screen p { margin: 0; font-size: 13.5px; max-width: 320px; line-height: 1.6; }
    .adnn-chat-view-loader, .adnn-chat-empty-slate { margin: auto; font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; }

    /* ==========================================================================
       WEBRTC DRAG HARDWARE CALL ENGINE VIEW OVERLAYS
       ========================================================================== */
    .adnn-call-hardware-overlay-master-stage {
      position: fixed; inset: 0; background: rgba(5, 5, 8, 0.85);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 2147483640;
    }
    .generic-flex-center { display: flex; align-items: center; justify-content: center; }
    .adnn-call-hardware-card-panel {
      width: min(440px, calc(100vw - 32px)); background: #0f0f14;
      border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 32px;
      padding: 30px; text-align: center; color: #fff;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5), 0 0 50px rgba(39, 45, 207, 0.15);
    }
    .adnn-call-card-avatar-row {
      width: 72px; height: 72px; border-radius: 24px; background: #272dcf;
      margin: 0 auto 20px; display: grid; place-items: center; font-size: 24px; font-weight: 500;
    }
    .adnn-call-hardware-card-panel h2 { margin: 0 0 6px; font-size: 22px; font-weight: 500; }
    .adnn-call-hardware-card-panel p { margin: 0 0 30px; font-size: 13px; color: rgba(255,255,255,0.5); font-family: monospace; }
    .adnn-call-card-interactive-controls-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
    
    .adnn-call-btn-circle {
      width: 54px; height: 54px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, 0.08);
      color: #fff; display: grid; place-items: center; cursor: pointer; transition: background 0.2s, transform 0.2s;
    }
    .adnn-call-btn-circle:hover { transform: scale(1.06); }
    .adnn-call-btn-circle svg { width: 20px; height: 20px; }
    
    .is-accept-green-bg { background: #25d366 !important; }
    .is-decline-red-bg { background: #ff3b30 !important; }
    .is-muted-highlight { background: #ff2602 !important; color: #fff !important; }

    /* WebRTC Live Grid Mesh Streams Windows styling blocks elements mapping bounds */
    .is-active-call-pane { width: min(720px, calc(100vw - 24px)) !important; padding: 16px !important; }
    .adnn-webrtc-video-tiles-grid-mesh {
      width: 100%; aspect-ratio: 16/10; background: #000; border-radius: 20px;
      overflow: hidden; margin-bottom: 16px; position: relative;
    }
    .adnn-webrtc-stream-track-video-tile-node { width: 100%; height: 100%; object-fit: cover; background: #050507; }
    .is-local-mirror-track {
      position: absolute; bottom: 14px; right: 14px; width: 25%; aspect-ratio: 3/4;
      border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); transform: scaleX(-1); /* Correct perspective mirror lines */
    }
    .adnn-active-call-floating-identity-row { margin-bottom: 20px; text-align: left; padding: 0 4px; }
    .adnn-active-call-floating-identity-row h3 { margin: 0 0 4px; font-size: 17px; font-weight: 500; }
    .adnn-active-call-floating-identity-row p { margin: 0; font-size: 12px; }

    /* Mobile Adaptive Safe Boundaries Overrides tracking layout scaling behaviors */
    @media (max-width: 760px) {
      .adnn-whatsapp-messenger-frame {
        height: 100svh !important; width: 100vw !important; border-radius: 0; border: 0;
        position: fixed; inset: 0; z-index: 2147483600; background: #050507;
      }
      .adnn-admin-chat-layout { grid-template-columns: 1fr; height: 100svh; border-radius: 0; }
      body.adnn-admin-chat-open .adnn-admin-chat-sidebar { display: none; }
      .adnn-bubble-interactive-context-menu-utilities { top: auto; bottom: -32px; left: 0 !important; right: auto !important; }
      .adnn-whatsapp-message-bubble { max-width: 85%; }
    }
  `;
  document.head.appendChild(stylesheet);
}
