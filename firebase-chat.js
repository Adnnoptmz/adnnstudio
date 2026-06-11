import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, orderBy, limit, where, onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global Hierarchy Constants
const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 4000;
const MSG_LIMIT = 100;

// Configurations Matrix
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

// Operational States
let activeUser = null;
let currentProfileCache = null;
let currentChatId = "";
let currentChatType = ""; // 'support' or 'direct'
let activeChatUnsub = null;
let activeMessagesUnsub = null;
let adminGlobalUnsub = null;

let chatSound = null;
let liveCallSession = null;
let micRecorderInstance = null;
let voiceDurationTimer = null;
let voiceElapsedSeconds = 0;

// Premium Apple-Tahoe Vector Icons
const SVG_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v0z"/></svg>`;
const SVG_VIDEO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><polyline points="23 10 19 12 23 14"/></svg>`;
const SVG_VIDEO_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10l-2.66-2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const SVG_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const SVG_MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const SVG_HANGUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`;
const SVG_CLIP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

// Initialize Execution Lifecycle
if (db && auth) {
  injectScopedSystemStyles();
  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    if (!user) {
      disconnectSystemListeners();
      return;
    }
    currentProfileCache = await extractProfileInformation(user.uid, user.email);
    syncPresenceNode(user);
    bindIncomingCallInterceptor(user);
    
    if (location.pathname.includes("admin.html")) {
      buildAdminChatInterface();
    } else {
      buildStandardClientInterface();
    }
  });
}

/* ==========================================================================
   PORTAL UI INTERFACE SETUP ENGINE
   ========================================================================== */

function buildStandardClientInterface() {
  const userChatMount = document.getElementById("directChatMount");
  const supportChatMount = document.getElementById("clientChatMount");

  if (userChatMount) {
    userChatMount.className = "adnn-wa-container";
    userChatMount.innerHTML = generateWorkspaceLayoutHTML("direct");
    attachComposerInputInteractions("direct");
    connectEcosystemLiveFeeds("direct");
  }

  if (supportChatMount) {
    supportChatMount.className = "adnn-wa-container";
    supportChatMount.innerHTML = generateWorkspaceLayoutHTML("support");
    attachComposerInputInteractions("support");
    connectEcosystemLiveFeeds("support");
  }
}

function buildAdminChatInterface() {
  const masterViewTarget = document.getElementById("chats_view");
  if (!masterViewTarget) return;

  masterViewTarget.className = "adnn-wa-container";
  masterViewTarget.innerHTML = `
    <div class="adnn-wa-admin-panel-frame">
      <div class="adnn-wa-admin-sidebar">
        <div class="adnn-wa-sidebar-search-container">
          <input type="text" id="waAdminSearch" placeholder="Search conversations...">
        </div>
        <div class="adnn-wa-sidebar-stream-list" id="waAdminStreamList">
          <div class="adnn-wa-loader">Connecting live communication streams...</div>
        </div>
      </div>
      <div class="adnn-wa-admin-chat-view-container" id="waAdminChatRoomTarget">
        <div class="adnn-wa-placeholder-screen">
          <div class="adnn-wa-branding-avatar">AD</div>
          <h3>Studio Communication Matrix</h3>
          <p>Select a verified operational user track from the sidebar directory to access secure messaging controls.</p>
        </div>
      </div>
    </div>
  `;

  if (adminGlobalUnsub) adminGlobalUnsub();
  adminGlobalUnsub = onSnapshot(collection(db, "chats"), (snapshot) => {
    const activeChannels = [];
    snapshot.forEach(docSnap => activeChannels.push({ id: docSnap.id, ...docSnap.data() }));
    activeChannels.sort((a, b) => getEpochTime(b.updatedAt) - getEpochTime(a.updatedAt));
    renderAdminSidebarDirectory(activeChannels);
  });

  document.getElementById("waAdminSearch")?.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".adnn-wa-sidebar-list-row-item").forEach(item => {
      const match = item.innerText.toLowerCase().includes(val);
      item.style.display = match ? "flex" : "none";
    });
  });
}

function renderAdminSidebarDirectory(channels) {
  const targetList = document.getElementById("waAdminStreamList");
  if (!targetList) return;
  targetList.innerHTML = "";

  if (channels.length === 0) {
    targetList.innerHTML = `<div class="adnn-wa-empty-state">No operational channels initialized.</div>`;
    return;
  }

  channels.forEach(channel => {
    let name = channel.title || "Private Dialogue";
    if (channel.type === "support") {
      name = `[Support] ${channel.clientName || channel.clientEmail}`;
    }

    const counter = Number(channel.unreadForAdmin || 0);
    const activeClass = channel.id === currentChatId ? "is-selected" : "";
    const summaryMsg = channel.lastMessage || "No messages recorded.";

    const row = document.createElement("div");
    row.className = `adnn-wa-sidebar-list-row-item ${activeClass}`;
    row.innerHTML = `
      <div class="adnn-wa-row-avatar-icon">${name.slice(0, 2).toUpperCase()}</div>
      <div class="adnn-wa-row-content-block">
        <div class="adnn-wa-row-top-line">
          <strong>${sanitizeString(name)}</strong>
        </div>
        <p>${sanitizeString(summaryMsg)}</p>
      </div>
      ${counter > 0 ? `<span class="adnn-wa-unread-badge">${counter}</span>` : ""}
    `;

    row.addEventListener("click", () => {
      currentChatId = channel.id;
      currentChatType = channel.type;
      document.querySelectorAll(".adnn-wa-sidebar-list-row-item").forEach(r => r.classList.remove("is-selected"));
      row.classList.add("is-selected");
      loadAdminSelectedThread(channel);
    });

    targetList.appendChild(row);
  });
}

function loadAdminSelectedThread(channel) {
  const targetRoom = document.getElementById("waAdminChatRoomTarget");
  if (!targetRoom) return;

  targetRoom.innerHTML = generateWorkspaceLayoutHTML(channel.type);
  attachComposerInputInteractions(channel.type);
  updateDoc(doc(db, "chats", channel.id), { unreadForAdmin: 0 }).catch(() => {});
  connectEcosystemLiveFeeds(channel.type);
}

/* ==========================================================================
   MARKUP COMPONENT & VIEWPORT GENERATOR FACTORIES
   ========================================================================== */

function generateWorkspaceLayoutHTML(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  return `
    <div class="adnn-wa-messenger-shell-frame" id="${prefix}CoreShell">
      <div class="adnn-wa-header-action-bar">
        <button type="button" class="adnn-wa-mobile-back-nav-btn" id="${prefix}MobileBackBtn">&#8592;</button>
        <div class="adnn-wa-header-profile-block">
          <div class="adnn-wa-header-avatar-node" id="${prefix}HeaderAvatar">--</div>
          <div class="adnn-wa-header-text-details">
            <h4 id="${prefix}HeaderTitle">Verifying connection...</h4>
            <small id="${prefix}HeaderPresence">Checking availability...</small>
          </div>
        </div>
        <div class="adnn-wa-header-hardware-utilities">
          <button type="button" class="adnn-wa-util-btn" id="${prefix}AudioCallBtn" aria-label="Audio call">${SVG_PHONE}</button>
          <button type="button" class="adnn-wa-util-btn" id="${prefix}VideoCallBtn" aria-label="Video call">${SVG_VIDEO}</button>
        </div>
      </div>

      <div class="adnn-wa-messages-viewport-scroller" id="${prefix}Viewport">
        <div class="adnn-wa-loader">Synchronizing message streams...</div>
      </div>

      <div class="adnn-wa-composer-area-container">
        <div class="adnn-wa-fullscreen-upload-preview-panel" id="${prefix}UploadPanel" hidden>
          <button type="button" class="adnn-wa-close-preview-btn" id="${prefix}CloseUploadPanelBtn">&times;</button>
          <div class="adnn-wa-preview-render-mount" id="${prefix}PreviewMount"></div>
          <span class="adnn-wa-preview-metadata-tag" id="${prefix}UploadMetadataTag">File description tag</span>
        </div>

        <div class="adnn-wa-quoted-reply-context-bar" id="${prefix}QuoteBar" hidden>
          <div class="adnn-wa-quote-vertical-bar"></div>
          <div class="adnn-wa-quote-details-block">
            <strong id="${prefix}QuoteUser">User</strong>
            <p id="${prefix}QuoteText">Quoted summary string...</p>
          </div>
          <button type="button" class="adnn-wa-clear-quote-btn" id="${prefix}ClearQuoteContextBtn">&times;</button>
        </div>

        <form class="adnn-wa-composer-form-interface" id="${prefix}Form">
          <label class="adnn-wa-file-attachment-trigger-label" title="Attach file assets">
            <input type="file" id="${prefix}FileInput" accept="image/*,.pdf,.doc,.docx,.zip" style="display:none;">
            ${SVG_CLIP}
          </label>
          
          <div class="adnn-wa-input-wrapper-node">
            <input type="text" autocomplete="off" maxlength="1800" id="${prefix}TextInput" placeholder="Type a message...">
            <div class="adnn-wa-typing-indicator-dot-matrix" id="${prefix}TypingNode" hidden>
              <span></span><span></span><span></span>
            </div>
          </div>

          <button type="button" class="adnn-wa-voice-record-action-btn" id="${prefix}VoiceBtn" title="Hold to record audio message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="adnn-wa-mic-icon-svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </button>
          
          <button type="submit" class="adnn-wa-submit-message-btn" id="${prefix}SendBtn" title="Send message">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   LIVE REALTIME DATA STREAM ENGINE (INTERCONNECTION & ROUTING PIPELINES)
   ========================================================================== */

function connectEcosystemLiveFeeds(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  
  if (!isAdminEmail(activeUser.email)) {
    if (type === "support") {
      currentChatId = `support_${activeUser.uid}`;
    } else {
      if (activeChatUnsub) activeChatUnsub();
      activeChatUnsub = onSnapshot(
        query(collection(db, "chats"), where("type", "==", "direct"), where("participantUids", "array-contains", activeUser.uid)),
        (snapshot) => {
          const verifiedPairedThreads = [];
          snapshot.forEach(docSnap => verifiedPairedThreads.push({ id: docSnap.id, ...docSnap.data() }));
          if (verifiedPairedThreads.length > 0) {
            currentChatId = verifiedPairedThreads[0].id;
            initializeMessagePipelineTrackingListeners(currentChatId, prefix, type);
          } else {
            renderEmptyLayoutFallback(prefix, "Awaiting Connection Card", "User-to-user messaging channels are restricted. Once the administrator creates a message connection card, your paired chat channel will unlock instantly.");
          }
        }
      );
      return;
    }
  }

  initializeMessagePipelineTrackingListeners(currentChatId, prefix, type);
}

function initializeMessagePipelineTrackingListeners(chatId, prefix, type) {
  if (!chatId) return;

  const titleNode = document.getElementById(`${prefix}HeaderTitle`);
  const avatarNode = document.getElementById(`${prefix}HeaderAvatar`);
  const statusNode = document.getElementById(`${prefix}HeaderPresence`);

  onSnapshot(doc(db, "chats", chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    
    let resolvedTitle = data.title || "Private Chat Thread";
    if (type === "support") {
      resolvedTitle = isAdminEmail(activeUser.email) ? `Client Thread: ${data.clientName || data.clientEmail}` : "AdnnStudio Master Support";
    } else {
      if (!isAdminEmail(activeUser.email)) {
        const structuralNamesMap = data.participantNames || {};
        const counterpeerUid = data.participantUids?.find(uid => uid !== activeUser.uid);
        if (counterpeerUid && structuralNamesMap[counterpeerUid]) resolvedTitle = structuralNamesMap[counterpeerUid];
      }
    }

    if (titleNode) titleNode.textContent = resolvedTitle;
    if (avatarNode) avatarNode.textContent = resolvedTitle.slice(0, 2).toUpperCase();

    if (type === "support") {
      bindPresenceNodeRealtimeMonitor(isAdminEmail(activeUser.email) ? data.clientUid : ADMIN_ALIAS_UID, statusNode);
    } else {
      const counterpeerUid = data.participantUids?.find(uid => uid !== activeUser.uid);
      bindPresenceNodeRealtimeMonitor(counterpeerUid, statusNode);
    }
  });

  const messagesQueryCollectionRef = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(MSG_LIMIT));
  
  if (activeMessagesUnsub) activeMessagesUnsub();
  activeMessagesUnsub = onSnapshot(messagesQueryCollectionRef, (snapshot) => {
    const historicalPayload = [];
    snapshot.forEach(docSnap => historicalPayload.push({ id: docSnap.id, ...docSnap.data() }));
    renderConversationalMessageBubbles(historicalPayload, prefix, chatId);
    executeReadReceiptsMarkingLoop(chatId, type);
  });
}

function bindPresenceNodeRealtimeMonitor(uid, targetDOMElement) {
  if (!uid || !targetDOMElement) return;
  onSnapshot(doc(db, "presence", uid), (snapshot) => {
    if (!snapshot.exists()) {
      targetDOMElement.textContent = "offline";
      targetDOMElement.className = "is-offline-text";
      return;
    }
    const data = snapshot.data();
    const liveOnline = data.online === true && (Date.now() - getEpochTime(data.lastSeen)) < 75000;
    targetDOMElement.textContent = liveOnline ? "online" : "offline";
    targetDOMElement.className = liveOnline ? "is-online-active-green" : "is-offline-text";
  });
}

/* ==========================================================================
   COMPOSER INPUT CONTROLLERS & INTERACTION SYSTEM
   ========================================================================== */

function attachComposerInputInteractions(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  const targetForm = document.getElementById(`${prefix}Form`);
  const textInputNode = document.getElementById(`${prefix}TextInput`);
  const fileInputNode = document.getElementById(`${prefix}FileInput`);
  const closeUploadBtn = document.getElementById(`${prefix}CloseUploadPanelBtn`);
  const voiceRecordBtn = document.getElementById(`${prefix}VoiceBtn`);
  const clearQuoteBtn = document.getElementById(`${prefix}ClearQuoteContextBtn`);
  const mobileBackNavBtn = document.getElementById(`${prefix}MobileBackBtn`);

  let stagedFileAttachment = null;
  let stagedQuotedParentId = null;

  mobileBackNavBtn?.addEventListener("click", () => {
    document.body.classList.remove("adnn-wa-mobile-view-active");
    const adminWorkspaceLayout = document.querySelector(".adnn-wa-admin-panel-frame");
    if (adminWorkspaceLayout) adminWorkspaceLayout.classList.remove("adnn-wa-mobile-room-open");
  });

  textInputNode?.addEventListener("input", () => {
    if (!currentChatId) return;
    const typingState = textInputNode.value.length > 0;
    setDoc(doc(db, "chats", currentChatId, "typing", activeUser.uid), {
      isTyping: typingState, name: currentProfileCache?.name || "User", timestamp: Date.now()
    }, { merge: true });
  });

  onSnapshot(collection(db, "chats", currentChatId || "null", "typing"), (snapshot) => {
    let remotePeerIsActiveTyping = false;
    snapshot.forEach(docSnap => {
      if (docSnap.id !== activeUser.uid) {
        const data = docSnap.data();
        if (data.isTyping === true && (Date.now() - data.timestamp) < 4000) remotePeerIsActiveTyping = true;
      }
    });
    const typingNode = document.getElementById(`${prefix}TypingNode`);
    if (typingNode) typingNode.hidden = !remotePeerIsActiveTyping;
  });

  fileInputNode?.addEventListener("change", (event) => {
    const targetFile = event.target.files[0];
    if (!targetFile) return;
    stagedFileAttachment = targetFile;

    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    const previewMountNode = document.getElementById(`${prefix}PreviewMount`);
    const metadataTagNode = document.getElementById(`${prefix}UploadMetadataTag`);

    if (panelNode && previewMountNode && metadataTagNode) {
      panelNode.hidden = false;
      metadataTagNode.textContent = `${targetFile.name} (${(targetFile.size / (1024 * 1024)).toFixed(2)} MB)`;
      previewMountNode.innerHTML = targetFile.type.startsWith("image/")
        ? `<img src="${URL.createObjectURL(targetFile)}" class="adnn-wa-full-panel-img-preview" />`
        : `<div class="adnn-wa-doc-icon-fallback-box">📁<span>Document File Staged</span></div>`;
    }
  });

  closeUploadBtn?.addEventListener("click", () => {
    stagedFileAttachment = null;
    if (fileInputNode) fileInputNode.value = "";
    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    if (panelNode) panelNode.hidden = true;
  });

  clearQuoteBtn?.addEventListener("click", () => {
    stagedQuotedParentId = null;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    if (quoteBarNode) quoteBarNode.hidden = true;
  });

  // Handle WhatsApp Voice Interface Mappings securely across viewport scopes
  voiceRecordBtn?.addEventListener("mousedown", startVoiceRecordingPipeline);
  voiceRecordBtn?.addEventListener("mouseup", () => executeVoiceNoteTerminationAndDispatch(prefix));
  voiceRecordBtn?.addEventListener("mouseleave", () => executeVoiceNoteTerminationAndDispatch(prefix, true));

  voiceRecordBtn?.addEventListener("touchstart", (e) => { e.preventDefault(); startVoiceRecordingPipeline(); });
  voiceRecordBtn?.addEventListener("touchend", (e) => { e.preventDefault(); executeVoiceNoteTerminationAndDispatch(prefix); });

  targetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentChatId) return;

    const messageText = textInputNode.value.trim();
    if (!messageText && !stagedFileAttachment) return;

    // Reset layout elements locally to simulate sub-second interfaces responses
    textInputNode.value = "";
    const activeFilePayload = stagedFileAttachment;
    stagedFileAttachment = null;
    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    if (panelNode) panelNode.hidden = true;

    const parentQuoteId = stagedQuotedParentId;
    stagedQuotedParentId = null;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    if (quoteBarNode) quoteBarNode.hidden = true;

    try {
      let cloudMediaPayload = {};
      if (activeFilePayload) {
        cloudMediaPayload = await executeCloudStorageAssetUpload(activeFilePayload, currentChatId);
      }

      const coreMessageDocumentPayload = {
        text: messageText,
        senderUid: activeUser.uid,
        senderName: currentProfileCache?.name || activeUser.email,
        createdAt: serverTimestamp(),
        readBy: [activeUser.uid],
        ...cloudMediaPayload
      };

      if (parentQuoteId) {
        coreMessageDocumentPayload.replyToMessageId = parentQuoteId;
      }

      await addDoc(collection(db, "chats", currentChatId, "messages"), coreMessageDocumentPayload);

      const dynamicChannelUpdatePayload = {
        lastMessage: messageText || (activeFilePayload ? "📎 Document Deliverable" : "🎙️ Voice Note"),
        lastSenderUid: activeUser.uid,
        updatedAt: serverTimestamp()
      };

      if (type === "support") {
        if (isAdminEmail(activeUser.email)) {
          dynamicChannelUpdatePayload.unreadForClient = increment(1);
        } else {
          dynamicChannelUpdatePayload.unreadForAdmin = increment(1);
        }
      } else {
        dynamicChannelUpdatePayload.unreadForClient = increment(1);
        dynamicChannelUpdatePayload.unreadForAdmin = increment(1);
      }

      await updateDoc(doc(db, "chats", currentChatId), dynamicChannelUpdatePayload);
      setDoc(doc(db, "chats", currentChatId, "typing", activeUser.uid), { isTyping: false }, { merge: true });

    } catch (err) {
      console.warn("Message pipeline terminal failure: ", err);
    }
  });

  // Call Pipeline Triggers Hardware routing setup maps injection points
  document.getElementById(`${prefix}AudioCallBtn`)?.addEventListener("click", () => executeWebRTCHardwareCallInitialization("audio", type));
  document.getElementById(`${prefix}VideoCallBtn`)?.addEventListener("click", () => executeWebRTCHardwareCallInitialization("video", type));

  // Mount clean global cross-calling references under safe context frames closures
  window[`adnnTriggerReplyLink_${prefix}`] = function(messageId, senderName, textualSummary) {
    stagedQuotedParentId = messageId;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    const quoteUserNode = document.getElementById(`${prefix}QuoteUser`);
    const quoteTextNode = document.getElementById(`${prefix}QuoteText`);

    if (quoteBarNode && quoteUserNode && quoteTextNode) {
      quoteBarNode.hidden = false;
      quoteUserNode.textContent = senderName;
      quoteTextNode.textContent = textualSummary || "Media asset document attachment.";
    }
  };
}

/* ==========================================================================
   VIEWPORT RENDERING & COMPONENT BUILD HOOK FACTORIES
   ========================================================================== */

function renderConversationalMessageBubbles(messages, prefix, chatId) {
  const scrollerViewport = document.getElementById(`${prefix}Viewport`);
  if (!scrollerViewport) return;
  scrollerViewport.innerHTML = "";

  if (messages.length === 0) {
    scrollerViewport.innerHTML = `<div class="adnn-wa-empty-state">No messages registered in this operational timeline block.</div>`;
    return;
  }

  messages.forEach(msg => {
    const checkIsMine = msg.senderUid === activeUser.uid;
    const containerRowElement = document.createElement("div");
    containerRowElement.className = `adnn-wa-message-row-wrapper ${checkIsMine ? "is-mine-row" : "is-peer-row"}`;

    const bubbleBlock = document.createElement("div");
    bubbleBlock.className = `adnn-wa-chat-bubble-node ${checkIsMine ? "is-sender" : "is-receiver"}`;

    let replyContextMarkup = "";
    if (msg.replyToMessageId) {
      replyContextMarkup = `<div class="adnn-wa-bubble-quoted-parent-preview-box">Loading parent conversational link...</div>`;
      resolveQuotedParentPreviewAsync(chatId, msg.replyToMessageId, bubbleBlock);
    }

    let dynamicMediaMarkup = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        dynamicMediaMarkup = `<img src="${msg.mediaUrl}" class="adnn-wa-bubble-embedded-img" onclick="window.open('${msg.mediaUrl}','_blank')" />`;
      } else if (msg.mediaType?.startsWith("audio/")) {
        dynamicMediaMarkup = `
          <div class="adnn-wa-bubble-voice-note-player-row">
            <audio src="${msg.mediaUrl}" controls class="adnn-wa-bubble-native-audio-node"></audio>
          </div>
        `;
      } else {
        dynamicMediaMarkup = `<a href="${msg.mediaUrl}" target="_blank" rel="noopener" class="adnn-wa-bubble-file-download-card">📁 Open Shared Asset Deliverable</a>`;
      }
    }

    let visualReceiptTicks = "";
    if (checkIsMine) {
      const activeReadersArray = msg.readBy || [];
      const isReadAcrossEcosystem = activeReadersArray.length > 1;
      visualReceiptTicks = `<span class="adnn-wa-receipt-tick-indicator ${isReadAcrossEcosystem ? "is-read-blue" : ""}">&#10004;&#10004;</span>`;
    }

    const compiledReactionsArrayMap = msg.reactions || {};
    let parsedReactionsRowMarkup = "";
    if (Object.keys(compiledReactionsArrayMap).length > 0) {
      parsedReactionsRowMarkup = `<div class="adnn-wa-bubble-active-reactions-badge-line">`;
      Object.entries(compiledReactionsArrayMap).forEach(([uid, characterSymbol]) => {
        parsedReactionsRowMarkup += `<span>${characterSymbol}</span>`;
      });
      parsedReactionsRowMarkup += `</div>`;
    }

    bubbleBlock.innerHTML = `
      ${replyContextMarkup}
      <div class="adnn-wa-bubble-sender-identity-label" ${checkIsMine ? "hidden" : ""}>
        <strong>${escapeHtmlString(msg.senderName || "Studio Peer")}</strong>
      </div>
      ${dynamicMediaMarkup}
      ${msg.text ? `<p class="adnn-wa-bubble-text-paragraph-content">${escapeHtmlString(msg.text)}</p>` : ""}
      <div class="adnn-wa-bubble-metrics-footer-row">
        <span>${formatEpochTimestampToTimeString(msg.createdAt)}</span>
        ${visualReceiptTicks}
      </div>
      ${parsedReactionsRowMarkup}

      <div class="adnn-wa-bubble-hover-utilities-floating-menu">
        <button type="button" onclick="window['adnnTriggerReplyLink_${prefix}']('${msg.id}','${escapeHtmlString(msg.senderName)}','${escapeHtmlString(msg.text)}')">Reply</button>
        <button type="button" onclick="executeReactionPayloadCommit('${chatId}','${msg.id}','&#128077;')">&#128077;</button>
        <button type="button" onclick="executeReactionPayloadCommit('${chatId}','${msg.id}','&#10084;&#65039;')">&#10084;&#65039;</button>
        <button type="button" onclick="executeReactionPayloadCommit('${chatId}','${msg.id}','&#128514;')">&#128514;</button>
        ${checkIsMine ? `<button type="button" class="is-delete-action-label" onclick="dispatchMessageDeletionCycle('${chatId}','${msg.id}')">Delete</button>` : ""}
      </div>
    `;

    containerRowElement.appendChild(bubbleBlock);
    scrollerViewport.appendChild(containerRowElement);
  });

  // Lock scroll coordinates directly down to bottom edge terminal bases safely
  scrollerViewport.scrollTop = scrollerViewport.scrollHeight;
  
  // Expose routing active classes to structural containers tracking active states transformations
  document.body.classList.add("adnn-wa-mobile-view-active");
  const adminWorkspaceLayout = document.querySelector(".adnn-wa-admin-panel-frame");
  if (adminWorkspaceLayout) adminWorkspaceLayout.classList.add("adnn-wa-mobile-room-open");
}

async function resolveQuotedParentPreviewAsync(chatId, parentMessageId, bubbleDOMNode) {
  try {
    const parentDocSnapshot = await getDoc(doc(db, "chats", chatId, "messages", parentMessageId));
    if (parentDocSnapshot.exists()) {
      const data = parentDocSnapshot.data();
      const previewBoxContainerTarget = bubbleDOMNode.querySelector(".adnn-wa-bubble-quoted-parent-preview-box");
      if (previewBoxContainerTarget) {
        previewBoxContainerTarget.innerHTML = `
          <strong>${escapeHtmlString(data.senderName)}</strong>
          <p>${escapeHtmlString(data.text || "Shared attachment payload asset.")}</p>
        `;
      }
    }
  } catch (err) {}
}

/* ==========================================================================
   WHATSAPP MEDIA PROCESSING ENGINE (VOICE RECORDING STACK)
   ========================================================================== */

async function startVoiceRecordingPipeline() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const captureHardwareStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micRecorderInstance = new MediaRecorder(captureHardwareStream);
    let temporaryAudioDataBuffersChunks = [];

    micRecorderInstance.ondataavailable = (event) => {
      if (event.data.size > 0) temporaryAudioDataBuffersChunks.push(event.data);
    };

    micRecorderInstance.onstop = async () => {
      const consolidatedAudioBlobPayload = new Blob(temporaryAudioDataBuffersChunks, { type: "audio/ogg; codecs=opus" });
      const packagedVoiceBinaryFile = new File([consolidatedAudioBlobPayload], `voice_dispatch_${Date.now()}.ogg`, { type: "audio/ogg" });
      
      captureHardwareStream.getTracks().forEach(track => track.stop());
      
      if (voiceElapsedSeconds > 1 && currentChatId) {
        const structuralUploadedStoragePayloadData = await executeCloudStorageAssetUpload(packagedVoiceBinaryFile, currentChatId);
        await addDoc(collection(db, "chats", currentChatId, "messages"), {
          senderUid: activeUser.uid,
          senderName: currentProfileCache?.name || activeUser.email,
          createdAt: serverTimestamp(),
          readBy: [activeUser.uid],
          ...structuralUploadedStoragePayloadData
        });
      }
      voiceElapsedSeconds = 0;
    };

    micRecorderInstance.start();
    voiceElapsedSeconds = 0;
    voiceDurationTimer = setInterval(() => { voiceElapsedSeconds++; }, 1000);

  } catch (err) {
    console.error("Microphone hardware layer allocation exception track: ", err);
  }
}

function executeVoiceNoteTerminationAndDispatch(prefix, invalidateAndDropTrack = false) {
  if (voiceDurationTimer) clearInterval(voiceDurationTimer);
  if (!micRecorderInstance || micRecorderInstance.state === "inactive") return;

  if (invalidateAndDropTrack) {
    voiceElapsedSeconds = 0; // Nullify tracking timers metrics array configurations
  }
  micRecorderInstance.stop();
}

async function executeCloudStorageAssetUpload(file, chatId) {
  if (!storage) throw new Error("Firebase Cloud Storage system mapping interfaces unavailable.");
  const sanitizedFilenameString = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  const physicalDestinationStoragePath = `wa-vault/${chatId}/${activeUser.uid}/${Date.now()}_${sanitizedFilenameString}`;
  const uploadDestinationRefPointer = storageRef(storage, physicalDestinationStoragePath);

  await uploadBytes(uploadDestinationRefPointer, file);
  const publiclyAccessibleDownloadUrl = await getDownloadURL(uploadDestinationRefPointer);

  return {
    mediaUrl: publiclyAccessibleDownloadUrl,
    mediaName: file.name,
    mediaType: file.type || "application/octet-stream",
    mediaStoragePath: physicalDestinationStoragePath
  };
}

/* ==========================================================================
   TRANSACTION MODIFIERS (REACTIONS, READ RECEIPTS, MARKS)
   ========================================================================= */

async function executeReactionPayloadCommit(chatId, messageId, characterSymbol) {
  try {
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
      [`reactions.${activeUser.uid}`]: characterSymbol
    });
  } catch (err) {}
}

async function dispatchMessageDeletionCycle(chatId, messageId) {
  if (!confirm("Annihilate this message for all workspace peers permanently?")) return;
  try {
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
  } catch (err) {}
}

function executeReadReceiptsMarkingLoop(chatId, type) {
  if (!chatId) return;
  const targetCollectionMessagesRef = collection(db, "chats", chatId, "messages");
  getDocs(targetCollectionMessagesRef).then(snapshot => {
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const currentReadersListArray = data.readBy || [];
      if (!currentReadersListArray.includes(activeUser.uid)) {
        currentReadersListArray.push(activeUser.uid);
        updateDoc(docSnap.ref, { readBy: currentReadersListArray });
      }
    });
  });

  const clearanceObjectMap = {};
  if (type === "support") {
    clearanceObjectMap[isAdminEmail(activeUser.email) ? "unreadForAdmin" : "unreadForClient"] = 0;
  } else {
    clearanceObjectMap.unreadForAdmin = 0;
    clearanceObjectMap.unreadForClient = 0;
  }
  updateDoc(doc(db, "chats", chatId), clearanceObjectMap).catch(() => {});
}

/* ==========================================================================
   WEBRTC HARDWARE CALL ENGINE ENGINE (POLITE PEER MATRIX)
   ========================================================================== */

function bindIncomingCallInterceptor(user) {
  const dynamicInboxRoutingTargetKeyId = isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid;
  onSnapshot(doc(db, "callInbox", dynamicInboxRoutingTargetKeyId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const inboxPayloadData = snapshot.data();
    if (inboxPayloadData.status !== "ringing" || !inboxPayloadData.callId) return;

    const baseCallDocSnapshot = await getDoc(doc(db, "calls", inboxPayloadData.callId));
    if (!baseCallDocSnapshot.exists()) return;
    const callStructuralContextData = baseCallDocSnapshot.data();

    if (Date.now() > Number(callStructuralContextData.expiresAtMs || 0) || callStructuralContextData.status !== "ringing") {
      purgeSignalingTransactionTracesGarbage(inboxPayloadData.callId, dynamicInboxRoutingTargetKeyId);
      return;
    }

    if (callStructuralContextData.callerUid !== dynamicInboxRoutingTargetKeyId) {
      renderActiveIncomingCallOverlayStage(inboxPayloadData.callId, callStructuralContextData);
    }
  });
}

async function executeWebRTCHardwareCallInitialization(kind, chatType) {
  if (!navigator.mediaDevices || !RTCPeerConnection) {
    alert("WebRTC streaming dependencies map unavailable across this browser engine setup.");
    return;
  }

  const triggerVideoTrackActiveState = kind === "video";
  try {
    const structuralHardwareMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: triggerVideoTrackActiveState });
    const programmaticGeneratedCallId = `call_${Date.now()}_${activeUser.uid.slice(0, 4)}`;

    let calculatedReceiverUidTargetId = ADMIN_ALIAS_UID;
    let fallbackTextDisplayLabel = "AdnnStudio Administrative Support";

    if (chatType === "direct") {
      const activeChatBaseSnapshot = await getDoc(doc(db, "chats", currentChatId));
      const dataset = activeChatBaseSnapshot.data();
      calculatedReceiverUidTargetId = dataset.participantUids?.find(uid => uid !== activeUser.uid);
      fallbackTextDisplayLabel = dataset.participantNames?.[calculatedReceiverUidTargetId] || "Studio Workspace Peer";
    } else if (isAdminEmail(activeUser.email)) {
      const activeChatBaseSnapshot = await getDoc(doc(db, "chats", currentChatId));
      calculatedReceiverUidTargetId = activeChatBaseSnapshot.data().clientUid;
      fallbackTextDisplayLabel = activeChatBaseSnapshot.data().clientName || "Client Session Track";
    }

    liveCallSession = {
      callId: programmaticGeneratedCallId, role: "caller", kind, isPolitePeer: false,
      localStream: structuralHardwareMediaStream, remoteStream: new MediaStream(),
      peerConnection: null, receiverUid: calculatedReceiverUidTargetId, chatId: currentChatId, label: fallbackTextDisplayLabel
    };

    renderActiveWebRTCCallOverlayStageWindow();
    assembleWebRTCPeerConnectionPipeline(programmaticGeneratedCallId, triggerVideoTrackActiveState);

    const generatedOfferSDPPermalink = await liveCallSession.peerConnection.createOffer();
    await liveCallSession.peerConnection.setLocalDescription(generatedOfferSDPPermalink);

    const computationalExpirationExpiryLimitMarker = Date.now() + CALL_RING_TIMEOUT_MS;
    await setDoc(doc(db, "calls", programmaticGeneratedCallId), {
      id: programmaticGeneratedCallId, chatId: currentChatId, status: "ringing", kind,
      callerUid: activeUser.uid, callerName: currentProfileCache?.name || activeUser.email,
      receiverUid: calculatedReceiverUidTargetId, offer: { type: generatedOfferSDPPermalink.type, sdp: generatedOfferSDPPermalink.sdp },
      expiresAtMs: computationalExpirationExpiryLimitMarker, micMuted: false, cameraOn: triggerVideoTrackActiveState
    });

    await setDoc(doc(db, "callInbox", calculatedReceiverUidTargetId), { callId: programmaticGeneratedCallId, status: "ringing" });

  } catch (err) {
    alert(`Hardware streaming devices activation failed: ${err.message}`);
  }
}

function assembleWebRTCPeerConnectionPipeline(callId, triggerVideoTrackActiveState) {
  const peerConnectionInstance = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
  });

  liveCallSession.peerConnection = peerConnectionInstance;

  liveCallSession.localStream.getTracks().forEach(track => {
    peerConnectionInstance.addTrack(track, liveCallSession.localStream);
  });

  peerConnectionInstance.onicecandidate = (event) => {
    if (!event.candidate) return;
    const targetingCollectionPathNameId = liveCallSession.role === "caller" ? "offerCandidates" : "answerCandidates";
    addDoc(collection(db, "calls", callId, targetingCollectionPathNameId), event.candidate.toJSON());
  };

  peerConnectionInstance.ontrack = (event) => {
    const streamsTrackArray = event.streams;
    if (streamsTrackArray && streamsTrackArray[0]) {
      streamsTrackArray[0].getTracks().forEach(track => liveCallSession.remoteStream.addTrack(track));
    } else {
      liveCallSession.remoteStream.addTrack(event.track);
    }
    const remoteStreamVideoNodeDOMMount = document.getElementById("waRemoteVideoMount");
    if (remoteStreamVideoNodeDOMMount) remoteStreamVideoNodeDOMMount.srcObject = liveCallSession.remoteStream;
  };

  onSnapshot(doc(db, "calls", callId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const callDataSnapshotMapValues = snapshot.data();

    if (callDataSnapshotMapValues.status === "accepted" && peerConnectionInstance.signalingState === "have-local-offer" && liveCallSession.role === "caller") {
      await peerConnectionInstance.setRemoteDescription(new RTCSessionDescription(callDataSnapshotMapValues.answer));
      engageViewportTimerCounterLine();
    }

    if (callDataSnapshotMapValues.status === "ended") {
      terminateWebRTCCallSessionContext(false);
    }

    const remoteStreamVideoNodeDOMMount = document.getElementById("waRemoteVideoMount");
    if (remoteStreamVideoNodeDOMMount) {
      remoteStreamVideoNodeDOMMount.style.opacity = callDataSnapshotMapValues.cameraOn === false ? "0" : "1";
    }
  });

  const incomingIceCandidatesTargetingPathString = liveCallSession.role === "caller" ? "answerCandidates" : "offerCandidates";
  onSnapshot(collection(db, "calls", callId, incomingIceCandidatesTargetingPathString), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        peerConnectionInstance.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      }
    });
  });
}

function renderActiveIncomingCallOverlayStage(callId, callData) {
  if (document.getElementById("waCallHardwareStageOverlay")) return;

  const htmlOverlayNodeStageContainer = document.createElement("div");
  htmlOverlayNodeStageContainer.id = "waCallHardwareStageOverlay";
  htmlOverlayNodeStageContainer.className = "adnn-wa-webrtc-fullscreen-stage-overlay unified-flex-centering-utility";
  htmlOverlayNodeStageContainer.innerHTML = `
    <div class="adnn-wa-webrtc-card-modal glass">
      <div class="adnn-wa-modal-avatar-wrapper">${callData.callerName.slice(0, 2).toUpperCase()}</div>
      <h2>${escapeHtmlString(callData.callerName)}</h2>
      <p>Incoming Adnn Workspace ${callData.kind.toUpperCase()} Call...</p>
      <div class="adnn-wa-modal-controls-row">
        <button type="button" class="adnn-wa-ctrl-btn-node is-green-success" id="waAcceptBtn">&#10004;</button>
        <button type="button" class="adnn-wa-ctrl-btn-node is-red-danger" id="waDeclineBtn">&times;</button>
      </div>
    </div>
  `;

  document.body.appendChild(htmlOverlayNodeStageContainer);

  document.getElementById("waAcceptBtn")?.addEventListener("click", async () => {
    htmlOverlayNodeStageContainer.remove();
    try {
      const activeVideoTrackState = callData.kind === "video";
      const hardwareMediaCapturedStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: activeVideoTrackState });

      liveCallSession = {
        callId, role: "receiver", kind: callData.kind, isPolitePeer: true,
        localStream: hardwareMediaCapturedStream, remoteStream: new MediaStream(), peerConnection: null,
        receiverUid: callData.callerUid, chatId: callData.chatId, label: callData.callerName
      };

      renderActiveCallHardwareOverlayWindow();
      assembleWebRTCPeerConnectionPipeline(callId, activeVideoTrackState);

      await liveCallSession.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const structuralGeneratedAnswerSDPData = await liveCallSession.peerConnection.createAnswer();
      await liveCallSession.peerConnection.setLocalDescription(structuralGeneratedAnswerSDPData);

      await updateDoc(doc(db, "calls", callId), {
        status: "accepted", answer: { type: structuralGeneratedAnswerSDPData.type, sdp: structuralGeneratedAnswerSDPData.sdp }
      });

      await updateDoc(doc(db, "callInbox", isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid), { status: "accepted" });
      engageViewportTimerCounterLine();

    } catch (err) {
      executeTerminationSignalingCycle(callId);
    }
  });

  document.getElementById("waDeclineBtn")?.addEventListener("click", () => {
    htmlOverlayNodeStageContainer.remove();
    executeTerminationSignalingCycle(callId);
  });
}

function executeTerminationSignalingCycle(callId) {
  updateDoc(doc(db, "calls", callId), { status: "ended" }).catch(() => {});
  purgeSignalingTransactionTracesGarbage(callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
}

function renderActiveCallHardwareOverlayWindow() {
  if (document.getElementById("waCallHardwareStageOverlay")) return;

  const htmlOverlayNodeStageContainer = document.createElement("div");
  htmlOverlayNodeStageContainer.id = "waCallHardwareStageOverlay";
  htmlOverlayNodeStageContainer.className = "adnn-wa-webrtc-fullscreen-stage-overlay unified-flex-centering-utility";
  htmlOverlayNodeStageContainer.innerHTML = `
    <div class="adnn-wa-webrtc-card-modal is-live-call-pane glass">
      <div class="adnn-wa-webrtc-video-tiles-grid-mesh">
        <video id="waRemoteVideoMount" autoplay playsinline class="adnn-wa-video-stream-node-frame is-remote-peer-track"></video>
        <video id="waLocalVideoMount" autoplay muted playsinline class="adnn-wa-video-stream-node-frame is-local-mirror-flipped"></video>
      </div>
      <div class="adnn-wa-webrtc-live-identity-row">
        <h3>${escapeHtmlString(liveCallSession.label)}</h3>
        <p id="waCallTimerLineText">Connecting operational system pipelines...</p>
      </div>
      <div class="adnn-wa-modal-controls-row">
        <button type="button" class="adnn-wa-ctrl-btn-node" id="waToggleMicBtn">${SVG_MIC}</button>
        <button type="button" class="adnn-wa-ctrl-btn-node" id="waToggleCamBtn">${SVG_VIDEO}</button>
        <button type="button" class="adnn-wa-ctrl-btn-node is-red-danger" id="waHangupBtn">${SVG_HANGUP}</button>
      </div>
    </div>
  `;

  document.body.appendChild(htmlOverlayNodeStageContainer);

  const localVideoDOMElementMountNode = document.getElementById("waLocalVideoMount");
  if (localVideoDOMElementMountNode) localVideoDOMElementMountNode.srcObject = liveCallSession.localStream;

  document.getElementById("waToggleMicBtn")?.addEventListener("click", (event) => {
    const audioTrack = liveCallSession.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      event.currentTarget.innerHTML = audioTrack.enabled ? SVG_MIC : SVG_MIC_OFF;
      event.currentTarget.classList.toggle("is-deactivated-highlight", !audioTrack.enabled);
      updateDoc(doc(db, "calls", liveCallSession.callId), { micMuted: !audioTrack.enabled });
    }
  });

  document.getElementById("waToggleCamBtn")?.addEventListener("click", (event) => {
    const videoTrack = liveCallSession.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      event.currentTarget.innerHTML = videoTrack.enabled ? SVG_VIDEO : SVG_VIDEO_OFF;
      event.currentTarget.classList.toggle("is-deactivated-highlight", !videoTrack.enabled);
      updateDoc(doc(db, "calls", liveCallSession.callId), { cameraOn: videoTrack.enabled });
      localVideoDOMElementMountNode.style.opacity = videoTrack.enabled ? "1" : "0";
    }
  });

  document.getElementById("waHangupBtn")?.addEventListener("click", () => {
    terminateWebRTCCallSessionContext(true);
  });
}

function engageViewportTimerCounterLine() {
  let ticksCounterValue = 0;
  const timerTextLabelDOMNode = document.getElementById("waCallTimerLineText");
  if (!timerTextLabelDOMNode) return;

  setInterval(() => {
    ticksCounterValue++;
    const formattedMinutes = String(Math.floor(ticksCounterValue / 60)).padStart(2, "0");
    const formattedSeconds = String(Math.floor(ticksCounterValue % 60)).padStart(2, "0");
    if (timerTextLabelDOMNode) timerTextLabelDOMNode.textContent = `${formattedMinutes}:${formattedSeconds}`;
  }, 1000);
}

function terminateWebRTCCallSessionContext(explicitlyTriggeredByLocalPeer = true) {
  if (!liveCallSession) return;

  if (explicitlyTriggeredByLocalPeer) {
    updateDoc(doc(db, "calls", liveCallSession.callId), { status: "ended" }).catch(() => {});
  }

  if (liveCallSession.localStream) {
    liveCallSession.localStream.getTracks().forEach(track => track.stop());
  }

  if (liveCallSession.peerConnection) {
    liveCallSession.peerConnection.close();
  }

  purgeSignalingTransactionTracesGarbage(liveCallSession.callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
  
  const stageOverlayDOMNodeContainer = document.getElementById("waCallHardwareStageOverlay");
  if (stageOverlayDOMNodeContainer) stageOverlayDOMNodeContainer.remove();

  liveCallSession = null;
}

async function purgeSignalingTransactionTracesGarbage(callId, targetInboxId) {
  if (!callId) return;
  setTimeout(async () => {
    await deleteDoc(doc(db, "callInbox", targetInboxId)).catch(() => {});
    await deleteDoc(doc(db, "calls", callId)).catch(() => {});
  }, CALL_SIGNAL_CLEANUP_DELAY_MS);
}

/* ==========================================================================
   SUPPORT SYSTEM PRESENCE UTILITIES
   ========================================================================== */

function syncPresenceNode(user) {
  const presenceDocReferencePointer = doc(db, "presence", isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid);
  const writeOnlineStateTransactionCommit = () => setDoc(presenceDocReferencePointer, { online: true, lastSeen: serverTimestamp() }, { merge: true });
  
  writeOnlineStateTransactionCommit();
  setInterval(writeOnlineStateTransactionCommit, 35000);
  window.addEventListener("beforeunload", () => setDoc(presenceDocReferencePointer, { online: false, lastSeen: serverTimestamp() }, { merge: true }));
}

function disconnectSystemListeners() {
  if (activeChatUnsub) activeChatUnsub();
  if (activeMessagesUnsub) activeMessagesUnsub();
  if (adminGlobalUnsub) adminGlobalUnsub();
}

async function extractProfileInformation(uid, email) {
  const clientSnapshotResult = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (clientSnapshotResult?.exists()) return { uid, role: "client", ...clientSnapshotResult.data() };

  const designerSnapshotResult = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designerSnapshotResult?.exists()) return { uid, role: "designer", ...designerSnapshotResult.data() };

  return { uid, email, role: isAdminEmail(email) ? "admin" : "client", name: email.split("@")[0] };
}

function renderEmptyLayoutFallback(prefix, titleText, helpSummaryBody) {
  const coreShellDOMNodeFrame = document.getElementById(`${prefix}CoreShell`);
  if (coreShellDOMNodeFrame) {
    coreShellDOMNodeFrame.innerHTML = `
      <div class="adnn-wa-placeholder-screen">
        <div class="adnn-wa-branding-avatar">AD</div>
        <h3>${escapeHtmlString(titleText)}</h3>
        <p>${escapeHtmlString(helpSummaryBody)}</p>
      </div>
    `;
  }
}

function getEpochTime(timestamp) {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  return new Date(timestamp).getTime();
}

function formatEpochTimestampToTimeString(timestamp) {
  if (!timestamp) return "Just now";
  const dateInstance = new Date(getEpochTime(timestamp));
  return dateInstance.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtmlString(stringLiteral) {
  return String(stringLiteral || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function sanitizeString(val) {
  return escapeHtmlString(val);
}

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

/* ==========================================================================
   PORTAL EXTRA-PREMIUM SCOPED WHATSAPP MODULE STYLING SCHEMES
   ========================================================================== */

function injectScopedSystemStyles() {
  if (document.getElementById("adnnWaIsolatedStyleBlock")) return;
  const embeddedStyleDOMNodeElement = document.createElement("style");
  embeddedStyleDOMNodeElement.id = "adnnWaIsolatedStyleBlock";
  embeddedStyleDOMNodeElement.textContent = `
    /* Isolated Module Container Matrix Bounds */
    .adnn-wa-container {
      width: 100%;
      height: 100%;
      display: block;
      position: relative;
    }

    /* Isolated Framework Architecture Frames Mappings */
    .adnn-wa-messenger-shell-frame {
      display: grid;
      grid-template-rows: 64px 1fr auto;
      height: min(600px, calc(100svh - 220px));
      background: linear-gradient(145deg, #0b0b0f 0%, #060608 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      overflow: hidden;
      position: relative;
    }

    .adnn-wa-admin-panel-frame {
      display: grid;
      grid-template-columns: 300px 1fr;
      height: calc(100vh - 150px);
      background: rgba(10, 10, 14, 0.2);
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .adnn-wa-admin-sidebar {
      background: rgba(15, 15, 22, 0.4);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: grid;
      grid-template-rows: 60px 1fr;
    }

    .adnn-wa-sidebar-search-container {
      padding: 10px;
      display: flex;
      align-items: center;
    }

    .adnn-wa-sidebar-search-container input {
      height: 38px;
      background: #000000 !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 12px;
      padding: 0 14px;
      color: #fff !important;
      font-size: 13px;
      width: 100%;
    }

    .adnn-wa-sidebar-stream-list {
      overflow-y: auto;
      padding: 8px;
    }

    .adnn-wa-sidebar-list-row-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 14px;
      cursor: pointer;
      margin-bottom: 4px;
      transition: background 0.2s ease;
      position: relative;
    }

    .adnn-wa-sidebar-list-row-item:hover, .adnn-wa-sidebar-list-row-item.is-selected {
      background: rgba(39, 45, 207, 0.16);
    }

    .adnn-wa-row-avatar-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #272dcf;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
    }

    .adnn-wa-row-content-block { flex: 1; min-width: 0; }
    .adnn-wa-row-top-line { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
    .adnn-wa-row-top-line strong { font-size: 14px; font-weight: 500; color: #fff; }
    .adnn-wa-row-content-block p { margin: 0; font-size: 12px; color: rgba(255,255,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .adnn-wa-unread-badge {
      background: #ff2602;
      color: #fff;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-family: monospace;
    }

    .adnn-wa-admin-chat-view-container {
      background: rgba(0, 0, 0, 0.2);
      position: relative;
    }

    .adnn-wa-admin-chat-view-container .adnn-wa-messenger-shell-frame {
      height: 100% !important; border-radius: 0; border: 0;
    }

    /* WhatsApp Component Viewport Structure mapping specifications */
    .adnn-wa-header-action-bar {
      height: 64px;
      background: rgba(20, 20, 26, 0.5);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }

    .adnn-wa-mobile-back-nav-btn {
      display: none; background: transparent; border: 0; color: #fff;
      font-size: 20px; cursor: pointer; padding-right: 10px;
    }

    .adnn-wa-header-profile-block { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .adnn-wa-header-avatar-node {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #272dcf;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
      flex-shrink: 0;
    }

    .adnn-wa-header-text-details { min-width: 0; }
    .adnn-wa-header-text-details h4 { margin: 0; font-size: 14.5px; font-weight: 500; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adnn-wa-header-text-details small { font-size: 11px; display: block; margin-top: 1px; }
    
    .is-online-active-green { color: #25d366 !important; font-weight: 500; }
    .is-offline-text { color: rgba(255, 255, 255, 0.4) !important; }

    .adnn-wa-header-hardware-utilities { display: flex; align-items: center; gap: 6px; }
    .adnn-wa-util-btn {
      width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.04);
      border: 0; color: #fff; display: grid; place-items: center; cursor: pointer; transition: background 0.2s;
    }
    .adnn-wa-util-btn:hover { background: rgba(39, 45, 207, 0.24); color: #8d96ff; }
    .adnn-wa-util-btn svg { width: 17px; height: 17px; }

    .adnn-wa-messages-viewport-scroller {
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: rgba(0, 0, 0, 0.15);
    }

    .adnn-wa-message-row-wrapper { width: 100%; display: flex; }
    .is-mine-row { justify-content: flex-end; }
    .is-peer-row { justify-content: flex-start; }

    /* Conversational WhatsApp Shapes Engine Parameters */
    .adnn-wa-chat-bubble-node {
      max-width: 72%;
      padding: 10px 12px;
      border-radius: 14px;
      position: relative;
      color: #fff;
      font-size: 14px;
      line-height: 1.45;
    }

    .is-sender {
      background: linear-gradient(135deg, #272dcf 0%, #171ca1 100%);
      border-top-right-radius: 2px;
    }

    .is-receiver {
      background: rgba(255, 255, 255, 0.05);
      border-top-left-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .adnn-wa-bubble-sender-identity-label strong {
      font-size: 11px; color: #8d96ff; display: block; margin-bottom: 4px; font-family: monospace;
    }

    .adnn-wa-bubble-text-paragraph-content { margin: 0; word-break: break-word; }

    .adnn-wa-bubble-metrics-footer-row {
      display: flex; align-items: center; justify-content: flex-end; gap: 5px;
      margin-top: 5px; font-size: 10px; color: rgba(255, 255, 255, 0.4); font-family: monospace;
    }

    .adnn-wa-receipt-tick-indicator { font-size: 11px; color: rgba(255, 255, 255, 0.3); }
    .is-read-blue { color: #34b7f1 !important; }

    /* Interactive Context Popup Items */
    .adnn-wa-bubble-hover-utilities-floating-menu {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: #0f0f14; border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px; padding: 4px; display: none; gap: 4px; z-index: 10;
    }
    .is-sender .adnn-wa-bubble-hover-utilities-floating-menu { left: -140px; }
    .is-receiver .adnn-wa-bubble-hover-utilities-floating-menu { right: -140px; }
    .adnn-wa-chat-bubble-node:hover .adnn-wa-bubble-hover-utilities-floating-menu { display: flex; }

    .adnn-wa-bubble-hover-utilities-floating-menu button {
      background: transparent; border: 0; color: #fff; font-size: 11px; cursor: pointer; padding: 2px 4px;
    }
    .adnn-wa-bubble-hover-utilities-floating-menu button:hover { color: #8d96ff; }
    .is-delete-action-label { color: #ff3b30 !important; }

    /* Media Embed Layout Frames styling blocks */
    .adnn-wa-bubble-embedded-img {
      max-width: 100%; max-height: 240px; border-radius: 10px; object-fit: cover; margin-bottom: 4px; cursor: pointer;
    }
    .adnn-wa-bubble-file-download-card {
      display: flex; align-items: center; gap: 8px; color: #8d96ff; text-decoration: none;
      font-size: 12.5px; background: rgba(0, 0, 0, 0.2); padding: 8px 12px; border-radius: 8px;
    }
    .adnn-wa-bubble-native-audio-node { height: 32px; max-width: 200px; margin-top: 4px; }
    .adnn-wa-bubble-active-reactions-badge-line {
      position: absolute; bottom: -10px; right: 10px; background: #0f0f14;
      border: 1px solid rgba(255, 255, 255, 0.08); padding: 1px 5px; border-radius: 10px;
      display: flex; gap: 2px; font-size: 10px; z-index: 2;
    }

    /* Interactive Composer Blocks */
    .adnn-wa-composer-area-container {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding: 12px; background: rgba(10, 10, 14, 0.8); position: relative;
    }

    .adnn-wa-composer-form-interface { display: flex; align-items: center; gap: 10px; }
    .adnn-wa-file-attachment-trigger-label {
      color: rgba(245, 245, 247, 0.6); cursor: pointer; display: grid; place-items: center;
    }
    .adnn-wa-file-attachment-trigger-label svg { width: 20px; height: 20px; }

    .adnn-wa-input-wrapper-node { flex: 1; position: relative; display: flex; align-items: center; }
    .adnn-wa-input-wrapper-node input {
      height: 42px; width: 100%; border-radius: 20px; background: #000000 !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important; padding: 0 40px 0 14px;
      color: #fff !important; font-size: 14px;
    }

    .adnn-wa-typing-indicator-dot-matrix { position: absolute; right: 14px; display: flex; gap: 3px; }
    .adnn-wa-typing-indicator-dot-matrix span {
      width: 4px; height: 4px; background: #272dcf; border-radius: 50%;
      animation: waTypingIndicatorAnimation 1.4s infinite both;
    }
    .adnn-wa-typing-indicator-dot-matrix span:nth-child(2) { animation-delay: 0.2s; }
    .adnn-wa-typing-indicator-dot-matrix span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes waTypingIndicatorAnimation {
      0%, 100% { transform: scale(0.6); opacity: 0.4; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    .adnn-wa-voice-record-action-btn, .adnn-wa-submit-message-btn {
      width: 42px; height: 42px; border-radius: 50%; border: 0; display: grid;
      place-items: center; cursor: pointer; color: #fff;
    }

    .adnn-wa-voice-record-action-btn { background: rgba(255,255,255,0.04); }
    .adnn-wa-voice-record-action-btn:hover { background: rgba(255, 59, 48, 0.14); color: #ff3b30; }
    .adnn-wa-submit-message-btn { background: #272dcf; }
    .adnn-wa-submit-message-btn:hover { background: #3946ff; }
    .adnn-wa-submit-message-btn svg, .adnn-wa-voice-record-action-btn svg { width: 16px; height: 16px; }

    /* In-Chat Fullscreen Preview & Quote context layouts */
    .adnn-wa-fullscreen-upload-preview-panel {
      position: absolute; bottom: 100%; left: 0; right: 0; height: 240px;
      background: #08080c; border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 100; padding: 14px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
    }
    .adnn-wa-close-preview-btn, .adnn-wa-clear-quote-btn {
      position: absolute; top: 10px; right: 14px; background: transparent;
      border: 0; color: rgba(255, 255, 255, 0.4); font-size: 20px; cursor: pointer;
    }
    .adnn-wa-preview-render-mount { max-width: 100%; max-height: 160px; overflow: hidden; border-radius: 8px; }
    .adnn-wa-full-panel-img-preview { max-width: 100%; max-height: 160px; object-fit: contain; }
    .adnn-wa-preview-metadata-tag { font-size: 11px; color: rgba(255,255,255,0.5); font-family: monospace; }

    .adnn-wa-quoted-reply-context-bar {
      display: grid; grid-template-columns: 3px 1fr auto; gap: 10px;
      background: rgba(0, 0, 0, 0.4); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px;
    }
    .adnn-wa-quote-vertical-bar { background: #272dcf; border-radius: 1px; }
    .adnn-wa-quote-details-block strong { font-size: 12px; color: #8d96ff; display: block; }
    .adnn-wa-quote-details-block p { margin: 0; font-size: 11px; color: rgba(255,255,255,0.5); }
    
    .adnn-wa-bubble-quoted-parent-preview-box {
      background: rgba(0, 0, 0, 0.15); border-left: 3px solid #8d96ff;
      padding: 5px 8px; border-radius: 6px; margin-bottom: 5px; font-size: 12px;
    }
    .adnn-wa-bubble-quoted-parent-preview-box strong { color: #8d96ff; display: block; margin-bottom: 1px; }
    .adnn-wa-bubble-quoted-parent-preview-box p { margin: 0; opacity: 0.75; }
    .adnn-wa-loader, .adnn-wa-empty-state { margin: auto; font-family: monospace; font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; }

    /* ==========================================================================
       WEBRTC HARDWARE ENGINE OVERLAY STAGE OVERRIDES
       ========================================================================== */
    .adnn-wa-webrtc-fullscreen-stage-overlay {
      position: fixed; inset: 0; background: rgba(4, 4, 6, 0.94);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 2147483645;
    }
    .unified-flex-centering-utility { display: flex; align-items: center; justify-content: center; }
    .adnn-wa-webrtc-card-modal {
      width: min(420px, calc(100vw - 24px)); background: #0b0b0f;
      border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px;
      padding: 24px; text-align: center; color: #fff;
    }
    .adnn-wa-modal-avatar-wrapper {
      width: 68px; height: 68px; border-radius: 20px; background: #272dcf;
      margin: 0 auto 16px; display: grid; place-items: center; font-size: 22px; font-weight: 500;
    }
    .adnn-wa-webrtc-card-modal h2 { margin: 0 0 4px; font-size: 20px; font-weight: 500; }
    .adnn-wa-webrtc-card-modal p { margin: 0 0 24px; font-size: 12.5px; color: rgba(255,255,255,0.4); font-family: monospace; }
    .adnn-wa-modal-controls-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
    
    .adnn-wa-ctrl-btn-node {
      width: 50px; height: 50px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.06);
      color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform 0.2s;
    }
    .adnn-wa-ctrl-btn-node:hover { transform: scale(1.05); }
    .adnn-wa-ctrl-btn-node svg { width: 18px; height: 18px; }
    .is-green-success { background: #25d366 !important; }
    .is-red-danger { background: #ff3b30 !important; }
    .is-deactivated-highlight { background: #ff2602 !important; }

    .is-live-call-pane { width: min(680px, calc(100vw - 20px)) !important; padding: 14px !important; }
    .adnn-wa-webrtc-video-tiles-grid-mesh {
      width: 100%; aspect-ratio: 16/10; background: #000; border-radius: 16px;
      overflow: hidden; margin-bottom: 14px; position: relative;
    }
    .adnn-wa-video-stream-node-frame { width: 100%; height: 100%; object-fit: cover; background: #030305; }
    .is-local-mirror-flipped {
      position: absolute; bottom: 12px; right: 12px; width: 24%; aspect-ratio: 3/4;
      border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); transform: scaleX(-1);
    }
    .adnn-wa-webrtc-live-identity-row { text-align: left; padding: 0 2px; margin-bottom: 16px; }
    .adnn-wa-webrtc-live-identity-row h3 { margin: 0 0 2px; font-size: 16px; font-weight: 500; }
    .adnn-wa-webrtc-live-identity-row p { margin: 0; font-size: 12px; }

    /* ==========================================================================
       WHATSAPP EXACT MOBILE NATIVE APP EXPERIENCE OVERACTIVE OVERRIDES
       ========================================================================== */
    @media (max-width: 760px) {
      /* Force active mobile view to lock scroll lines safely on body elements */
      body.adnn-wa-mobile-view-active {
        overflow: hidden !important;
        position: fixed !important;
        width: 100vw !important;
        height: 100svh !important;
      }

      .adnn-wa-messenger-shell-frame {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100svh !important;
        max-height: 100svh !important;
        z-index: 2147483500 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: #050507 !important;
        display: grid !important;
        grid-template-rows: 60px 1fr auto !important;
      }

      .adnn-wa-mobile-back-nav-btn { display: block !important; }

      .adnn-wa-admin-panel-frame {
        grid-template-columns: 1fr !important;
        height: 100svh !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483400 !important;
        border: 0 !important;
        border-radius: 0 !important;
      }

      .adnn-wa-admin-panel-frame .adnn-wa-admin-chat-view-container {
        display: none;
      }

      .adnn-wa-admin-panel-frame.adnn-wa-mobile-room-open .adnn-wa-admin-sidebar {
        display: none !important;
      }

      .adnn-wa-admin-panel-frame.adnn-wa-mobile-room-open .adnn-wa-admin-chat-view-container {
        display: block !important;
        width: 100vw !important;
        height: 100svh !important;
      }

      .adnn-wa-chat-bubble-node { max-width: 85% !important; }
      .adnn-wa-bubble-hover-utilities-floating-menu { top: auto; bottom: -34px; left: 4px !important; right: auto !important; }
    }
  `;
  document.head.appendChild(embeddedStyleDOMNodeElement);
}
