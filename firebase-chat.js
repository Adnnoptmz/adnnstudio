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

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

// Application Operational Engine States
let activeUser = null;
let currentProfileCache = null;
let currentChatId = "";
let currentChatType = ""; 
let selectedChatCacheData = null; 

let globalChannelsUnsub = null;
let activeMessagesUnsub = null;
let liveCallSession = null;
let micRecorderInstance = null;
let voiceRecordTimer = null;
let voiceElapsedSeconds = 0;

// Premium Apple-Tahoe Vector Svg Resource Library
const SVG_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v0z"/></svg>`;
const SVG_VIDEO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><polyline points="23 10 19 12 23 14"/></svg>`;
const SVG_VIDEO_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10l-2.66-2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const SVG_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const SVG_MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
const SVG_HANGUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`;
const SVG_CLIP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

if (db && auth) {
  injectScopedWorkspaceStyles();
  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    if (!user) {
      disconnectEcosystemListeners();
      return;
    }
    currentProfileCache = await extractProfileInformation(user.uid, user.email);
    initializePresencePing(user);
    bindIncomingCallInterceptor(user);
    
    if (location.pathname.includes("admin.html")) {
      buildAdminChatInterface();
    } else {
      buildStandardUserPortal();
    }
  });
}

/* ==========================================================================
   PORTAL INTERFACE ROUTING PLATFORM
   ========================================================================== */

function buildStandardUserPortal() {
  const userChatMount = document.getElementById("directChatMount");
  const supportChatMount = document.getElementById("clientChatMount");

  if (userChatMount) {
    userChatMount.className = "adnn-app-wrapper";
    userChatMount.innerHTML = `
      <div class="adnn-app-layout-grid-frame">
        <div class="adnn-app-sidebar-pane">
          <div class="adnn-app-sidebar-header-line"><strong>User Chats</strong></div>
          <div class="adnn-app-threads-vertical-stack" id="directThreadsList">
            <div class="adnn-app-view-loader">Connecting live data feeds...</div>
          </div>
        </div>
        <div class="adnn-app-chat-room-pane" id="directRoomTarget">
          <div class="adnn-app-placeholder-screen-view">
            <div class="adnn-app-placeholder-avatar-logo">AD</div>
            <h3>Your User Channels</h3>
            <p>Select an approved conversation card from the matrix to read messages and start working.</p>
          </div>
        </div>
      </div>
    `;
    initializeUserSpecificChannelsFeed("direct", "directThreadsList");
  }

  if (supportChatMount) {
    supportChatMount.className = "adnn-app-wrapper";
    supportChatMount.innerHTML = `
      <div class="adnn-app-layout-grid-frame is-standalone-mode">
        <div class="adnn-app-chat-room-pane" id="supportRoomTarget"></div>
      </div>
    `;
    currentChatId = `support_${activeUser.uid}`;
    currentChatType = "support";
    loadActiveRoomViewport("support", "supportRoomTarget");
  }
}

function buildAdminChatInterface() {
  const adminPanelTarget = document.getElementById("chats_view");
  if (!adminPanelTarget) return;

  adminPanelTarget.className = "adnn-app-wrapper";
  adminPanelTarget.innerHTML = `
    <div class="adnn-app-layout-grid-frame">
      <div class="adnn-app-sidebar-pane">
        <div class="adnn-app-sidebar-search-input-row">
          <input type="text" id="waAdminSearch" placeholder="Search conversations...">
        </div>
        <div class="adnn-app-threads-vertical-stack" id="adminThreadsList">
          <div class="adnn-app-view-loader">Connecting administrative feeds...</div>
        </div>
      </div>
      <div class="adnn-app-chat-room-pane" id="adminRoomTarget">
        <div class="adnn-app-placeholder-screen-view">
          <div class="adnn-app-placeholder-avatar-logo">AD</div>
          <h3>Studio Control Suite</h3>
          <p>Select an active communication row from the left panel to execute secure chats, calls, or reviews.</p>
        </div>
      </div>
    </div>
  `;

  initializeUserSpecificChannelsFeed("admin", "adminThreadsList");

  document.getElementById("waAdminSearch")?.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".adnn-app-thread-item-row-btn").forEach(row => {
      const match = row.innerText.toLowerCase().includes(val);
      row.style.display = match ? "flex" : "none";
    });
  });
}

function initializeUserSpecificChannelsFeed(scope, listDOMId) {
  if (globalChannelsUnsub) globalChannelsUnsub();

  const collectionQueryRef = scope === "admin" 
    ? collection(db, "chats")
    : query(collection(db, "chats"), where("type", "==", "direct"), where("participantUids", "array-contains", activeUser.uid));

  globalChannelsUnsub = onSnapshot(collectionQueryRef, (snapshot) => {
    const listContainer = document.getElementById(listDOMId);
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const activeChannels = [];
    snapshot.forEach(docSnap => activeChannels.push({ id: docSnap.id, ...docSnap.data() }));
    activeChannels.sort((a, b) => getEpochTime(b.updatedAt) - getEpochTime(a.updatedAt));

    if (activeChannels.length === 0) {
      listContainer.innerHTML = `<div class="adnn-app-empty-slate-label">No active conversations connected.</div>`;
      return;
    }

    activeChannels.forEach(channel => {
      let title = channel.title || "Workspace dialogue thread";
      if (channel.type === "support") {
        title = `[Support] ${channel.clientName || channel.clientEmail}`;
      } else if (scope !== "admin") {
        const namesMap = channel.participantNames || {};
        const peerUid = channel.participantUids?.find(uid => uid !== activeUser.uid);
        if (peerUid && namesMap[peerUid]) title = namesMap[peerUid];
      }

      const counterValue = scope === "admin" ? Number(channel.unreadForAdmin || 0) : Number(channel.unreadForClient || 0);
      const rowItemButton = document.createElement("button");
      rowItemButton.type = "button";
      rowItemButton.className = `adnn-app-thread-item-row-btn ${channel.id === currentChatId ? "is-selected" : ""}`;
      rowItemButton.innerHTML = `
        <div class="adnn-app-row-avatar-node">${title.slice(0, 2).toUpperCase()}</div>
        <div class="adnn-app-row-content-details-block">
          <strong>${escapeHtmlString(title)}</strong>
          <p>${escapeHtmlString(channel.lastMessage || "Channel linked.")}</p>
        </div>
        ${counterValue > 0 ? `<span class="adnn-app-row-unread-count-badge">${counterValue}</span>` : ""}
      `;

      rowItemButton.addEventListener("click", () => {
        currentChatId = channel.id;
        currentChatType = channel.type;
        selectedChatCacheData = channel; 
        document.querySelectorAll(".adnn-app-thread-item-row-btn").forEach(b => b.classList.remove("is-selected"));
        rowItemButton.classList.add("is-selected");

        const targetRoomDOMId = scope === "admin" ? "adminRoomTarget" : "directRoomTarget";
        loadActiveRoomViewport(channel.type, targetRoomDOMId);
      });

      listContainer.appendChild(rowItemButton);
    });
  });
}

function loadActiveRoomViewport(type, targetContainerDOMId) {
  const targetNode = document.getElementById(targetContainerDOMId);
  if (!targetNode) return;

  targetNode.innerHTML = buildMessengerMarkupFrame(type);
  attachComposerInputInteractions(type);
  
  const updatePayload = {};
  if (type === "support") {
    updatePayload[isAdminEmail(activeUser.email) ? "unreadForAdmin" : "unreadForClient"] = 0;
  } else {
    updatePayload.unreadForAdmin = 0;
    updatePayload.unreadForClient = 0;
  }
  updateDoc(doc(db, "chats", currentChatId), updatePayload).catch(() => {});

  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  initializeLiveMessageSnapshotPipeline(currentChatId, prefix, type);
}

/* ==========================================================================
   DOM COMPONENT LAYOUT FACTORIES
   ========================================================================== */

function buildMessengerMarkupFrame(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  return `
    <div class="adnn-wa-messenger-shell-frame" id="${prefix}CoreShell">
      <div class="adnn-wa-header-action-bar">
        <button type="button" class="adnn-wa-mobile-back-nav-btn" id="${prefix}MobileBackBtn">&#8592;</button>
        <div class="adnn-wa-header-profile-block">
          <div class="adnn-wa-header-avatar-node" id="${prefix}HeaderAvatar">--</div>
          <div class="adnn-wa-header-text-details">
            <h4 id="${prefix}HeaderTitle">Connecting...</h4>
            <small id="${prefix}HeaderPresence"></small>
          </div>
        </div>
        <div class="adnn-wa-header-hardware-utilities">
          <button type="button" class="adnn-wa-util-btn" id="${prefix}AudioCallBtn" aria-label="Voice Call">${SVG_PHONE}</button>
          <button type="button" class="adnn-wa-util-btn" id="${prefix}VideoCallBtn" aria-label="Video Call">${SVG_VIDEO}</button>
        </div>
      </div>

      <div class="adnn-wa-messages-viewport-scroller" id="${prefix}Viewport">
        <div class="adnn-wa-loader">Synchronizing database threads...</div>
      </div>

      <div class="adnn-wa-composer-area-container">
        <div class="adnn-wa-fullscreen-upload-preview-panel" id="${prefix}UploadPanel" style="display: none;">
          <button type="button" class="adnn-wa-close-preview-btn" id="${prefix}CloseUploadPanelBtn">&times;</button>
          <div class="adnn-wa-preview-render-mount" id="${prefix}PreviewMount"></div>
          <span class="adnn-wa-preview-metadata-tag" id="${prefix}UploadMetadataTag"></span>
        </div>

        <div class="adnn-wa-quoted-reply-context-bar" id="${prefix}QuoteBar" style="display: none;">
          <div class="adnn-wa-quote-vertical-bar"></div>
          <div class="adnn-wa-quote-details-block">
            <strong id="${prefix}QuoteUser">User</strong>
            <p id="${prefix}QuoteText"></p>
          </div>
          <button type="button" class="adnn-wa-clear-quote-btn" id="${prefix}ClearQuoteContextBtn">&times;</button>
        </div>

        <div class="adnn-wa-voice-recording-metrics-status-bar" id="${prefix}VoiceMetricsBar" style="display: none;">
          <div class="adnn-wa-pulse-recording-dot"></div>
          <span id="${prefix}VoiceTimerLabel">00:00</span>
          <small>Recording audio note track...</small>
        </div>

        <form class="adnn-wa-composer-form-interface" id="${prefix}Form">
          <label class="adnn-wa-file-attachment-trigger-label" title="Attach assets files">
            <input type="file" id="${prefix}FileInput" accept="image/*,.pdf,.doc,.docx,.zip" style="display:none;">
            ${SVG_CLIP}
          </label>
          
          <div class="adnn-wa-input-wrapper-node">
            <input type="text" autocomplete="off" maxlength="1800" id="${prefix}TextInput" placeholder="Type a message...">
            <div class="adnn-wa-typing-indicator-dot-matrix" id="${prefix}TypingNode" style="display: none;">
              <span></span><span></span><span></span>
            </div>
          </div>

          <button type="button" class="adnn-wa-voice-record-action-btn" id="${prefix}VoiceBtn" title="Hold to record audio note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="adnn-wa-mic-icon-svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </button>
          
          <button type="submit" class="adnn-wa-submit-message-btn" id="${prefix}SendBtn" title="Send text packet">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

/* ==========================================================================
   REALTIME SYNCHRONIZATION PIPELINES MONITOR MAPPINGS
   ========================================================================== */

function initializeLiveMessageSnapshotPipeline(chatId, prefix, type) {
  if (!chatId) return;

  const titleNode = document.getElementById(`${prefix}HeaderTitle`);
  const avatarNode = document.getElementById(`${prefix}HeaderAvatar`);
  const presenceStatusNode = document.getElementById(`${prefix}HeaderPresence`);

  onSnapshot(doc(db, "chats", chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    selectedChatCacheData = data; 
    
    let titleStr = data.title || "Studio Secure Channel Thread";
    if (type === "support") {
      titleStr = isAdminEmail(activeUser.email) ? `Client: ${data.clientName || data.clientEmail}` : "AdnnStudio Master Support";
    } else {
      if (!isAdminEmail(activeUser.email)) {
        const localNamesMap = data.participantNames || {};
        const counterpeerUid = data.participantUids?.find(uid => uid !== activeUser.uid);
        if (counterpeerUid && localNamesMap[counterpeerUid]) titleStr = localNamesMap[counterpeerUid];
      }
    }

    if (titleNode) titleNode.textContent = titleStr;
    if (avatarNode) avatarNode.textContent = titleStr.slice(0, 2).toUpperCase();

    if (type === "support") {
      bindPresenceNodeRealtimeMonitor(isAdminEmail(activeUser.email) ? data.clientUid : ADMIN_ALIAS_UID, presenceStatusNode);
    } else {
      const counterpeerUid = data.participantUids?.find(uid => uid !== activeUser.uid);
      bindPresenceNodeRealtimeMonitor(counterpeerUid, presenceStatusNode);
    }
  });

  const queryRef = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(MSG_LIMIT));
  if (activeMessagesUnsub) activeMessagesUnsub();
  activeMessagesUnsub = onSnapshot(queryRef, (snapshot) => {
    const historicalPayload = [];
    snapshot.forEach(docSnap => historicalPayload.push({ id: docSnap.id, ...docSnap.data() }));
    renderConversationalMessageBubbles(historicalPayload, prefix, chatId);
    executeReadReceiptsMarkingLoop(chatId, type);
  });
}

/* ==========================================================================
   COMPOSER CONTROLLERS INTERACTION DRIVERS
   ========================================================================== */

function attachComposerInputInteractions(type) {
  const prefix = type === "support" ? "adnnSupport" : "adnnDirect";
  const formElement = document.getElementById(`${prefix}Form`);
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
    const gridFrame = document.querySelector(".adnn-app-layout-grid-frame");
    if (gridFrame) gridFrame.classList.remove("adnn-wa-mobile-room-open");
  });

  textInputNode?.addEventListener("input", () => {
    if (!currentChatId) return;
    setDoc(doc(db, "chats", currentChatId, "typing", activeUser.uid), {
      isTyping: textInputNode.value.length > 0, name: currentProfileCache?.name || "User", timestamp: Date.now()
    }, { merge: true });
  });

  onSnapshot(collection(db, "chats", currentChatId || "null", "typing"), (snapshot) => {
    let activeTypingFound = false;
    snapshot.forEach(docSnap => {
      if (docSnap.id !== activeUser.uid) {
        const data = docSnap.data();
        if (data.isTyping === true && (Date.now() - data.timestamp) < 4000) activeTypingFound = true;
      }
    });
    const typingNode = document.getElementById(`${prefix}TypingNode`);
    if (typingNode) typingNode.style.display = activeTypingFound ? "flex" : "none";
  });

  fileInputNode?.addEventListener("change", (event) => {
    const targetFile = event.target.files[0];
    if (!targetFile) return;
    stagedFileAttachment = targetFile;

    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    const previewMountNode = document.getElementById(`${prefix}PreviewMount`);
    const metadataTagNode = document.getElementById(`${prefix}UploadMetadataTag`);

    if (panelNode && previewMountNode && metadataTagNode) {
      panelNode.style.display = "flex";
      metadataTagNode.textContent = `${targetFile.name} (${(targetFile.size / (1024 * 1024)).toFixed(2)} MB)`;
      previewMountNode.innerHTML = targetFile.type.startsWith("image/")
        ? `<img src="${URL.createObjectURL(targetFile)}" class="adnn-wa-full-panel-img-preview" />`
        : `<div class="adnn-wa-doc-icon-fallback-box">📁<span>Document resource staged</span></div>`;
    }
  });

  closeUploadBtn?.addEventListener("click", () => {
    stagedFileAttachment = null;
    if (fileInputNode) fileInputNode.value = "";
    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    if (panelNode) panelNode.style.display = "none";
  });

  clearQuoteBtn?.addEventListener("click", () => {
    stagedQuotedParentId = null;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    if (quoteBarNode) quoteBarNode.style.display = "none";
  });

  // Attach proper operational event pointers for voice messaging capabilities
  voiceRecordBtn?.addEventListener("mousedown", () => startVoiceRecordingPipeline(prefix));
  voiceRecordBtn?.addEventListener("mouseup", () => executeVoiceNoteTerminationAndDispatch(prefix));
  voiceRecordBtn?.addEventListener("mouseleave", () => executeVoiceNoteTerminationAndDispatch(prefix, true));
  voiceRecordBtn?.addEventListener("touchstart", (e) => { e.preventDefault(); startVoiceRecordingPipeline(prefix); });
  voiceRecordBtn?.addEventListener("touchend", (e) => { e.preventDefault(); executeVoiceNoteTerminationAndDispatch(prefix); });

  formElement?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentChatId || !selectedChatCacheData) return;

    const textPayloadString = textInputNode.value.trim();
    if (!textPayloadString && !stagedFileAttachment) return;

    textInputNode.value = "";
    const activeFilePayload = stagedFileAttachment;
    stagedFileAttachment = null;
    const panelNode = document.getElementById(`${prefix}UploadPanel`);
    if (panelNode) panelNode.style.display = "none";

    const parentQuoteId = stagedQuotedParentId;
    stagedQuotedParentId = null;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    if (quoteBarNode) quoteBarNode.style.display = "none";

    try {
      let mediaUploadedObjectMap = {};
      if (activeFilePayload) {
        mediaUploadedObjectMap = await executeCloudStorageAssetUpload(activeFilePayload, currentChatId);
      }

      const completeMsgDocPayload = {
        text: textPayloadString,
        senderUid: activeUser.uid, // Satisfies rules line 39 requirement
        senderName: currentProfileCache?.name || activeUser.email,
        createdAt: serverTimestamp(),
        readBy: [activeUser.uid],
        ...mediaUploadedObjectMap
      };

      if (parentQuoteId) completeMsgDocPayload.replyToMessageId = parentQuoteId;

      await addDoc(collection(db, "chats", currentChatId, "messages"), completeMsgDocPayload);

      // Must construct mapping payloads that preserve security rules criteria variables 100% exactly
      const finalChannelStateUpdatePayload = {
        type: selectedChatCacheData.type || "direct",
        participantUids: selectedChatCacheData.participantUids, // Rule 37 lock verification match
        participantEmails: selectedChatCacheData.participantEmails, // Rule 37 lock verification match
        lastMessage: textPayloadString || (activeFilePayload ? "📎 Document asset delivery item" : "🎙️ Voice note dispatch"),
        lastSenderUid: activeUser.uid,
        updatedAt: serverTimestamp()
      };

      if (selectedChatCacheData.createdByAdminUid) {
        finalChannelStateUpdatePayload.createdByAdminUid = selectedChatCacheData.createdByAdminUid; // Rule 37 patch match criteria
      }
      if (selectedChatCacheData.clientUid) finalChannelStateUpdatePayload.clientUid = selectedChatCacheData.clientUid;
      if (selectedChatCacheData.clientEmail) finalChannelStateUpdatePayload.clientEmail = selectedChatCacheData.clientEmail;
      if (selectedChatCacheData.participantNames) finalChannelStateUpdatePayload.participantNames = selectedChatCacheData.participantNames;
      if (selectedChatCacheData.participantEmailMap) finalChannelStateUpdatePayload.participantEmailMap = selectedChatCacheData.participantEmailMap;

      if (type === "support") {
        if (isAdminEmail(activeUser.email)) {
          finalChannelStateUpdatePayload.unreadForClient = increment(1);
        } else {
          finalChannelStateUpdatePayload.unreadForAdmin = increment(1);
        }
      } else {
        finalChannelStateUpdatePayload.unreadForClient = increment(1);
        finalChannelStateUpdatePayload.unreadForAdmin = increment(1);
      }

      await setDoc(doc(db, "chats", currentChatId), finalChannelStateUpdatePayload, { merge: true });
      setDoc(doc(db, "chats", currentChatId, "typing", activeUser.uid), { isTyping: false }, { merge: true });

    } catch (err) {
      console.warn("Security transaction write blocked. Verify structural constraints parameters rules match mappings: ", err);
    }
  });

  window[`adnnTriggerReplyLink_${prefix}`] = function(messageId, senderName, textContentSummary) {
    stagedQuotedParentId = messageId;
    const quoteBarNode = document.getElementById(`${prefix}QuoteBar`);
    const quoteUserNode = document.getElementById(`${prefix}QuoteUser`);
    const quoteTextNode = document.getElementById(`${prefix}QuoteText`);

    if (quoteBarNode && quoteUserNode && quoteTextNode) {
      quoteBarNode.style.display = "grid";
      quoteUserNode.textContent = senderName;
      quoteTextNode.textContent = textContentSummary || "Shared multimedia deliverable folder link.";
    }
  };
}

/* ==========================================================================
   VIEWPORT COMPONENT BUILD HOOK RENDERING MATRIX
   ========================================================================== */

function renderConversationalMessageBubbles(messages, prefix, chatId) {
  const scrollerViewport = document.getElementById(`${prefix}Viewport`);
  if (!scrollerViewport) return;
  scrollerViewport.innerHTML = "";

  if (messages.length === 0) {
    scrollerViewport.innerHTML = `<div class="adnn-wa-empty-state">No historical dispatches found.</div>`;
    return;
  }

  messages.forEach(msg => {
    const isMine = msg.senderUid === activeUser.uid;
    const containerWrapperNode = document.createElement("div");
    containerWrapperNode.className = `adnn-wa-message-row-wrapper ${isMine ? "is-mine-row" : "is-peer-row"}`;

    const bubbleBlock = document.createElement("div");
    bubbleBlock.className = `adnn-wa-chat-bubble-node ${isMine ? "is-sender" : "is-receiver"}`;

    let replyContextMarkup = "";
    if (msg.replyToMessageId) {
      replyContextMarkup = `<div class="adnn-wa-bubble-quoted-parent-preview-box">Loading matching parent context...</div>`;
      resolveQuotedParentPreviewAsync(chatId, msg.replyToMessageId, bubbleBlock);
    }

    let embeddedMediaMarkup = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        embeddedMediaMarkup = `<img src="${msg.mediaUrl}" class="adnn-wa-bubble-embedded-img" onclick="window.open('${msg.mediaUrl}','_blank')" />`;
      } else if (msg.mediaType?.startsWith("audio/")) {
        embeddedMediaMarkup = `
          <div class="adnn-wa-bubble-voice-note-player-row">
            <audio src="${msg.mediaUrl}" controls class="adnn-wa-bubble-native-audio-node"></audio>
          </div>
        `;
      } else {
        embeddedMediaMarkup = `<a href="${msg.mediaUrl}" target="_blank" rel="noopener" class="adnn-wa-bubble-file-download-card">📁 Open Shared Deliverable Asset</a>`;
      }
    }

    let structuralTicksReceiptLine = "";
    if (isMine) {
      const activeReadersArray = msg.readBy || [];
      const hasCounterpartRead = activeReadersArray.length > 1;
      structuralTicksReceiptLine = `<span class="adnn-wa-receipt-tick-indicator ${hasCounterpartRead ? "is-read-blue" : ""}">&#10004;&#10004;</span>`;
    }

    const currentReactionsObjectMap = msg.reactions || {};
    let activeReactionsRowHTMLMarkup = "";
    if (Object.keys(currentReactionsObjectMap).length > 0) {
      activeReactionsRowHTMLMarkup = `<div class="adnn-wa-bubble-active-reactions-badge-line">`;
      Object.entries(currentReactionsObjectMap).forEach(([uid, characterSymbol]) => {
        activeReactionsRowHTMLMarkup += `<span>${characterSymbol}</span>`;
      });
      activeReactionsRowHTMLMarkup += `</div>`;
    }

    bubbleBlock.innerHTML = `
      ${replyContextMarkup}
      <div class="adnn-wa-bubble-sender-identity-label" ${isMine ? "hidden" : ""}>
        <strong>${escapeHtmlString(msg.senderName || "Studio Peer")}</strong>
      </div>
      ${embeddedMediaMarkup}
      ${msg.text ? `<p class="adnn-wa-bubble-text-paragraph-content">${escapeHtmlString(msg.text)}</p>` : ""}
      <div class="adnn-wa-bubble-metrics-footer-row">
        <span>${formatEpochTimestampToTimeString(msg.createdAt)}</span>
        ${structuralTicksReceiptLine}
      </div>
      ${activeReactionsRowHTMLMarkup}

      <div class="adnn-wa-bubble-hover-utilities-floating-menu" style="display: none;">
        <button type="button" class="adnn-wa-action-trigger-btn" data-intent="reply">Reply</button>
        <button type="button" class="adnn-wa-action-trigger-btn" data-intent="react" data-emote="&#128077;">&#128077;</button>
        <button type="button" class="adnn-wa-action-trigger-btn" data-intent="react" data-emote="&#10084;&#65039;">&#10084;&#65039;</button>
        <button type="button" class="adnn-wa-action-trigger-btn" data-intent="react" data-emote="&#128514;">&#128514;</button>
        ${isMine ? `<button type="button" class="adnn-wa-action-trigger-btn is-delete-action-label" data-intent="delete">Delete</button>` : ""}
      </div>
    `;

    // Secure unified click intercept handlers to manage layout selections flawlessly
    bubbleBlock.addEventListener("click", (event) => {
      const targetButton = event.target.closest(".adnn-wa-action-trigger-btn");
      const localMenuDOMContainer = bubbleBlock.querySelector(".adnn-wa-bubble-hover-utilities-floating-menu");
      if (!localMenuDOMContainer) return;

      if (targetButton) {
        event.stopPropagation();
        const intent = targetButton.dataset.intent;
        if (intent === "reply") {
          window[`adnnTriggerReplyLink_${prefix}`](msg.id, msg.senderName, msg.text);
        } else if (intent === "react") {
          executeReactionPayloadCommit(chatId, msg.id, targetButton.dataset.emote);
        } else if (intent === "delete") {
          dispatchMessageDeletionCycle(chatId, msg.id);
        }
        localMenuDOMContainer.style.display = "none";
        return;
      }

      const currentVisibilityStatus = localMenuDOMContainer.style.display === "flex";
      document.querySelectorAll(".adnn-wa-bubble-hover-utilities-floating-menu").forEach(menu => menu.style.display = "none");
      localMenuDOMContainer.style.display = currentVisibilityStatus ? "none" : "flex";
    });

    containerWrapperNode.appendChild(bubbleBlock);
    scrollerViewport.appendChild(containerWrapperNode);
  });

  scrollerViewport.scrollTop = scrollerViewport.scrollHeight;
  
  document.body.classList.add("adnn-wa-mobile-view-active");
  const layoutGridFrame = document.querySelector(".adnn-app-layout-grid-frame");
  if (layoutGridFrame) layoutGridFrame.classList.add("adnn-wa-mobile-room-open");
}

async function resolveQuotedParentPreviewAsync(chatId, parentMessageId, bubbleDOMNode) {
  try {
    const snapshotDocRef = await getDoc(doc(db, "chats", chatId, "messages", parentMessageId));
    if (snapshotDocRef.exists()) {
      const data = snapshotDocRef.data();
      const mountContainer = bubbleDOMNode.querySelector(".adnn-wa-bubble-quoted-parent-preview-box");
      if (mountContainer) {
        mountContainer.innerHTML = `
          <strong>${escapeHtmlString(data.senderName)}</strong>
          <p>${escapeHtmlString(data.text || "Multimedia production folder file attachment item.")}</p>
        `;
      }
    }
  } catch (err) {}
}

/* ==========================================================================
   WHATSAPP MEDIA PROCESSING ENGINE (VOICE HARDWARE ROUTING)
   ========================================================================== */

async function startVoiceRecordingPipeline(prefix) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  
  const voiceMetricsBar = document.getElementById(`${prefix}VoiceMetricsBar`);
  const voiceTimerLabel = document.getElementById(`${prefix}VoiceTimerLabel`);
  
  try {
    const audioCaptureStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micRecorderInstance = new MediaRecorder(audioCaptureStream);
    let memoryBuffersChunksArray = [];

    micRecorderInstance.ondataavailable = (event) => {
      if (event.data.size > 0) memoryBuffersChunksArray.push(event.data);
    };

    micRecorderInstance.onstop = async () => {
      if (voiceMetricsBar) voiceMetricsBar.style.display = "none";
      
      const audioBlobPayload = new Blob(memoryBuffersChunksArray, { type: "audio/ogg; codecs=opus" });
      const packagingBinaryFileObject = new File([audioBlobPayload], `voice_note_${Date.now()}.ogg`, { type: "audio/ogg" });
      
      audioCaptureStream.getTracks().forEach(track => track.stop());
      
      if (voiceElapsedSeconds > 1 && currentChatId) {
        const structuralUploadedStoragePayloadData = await executeCloudStorageAssetUpload(packagingBinaryFileObject, currentChatId);
        await addDoc(collection(db, "chats", currentChatId, "messages"), {
          senderUid: activeUser.uid, // Rule 40 check requirements satisfied
          senderName: currentProfileCache?.name || activeUser.email,
          createdAt: serverTimestamp(),
          readBy: [activeUser.uid],
          ...structuralUploadedStoragePayloadData
        });
      }
      voiceElapsedSeconds = 0;
    };

    if (voiceMetricsBar && voiceTimerLabel) {
      voiceTimerLabel.textContent = "00:00";
      voiceMetricsBar.style.display = "flex";
    }

    micRecorderInstance.start();
    voiceElapsedSeconds = 0;
    voiceRecordTimer = setInterval(() => {
      voiceElapsedSeconds++;
      const min = String(Math.floor(voiceElapsedSeconds / 60)).padStart(2, "0");
      const sec = String(voiceElapsedSeconds % 60).padStart(2, "0");
      if (voiceTimerLabel) voiceTimerLabel.textContent = `${min}:${sec}`;
    }, 1000);

  } catch (err) {
    console.error("Audio recording permission initialization failed: ", err);
  }
}

function executeVoiceNoteTerminationAndDispatch(prefix, invalidateAndDropTrack = false) {
  if (voiceRecordTimer) clearInterval(voiceRecordTimer);
  const voiceMetricsBar = document.getElementById(`${prefix}VoiceMetricsBar`);
  if (voiceMetricsBar) voiceMetricsBar.style.display = "none";

  if (!micRecorderInstance || micRecorderInstance.state === "inactive") return;
  if (invalidateAndDropTrack) voiceElapsedSeconds = 0;
  micRecorderInstance.stop();
}

async function executeCloudStorageAssetUpload(file, chatId) {
  if (!storage) throw new Error("Storage endpoints unlinked.");
  const cleanName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  const storageLocationPathRefStr = `wa-vault/${chatId}/${activeUser.uid}/${Date.now()}_${cleanName}`;
  const targetPointerRef = storageRef(storage, storageLocationPathRefStr);
  
  await uploadBytes(targetPointerRef, file);
  const publiclyAccessibleDownloadUrl = await getDownloadURL(targetPointerRef);

  return {
    mediaUrl: publiclyAccessibleDownloadUrl,
    mediaName: file.name,
    mediaType: file.type || "application/octet-stream",
    mediaStoragePath: storageLocationPathRefStr
  };
}

/* ==========================================================================
   TRANSACTION MODIFIERS (REACTIONS, READ RECEIPTS, MARKS)
   ========================================================================== */

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
   WEBRTC HARDWARE CALL ENGINE ENGINE (POLITE PEER MATRIX CORES)
   ========================================================================== */

function bindIncomingCallInterceptor(user) {
  const targetInboxId = isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid;
  onSnapshot(doc(db, "callInbox", targetInboxId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const inbox = snapshot.data();
    if (inbox.status !== "ringing" || !inbox.callId) return;

    const callDoc = await getDoc(doc(db, "calls", inbox.callId));
    if (!callDoc.exists()) return;
    const callData = callDoc.data();

    if (Date.now() > Number(callData.expiresAtMs || 0) || callData.status !== "ringing") {
      purgeSignalingTransactionTracesGarbage(inbox.callId, targetInboxId);
      return;
    }
    if (callData.callerUid !== targetInboxId) renderActiveIncomingCallOverlayStage(inbox.callId, callData);
  });
}

async function executeWebRTCHardwareCallInitialization(kind, chatType) {
  if (!navigator.mediaDevices || !RTCPeerConnection) return;
  const wantsVideo = kind === "video";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    const callId = `call_${Date.now()}_${activeUser.uid.slice(0, 4)}`;

    let receiverUidTarget = ADMIN_ALIAS_UID;
    let label = "AdnnStudio Support Portal";

    if (chatType === "direct") {
      const activeChatBaseSnapshot = await getDoc(doc(db, "chats", currentChatId));
      const dataset = activeChatBaseSnapshot.data();
      receiverUidTarget = dataset.participantUids?.find(uid => uid !== activeUser.uid);
      label = dataset.participantNames?.[receiverUidTarget] || "Workspace Peer";
    } else if (isAdminEmail(activeUser.email)) {
      const activeChatBaseSnapshot = await getDoc(doc(db, "chats", currentChatId));
      receiverUidTarget = activeChatBaseSnapshot.data().clientUid;
      label = activeChatBaseSnapshot.data().clientName || "Client Track";
    }

    liveCallSession = {
      callId, role: "caller", kind, isPolitePeer: false,
      localStream: stream, remoteStream: new MediaStream(), peerConnection: null, receiverUid: receiverUidTarget, chatId: currentChatId, label
    };

    renderActiveCallHardwareOverlayWindow();
    assembleWebRTCPeerConnectionPipeline(callId, wantsVideo);

    const offer = await liveCallSession.peerConnection.createOffer();
    await liveCallSession.peerConnection.setLocalDescription(offer);

    const expiresAtMs = Date.now() + CALL_RING_TIMEOUT_MS;
    await setDoc(doc(db, "calls", callId), {
      id: callId, chatId: currentChatId, status: "ringing", kind,
      callerUid: activeUser.uid, callerName: currentProfileCache?.name || activeUser.email,
      receiverUid: receiverUidTarget, offer: { type: offer.type, sdp: offer.sdp }, expiresAtMs, micMuted: false, cameraOn: wantsVideo,
      participants: [activeUser.uid, receiverUidTarget] // Explicit string sequence satisfying security rules index parameters criteria mapping locks line 16
    });

    await setDoc(doc(db, "callInbox", receiverUidTarget), { callId, status: "ringing", receiverUid: receiverUidTarget });
  } catch (err) {
    alert("Hardware communication streaming devices capture setup initialization parameters rejected.");
  }
}

function assembleWebRTCPeerConnectionPipeline(callId, wantsVideo) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
  });
  liveCallSession.peerConnection = pc;

  liveCallSession.localStream.getTracks().forEach(track => pc.addTrack(track, liveCallSession.localStream));

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const path = liveCallSession.role === "caller" ? "offerCandidates" : "answerCandidates";
    addDoc(collection(db, "calls", callId, path), e.candidate.toJSON());
  };

  pc.ontrack = (e) => {
    if (e.streams && e.streams[0]) {
      e.streams[0].getTracks().forEach(track => liveCallSession.remoteStream.addTrack(track));
    } else {
      liveCallSession.remoteStream.addTrack(e.track);
    }
    const remoteVid = document.getElementById("waRemoteVideoMount");
    if (remoteVid) remoteVid.srcObject = liveCallSession.remoteStream;
  };

  onSnapshot(doc(db, "calls", callId), async (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();

    if (data.status === "accepted" && pc.signalingState === "have-local-offer" && liveCallSession.role === "caller") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      engageViewportTimerCounterLine();
    }
    if (data.status === "ended") terminateWebRTCCallSessionContext(false);

    const remoteVid = document.getElementById("waRemoteVideoMount");
    if (remoteVid) remoteVid.style.opacity = data.cameraOn === false ? "0" : "1";
  });

  const targetsPath = liveCallSession.role === "caller" ? "answerCandidates" : "offerCandidates";
  onSnapshot(collection(db, "calls", callId, targetsPath), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
    });
  });
}

function renderActiveIncomingCallOverlayStage(callId, callData) {
  if (document.getElementById("waCallHardwareStageOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "waCallHardwareStageOverlay";
  overlay.className = "adnn-wa-webrtc-fullscreen-stage-overlay unified-flex-centering-utility";
  overlay.innerHTML = `
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
  document.body.appendChild(overlay);

  document.getElementById("waAcceptBtn")?.addEventListener("click", async () => {
    overlay.remove();
    try {
      const wantsVideo = callData.kind === "video";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });

      liveCallSession = {
        callId, role: "receiver", kind: callData.kind, isPolitePeer: true,
        localStream: stream, remoteStream: new MediaStream(), peerConnection: null,
        receiverUid: callData.callerUid, chatId: callData.chatId, label: callData.callerName
      };

      renderActiveCallHardwareOverlayWindow();
      assembleWebRTCPeerConnectionPipeline(callId, wantsVideo);

      await liveCallSession.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await liveCallSession.peerConnection.createAnswer();
      await liveCallSession.peerConnection.setLocalDescription(answer);

      await updateDoc(doc(db, "calls", callId), { status: "accepted", answer: { type: answer.type, sdp: answer.sdp } });
      await updateDoc(doc(db, "callInbox", isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid), { status: "accepted" });
      engageViewportTimerCounterLine();
    } catch (err) {
      executeTerminationSignalingCycle(callId);
    }
  });

  document.getElementById("waDeclineBtn")?.addEventListener("click", () => {
    overlay.remove();
    executeTerminationSignalingCycle(callId);
  });
}

function executeTerminationSignalingCycle(callId) {
  updateDoc(doc(db, "calls", callId), { status: "ended" }).catch(() => {});
  purgeSignalingTransactionTracesGarbage(callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
}

function renderActiveCallHardwareOverlayWindow() {
  if (document.getElementById("waCallHardwareStageOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "waCallHardwareStageOverlay";
  overlay.className = "adnn-wa-webrtc-fullscreen-stage-overlay unified-flex-centering-utility";
  overlay.innerHTML = `
    <div class="adnn-wa-webrtc-card-modal is-live-call-pane glass">
      <div class="adnn-wa-webrtc-video-tiles-grid-mesh">
        <video id="waRemoteVideoMount" autoplay playsinline class="adnn-wa-video-stream-node-frame is-remote-peer-track"></video>
        <video id="waLocalVideoMount" autoplay muted playsinline class="adnn-wa-video-stream-node-frame is-local-mirror-flipped"></video>
      </div>
      <div class="adnn-wa-webrtc-live-identity-row">
        <h3>${escapeHtmlString(liveCallSession.label)}</h3>
        <p id="waCallTimerLineText">Connecting operational channels links...</p>
      </div>
      <div class="adnn-wa-modal-controls-row">
        <button type="button" class="adnn-wa-ctrl-btn-node" id="waToggleMicBtn">${SVG_MIC}</button>
        <button type="button" class="adnn-wa-ctrl-btn-node" id="waToggleCamBtn">${SVG_VIDEO}</button>
        <button type="button" class="adnn-wa-ctrl-btn-node is-red-danger" id="waHangupBtn">${SVG_HANGUP}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const localVid = document.getElementById("waLocalVideoMount");
  if (localVid) localVid.srcObject = liveCallSession.localStream;

  document.getElementById("waToggleMicBtn")?.addEventListener("click", (e) => {
    const track = liveCallSession.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      e.currentTarget.innerHTML = track.enabled ? SVG_MIC : SVG_MIC_OFF;
      e.currentTarget.classList.toggle("is-deactivated-highlight", !track.enabled);
    }
  });

  document.getElementById("waToggleCamBtn")?.addEventListener("click", (e) => {
    const track = liveCallSession.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      e.currentTarget.innerHTML = track.enabled ? SVG_VIDEO : SVG_VIDEO_OFF;
      e.currentTarget.classList.toggle("is-deactivated-highlight", !track.enabled);
      localVid.style.opacity = track.enabled ? "1" : "0";
    }
  });

  document.getElementById("waHangupBtn")?.addEventListener("click", () => terminateWebRTCCallSessionContext(true));
}

function engageViewportTimerCounterLine() {
  let value = 0;
  const timer = document.getElementById("waCallTimerLineText");
  setInterval(() => {
    value++;
    const min = String(Math.floor(value / 60)).padStart(2, "0");
    const sec = String(Math.floor(value % 60)).padStart(2, "0");
    if (timer) timer.textContent = `${min}:${sec}`;
  }, 1000);
}

function terminateWebRTCCallSessionContext(explicitlyTriggeredByLocalPeer = true) {
  if (!liveCallSession) return;
  if (explicitlyTriggeredByLocalPeer) updateDoc(doc(db, "calls", liveCallSession.callId), { status: "ended" }).catch(() => {});
  if (liveCallSession.localStream) liveCallSession.localStream.getTracks().forEach(t => t.stop());
  if (liveCallSession.peerConnection) liveCallSession.peerConnection.close();
  purgeSignalingTransactionTracesGarbage(liveCallSession.callId, isAdminEmail(activeUser.email) ? ADMIN_ALIAS_UID : activeUser.uid);
  document.getElementById("waCallHardwareStageOverlay")?.remove();
  liveCallSession = null;
}

async function purgeSignalingTransactionTracesGarbage(callId, targetInboxId) {
  setTimeout(async () => {
    await deleteDoc(doc(db, "callInbox", targetInboxId)).catch(() => {});
    await deleteDoc(doc(db, "calls", callId)).catch(() => {});
  }, CALL_SIGNAL_CLEANUP_DELAY_MS);
}

/* ==========================================================================
   SYSTEM PRESENCE CONFIGURATION UTILITIES
   ========================================================================== */

function bindPresenceNodeRealtimeMonitor(uid, targetDOMElement) {
  if (!uid || !targetDOMElement) return;
  onSnapshot(doc(db, "presence", uid), (snapshot) => {
    if (!snapshot.exists()) {
      targetDOMElement.style.display = "none";
      return;
    }
    const data = snapshot.data();
    const liveOnline = data.online === true && (Date.now() - getEpochTime(data.lastSeen)) < 75000;
    
    // Hide system backend baseline strings entirely from active templates per instructions
    targetDOMElement.textContent = liveOnline ? "online" : "";
    targetDOMElement.style.display = liveOnline ? "inline-block" : "none";
  });
}

function initializePresencePing(user) {
  const ref = doc(db, "presence", isAdminEmail(user.email) ? ADMIN_ALIAS_UID : user.uid);
  const write = () => setDoc(ref, { online: true, lastSeen: serverTimestamp() }, { merge: true });
  write();
  setInterval(write, 35000);
  window.addEventListener("beforeunload", () => setDoc(ref, { online: false, lastSeen: serverTimestamp() }, { merge: true }));
}

function disconnectEcosystemListeners() {
  if (globalChannelsUnsub) globalChannelsUnsub();
  if (activeMessagesUnsub) activeMessagesUnsub();
}

async function extractProfileInformation(uid, email) {
  const clientDoc = await getDoc(doc(db, "clients", uid)).catch(() => null);
  if (clientDoc?.exists()) return { uid, role: "client", ...clientDoc.data() };
  const designerDoc = await getDoc(doc(db, "designers", uid)).catch(() => null);
  if (designerDoc?.exists()) return { uid, role: "designer", ...designerDoc.data() };
  return { uid, email, role: isAdminEmail(email) ? "admin" : "client", name: email.split("@")[0] };
}

function getEpochTime(timestamp) {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  return new Date(timestamp).getTime();
}

function formatEpochTimestampToTimeString(timestamp) {
  if (!timestamp) return "Just now";
  return new Date(getEpochTime(timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtmlString(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

/* ==========================================================================
   PORTAL INTERACTIVE WORKSPACE SYSTEM LOOK SPECIFICATIONS
   ========================================================================== */

function injectScopedWorkspaceStyles() {
  if (document.getElementById("adnnWaIsolatedStyleBlock")) return;
  const element = document.createElement("style");
  element.id = "adnnWaIsolatedStyleBlock";
  element.textContent = `
    .adnn-app-wrapper { width: 100%; height: 100%; display: block; position: relative; }
    .adnn-app-layout-grid-frame { display: grid; grid-template-columns: 280px 1fr; height: min(600px, calc(100svh - 220px)); background: linear-gradient(135deg, #0d0d11 0%, #050507 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden; }
    .adnn-app-layout-grid-frame.is-standalone-mode { grid-template-columns: 1fr !important; }
    .adnn-app-sidebar-pane { background: rgba(20,20,28,0.3); border-right: 1px solid rgba(255,255,255,0.08); display: grid; grid-template-rows: 56px 1fr; }
    .adnn-app-sidebar-header-line { padding: 0 16px; display: flex; align-items: center; font-size: 15px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .adnn-app-sidebar-search-input-row { padding: 8px 12px; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .adnn-app-sidebar-search-input-row input { height: 34px; width:100%; background:#000 !important; border:1px solid rgba(255,255,255,0.08) !important; border-radius:10px; color:#fff !important; padding:0 12px; font-size:13px; outline: none; }
    .adnn-app-threads-vertical-stack { overflow-y: auto; padding: 6px; }
    .adnn-app-thread-item-row-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: transparent; border: 0; text-align: left; cursor: pointer; margin-bottom: 2px; }
    .adnn-app-thread-item-row-btn:hover, .adnn-app-thread-item-row-btn.is-selected { background: rgba(39,45,207,0.14); }
    .adnn-app-row-avatar-node { width: 36px; height: 36px; border-radius: 50%; background: #272dcf; display: grid; place-items: center; font-size: 11px; font-weight: 500; color: #fff; }
    .adnn-app-row-content-details-block { flex: 1; min-width: 0; }
    .adnn-app-row-content-details-block strong { display: block; font-size: 13.5px; color: #fff; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adnn-app-row-content-details-block p { margin: 0; font-size: 11.5px; color: rgba(255,255,255,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adnn-app-row-unread-count-badge { background: #ff2602; color: #fff; font-size: 9px; padding: 1px 5px; border-radius: 8px; }
    .adnn-app-chat-room-pane { position: relative; background: rgba(0,0,0,0.05); height: 100%; }
    .adnn-app-chat-room-pane .adnn-wa-messenger-shell-frame { height: 100% !important; border: 0 !important; border-radius: 0 !important; }

    .adnn-wa-messenger-shell-frame { display: grid; grid-template-rows: 64px 1fr auto; height: 100%; background: transparent; position: relative; }
    .adnn-wa-header-action-bar { height: 64px; background: rgba(15,15,20,0.4); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
    .adnn-wa-mobile-back-nav-btn { display: none; background: transparent; border: 0; color: #fff; font-size: 22px; cursor: pointer; margin-right: 4px; }
    .adnn-wa-header-profile-block { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .adnn-wa-header-avatar-node { width: 36px; height: 36px; border-radius: 50%; background: #272dcf; display: grid; place-items: center; font-size: 11px; font-weight: 500; color: #fff; }
    .adnn-wa-header-text-details { min-width: 0; }
    .adnn-wa-header-text-details h4 { margin: 0; font-size: 14px; font-weight: 500; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adnn-wa-header-text-details small { font-size: 11px; display: block; margin-top: 1px; }
    .adnn-wa-header-hardware-utilities { display: flex; align-items: center; gap: 6px; }
    .adnn-wa-util-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.04); border: 0; color: #fff; display: grid; place-items: center; cursor: pointer; }
    .adnn-wa-util-btn svg { width: 16px; height: 16px; }
    .adnn-wa-messages-viewport-scroller { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .adnn-wa-message-row-wrapper { width: 100%; display: flex; }
    .is-mine-row { justify-content: flex-end; }
    .is-peer-row { justify-content: flex-start; }
    .adnn-wa-chat-bubble-node { max-width: 70%; padding: 10px 12px; border-radius: 14px; position: relative; color: #fff; font-size: 14px; line-height: 1.45; }
    .is-sender { background: linear-gradient(135deg, #272dcf 0%, #151991 100%); border-top-right-radius: 2px; }
    .is-receiver { background: rgba(255,255,255,0.05); border-top-left-radius: 2px; border: 1px solid rgba(255,255,255,0.04); }
    .adnn-wa-bubble-sender-identity-label strong { font-size: 11px; color: #8d96ff; display: block; margin-bottom: 3px; font-family: monospace; }
    .adnn-wa-bubble-text-paragraph-content { margin: 0; word-break: break-word; }
    .adnn-wa-bubble-metrics-footer-row { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; font-size: 10px; color: rgba(255,255,255,0.4); font-family: monospace; }
    .adnn-wa-receipt-tick-indicator { font-size: 11px; color: rgba(255,255,255,0.25); }
    .is-read-blue { color: #34b7f1 !important; }
    
    /* Hover Utilities Floating Menu Structure fixing interactions dropdowns collision loops */
    .adnn-wa-bubble-hover-utilities-floating-menu { position: absolute; bottom: calc(100% + 4px); right: 0; background: #0c0c10; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 4px; display: none; gap: 4px; z-index: 999; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    .adnn-wa-bubble-hover-utilities-floating-menu button { background: rgba(255,255,255,0.06); border: 0; color: #fff; font-size: 11px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .adnn-wa-bubble-hover-utilities-floating-menu button:hover { background: #272dcf; color:#fff; }

    .adnn-wa-bubble-embedded-img { max-width: 100%; max-height: 200px; border-radius: 10px; object-fit: cover; margin-bottom: 3px; }
    .adnn-wa-bubble-file-download-card { display: flex; align-items: center; gap: 8px; color: #8d96ff; text-decoration: none; font-size: 12px; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 8px; }
    .adnn-wa-bubble-native-audio-node { height: 32px; max-width: 190px; }
    .adnn-wa-bubble-active-reactions-badge-line { position: absolute; bottom: -8px; right: 10px; background: #0c0c10; border: 1px solid rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 8px; display: flex; gap: 1px; font-size: 9.5px; }

    .adnn-wa-composer-area-container { border-top: 1px solid rgba(255,255,255,0.06); padding: 10px; background: rgba(8,8,12,0.7); position: relative; }
    .adnn-wa-composer-form-interface { display: flex; align-items: center; gap: 10px; }
    .adnn-wa-file-attachment-trigger-label { color: rgba(255,255,255,0.5); cursor: pointer; display: grid; place-items: center; }
    .adnn-wa-file-attachment-trigger-label svg { width: 19px; height: 19px; }
    .adnn-wa-input-wrapper-node { flex: 1; position: relative; display: flex; align-items: center; }
    .adnn-wa-input-wrapper-node input { height: 40px; width: 100%; border-radius: 20px; background: #000000 !important; border: 1px solid rgba(255,255,255,0.08) !important; padding: 0 36px 0 14px; color: #fff !important; font-size: 14px; outline: none; }
    .adnn-wa-typing-indicator-dot-matrix { position: absolute; right: 12px; display: flex; gap: 2px; }
    .adnn-wa-typing-indicator-dot-matrix span { width: 4px; height: 4px; background: #272dcf; border-radius: 50%; animation: waDots 1.4s infinite both; }

    .adnn-wa-voice-record-action-btn, .adnn-wa-submit-message-btn { width: 40px; height: 40px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; color: #fff; }
    .adnn-wa-voice-record-action-btn { background: rgba(255,255,255,0.03); }
    .adnn-wa-submit-message-btn { background: #272dcf; }
    .adnn-wa-submit-message-btn svg, .adnn-wa-voice-record-action-btn svg { width: 15px; height: 15px; }

    .adnn-wa-fullscreen-upload-preview-panel { position: absolute; bottom: 100%; left: 0; right: 0; height: 220px; background: #06060a; border-top: 1px solid rgba(255,255,255,0.08); z-index: 100; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
    .adnn-wa-preview-render-mount { max-width: 100%; max-height: 150px; overflow: hidden; border-radius: 6px; }
    .adnn-wa-full-panel-img-preview { max-width: 100%; max-height: 150px; object-fit: contain; }
    .adnn-wa-preview-metadata-tag { font-size: 11px; color: rgba(255,255,255,0.45); font-family: monospace; }
    .adnn-wa-quoted-reply-context-bar { display: grid; grid-template-columns: 3px 1fr auto; gap: 8px; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .adnn-wa-quote-vertical-bar { background: #272dcf; }
    .adnn-wa-quote-details-block strong { font-size: 11.5px; color: #8d96ff; display: block; }
    .adnn-wa-quote-details-block p { margin: 0; font-size: 10.5px; color: rgba(255,255,255,0.4); }
    .adnn-wa-bubble-quoted-parent-preview-box { background: rgba(0,0,0,0.15); border-left: 3px solid #8d96ff; padding: 4px 6px; border-radius: 4px; margin-bottom: 4px; font-size: 11.5px; }
    .adnn-wa-bubble-quoted-parent-preview-box strong { color: #8d96ff; display: block; }
    .adnn-wa-bubble-quoted-parent-preview-box p { margin: 0; opacity: 0.7; }
    
    /* Premium voice message pulse styling markers */
    .adnn-wa-voice-recording-metrics-status-bar { display: flex; align-items: center; gap: 10px; background: rgba(255, 38, 2, 0.08); border: 1px solid rgba(255, 38, 2, 0.2); border-radius: 12px; padding: 8px 14px; margin-bottom: 8px; animation: pulseRecordFade 0.3s ease; }
    .adnn-wa-pulse-recording-dot { width: 8px; height: 8px; background: #ff2602; border-radius: 50%; animation: pulseTarget 1.2s infinite ease-in-out; }
    .adnn-wa-voice-recording-metrics-status-bar span { font-family: monospace; font-size: 13px; color: #fff; font-weight: 500; }
    .adnn-wa-voice-recording-metrics-status-bar small { color: rgba(255,255,255,0.5); }
    @keyframes pulseTarget { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

    .adnn-app-placeholder-screen-view { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 30px; color: rgba(255,255,255,0.35); }
    .adnn-app-placeholder-avatar-logo { width: 52px; height: 52px; border-radius: 16px; background: rgba(39,45,207,0.1); color: #272dcf; font-size: 20px; display: grid; place-items: center; margin-bottom: 12px; }
    .adnn-app-placeholder-screen-view h3 { margin: 0 0 4px; color: #fff; font-weight: 400; font-size: 16px; }
    .adnn-app-placeholder-screen-view p { margin: 0; font-size: 13px; max-width: 280px; line-height: 1.5; }

    /* WebRTC Video Overlay Layers */
    .adnn-wa-webrtc-fullscreen-stage-overlay { position: fixed; inset: 0; background: rgba(3,3,5,0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); z-index: 999999; }
    .adnn-wa-webrtc-card-modal { width: min(400px, calc(100vw - 24px)); background: #09090d; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 20px; text-align: center; color: #fff; }
    .adnn-wa-modal-avatar-wrapper { width: 64px; height: 64px; border-radius: 16px; background: #272dcf; margin: 0 auto 14px; display: grid; place-items: center; font-size: 20px; color: #fff; }
    .adnn-wa-webrtc-card-modal h2 { margin: 0 0 4px; font-size: 18px; }
    .adnn-wa-webrtc-card-modal p { margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.4); font-family: monospace; }
    .adnn-wa-modal-controls-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .adnn-wa-ctrl-btn-node { width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.05); color: #fff; display: grid; place-items: center; cursor: pointer; }
    .is-green-success { background: #25d366 !important; }
    .is-red-danger { background: #ff3b30 !important; }
    .is-deactivated-highlight { background: #ff2602 !important; }
    .is-live-call-pane { width: min(640px, calc(100vw - 20px)) !important; padding: 12px !important; }
    .adnn-wa-webrtc-video-tiles-grid-mesh { width: 100%; aspect-ratio: 16/10; background: #000; border-radius: 14px; overflow: hidden; margin-bottom: 12px; position: relative; }
    .adnn-wa-video-stream-node-frame { width: 100%; height: 100%; object-fit: cover; }
    .is-local-mirror-flipped { position: absolute; bottom: 10px; right: 10px; width: 22%; aspect-ratio: 3/4; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); transform: scaleX(-1); }
    .adnn-wa-webrtc-live-identity-row { text-align: left; margin-bottom: 12px; }
    .adnn-wa-webrtc-live-identity-row h3 { margin: 0 0 2px; font-size: 15px; }
    .adnn-wa-webrtc-live-identity-row p { margin: 0; font-size: 11.5px; }

    /* Complete Standalone App Adaptive Viewport Mappings */
    @media (max-width: 760px) {
      body.adnn-wa-mobile-view-active { overflow: hidden !important; position: fixed !important; width: 100vw !important; height: 100svh !important; }
      .adnn-app-layout-grid-frame { grid-template-columns: 1fr !important; height: 100svh !important; position: fixed !important; inset: 0 !important; z-index: 2147483300 !important; border: 0 !important; border-radius: 0 !important; }
      .adnn-app-layout-grid-frame .adnn-app-chat-room-pane { display: none; }
      .adnn-app-layout-grid-frame.adnn-wa-mobile-room-open .adnn-app-sidebar-pane { display: none !important; }
      .adnn-app-layout-grid-frame.adnn-wa-mobile-room-open .adnn-app-chat-room-pane { display: block !important; width: 100vw !important; height: 100svh !important; }
      
      .adnn-wa-messenger-shell-frame { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100svh !important; z-index: 2147483400 !important; border: 0 !important; border-radius: 0 !important; background: #040406 !important; display: grid !important; grid-template-rows: 56px 1fr auto !important; }
      .adnn-wa-mobile-back-nav-btn { display: block !important; }
      .adnn-wa-chat-bubble-node { max-width: 82% !important; }
    }
  `;
  document.head.appendChild(element);
}
