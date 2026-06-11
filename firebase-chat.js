/**
 * ============================================================================
 * FIRESTORE-CHAT.JS (PRO-TIER V2)
 * Re-Architected for Strict Admin-Support Isolation & Authorized User Chats
 * Inspired by Apple Tahoe Elegance & Advanced Responsive Engineering
 * ============================================================================
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, where, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global Platform Directives
const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const MSG_LIMIT = 100;

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

// Premium Apple Tahoe Styled SVG Icons
const ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><path d="M16 5l4 4-4 4"/></svg>`,
  videoOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h5a2 2 0 0 1 2 2v3m4-1.8l3-3v11l-3-3M1 1l22 22"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v11a4 4 0 0 0 4-4V5a4 4 0 0 0-4-4z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 11a5 5 0 0 1-2.54 4.34M12 19v4M8 23h8"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  speakerOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  hold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  checkDouble: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;"><path d="M17 5L9.5 12.5L6 9M22 5l-7.5 7.5M13 17l-1.5-1.5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
};

// Global Context Orchestration States
let currentUser = null;
let activeChatId = "";
let currentActiveChat = null;
let activeCallState = null;

let unsubscribedChatMeta = null;
let unsubscribedMessageFeed = null;
let unsubscribedPresenceMeta = null;
let unsubscribedCallInbox = null;

let currentReplyContext = null;
let currentMediaUploadPayload = null;
let currentAudioRecorderInstance = null;
let audioRecordingPlaybackBlob = null;
let audioRecordingChronometer = null;
let activeSearchQueryFilter = "";
let inlineComposerCameraStream = null;

const audioNotificationAlert = new Audio("Message%20Notification.wav");
audioNotificationAlert.volume = 0.35;
const audioRingerLoop = new Audio("call ringer_01.mp3");
audioRingerLoop.loop = true;

/**
 * Platform Initialization
 */
if (auth && db) {
  injectStylesheetRules();
  bootstrapDOMContainers();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    toggleChatComponentTriggerVisibility(user);

    if (!user) {
      terminateAllActiveSubscribers();
      return;
    }

    initializePresenceEngine(user);
    initializeCallInboxEngine(user);

    // Context Evaluation: Detect Workspace Mode
    if (location.pathname.includes("admin.html") && isPlatformAdministrator(user.email)) {
      initializeAdminWorkspace();
    } else {
      initializeUserWorkspace(user);
    }
  });
}

/**
 * Build Interface Containers (Prevents Layout Cropping)
 */
function bootstrapDOMContainers() {
  if (document.getElementById("adnnPremiumChatOverlayPanel")) return;

  // Track real height properties dynamically to protect against mobile OS chrome address bar resize bugs
  const synchronizeViewportHeightProperty = () => {
    document.documentElement.style.setProperty('--adnn-chat-vh', `${window.innerHeight}px`);
  };
  window.addEventListener('resize', synchronizeViewportHeightProperty);
  window.addEventListener('orientationchange', synchronizeViewportHeightProperty);
  synchronizeViewportHeightProperty();

  const overlayShell = document.createElement("div");
  overlayShell.id = "adnnPremiumChatOverlayPanel";
  overlayShell.className = "adnn-chat-overlay-immersive hidden";
  overlayShell.innerHTML = `
    <div class="adnn-chat-window-container glass edge">
      <aside class="adnn-chat-sidebar-wrapper" id="adnnChatSidebarWrapper">
        <header class="adnn-sidebar-identity-header">
          <div class="adnn-identity-profile-info">
            <div class="adnn-identity-avatar-placeholder" id="adnnOwnAvatarPlaceholder">U</div>
            <div>
              <h4 id="adnnOwnProfileName">Conversations</h4>
              <p class="online-pill-indicator">Secure Sandbox Active</p>
            </div>
          </div>
          <button type="button" class="adnn-close-overlay-btn" id="adnnCloseImmersiveOverlayBtn">${ICONS.close}</button>
        </header>
        
        <div class="adnn-sidebar-search-container" id="adnnSidebarSearchContainer">
          <div class="adnn-search-input-group">
            <span class="search-icon-span">${ICONS.search}</span>
            <input type="text" id="adnnChatFilterSearchInput" placeholder="Search authorized streams...">
          </div>
        </div>
        
        <div class="adnn-sidebar-conversations-list" id="adnnMasterChatsListContainer">
          <div class="empty-list-notice">Waiting for secure initialization link channels...</div>
        </div>
      </aside>
      
      <main class="adnn-chat-main-room-view" id="adnnMainRoomWindow">
        <div class="empty-room-fallback-illustration" id="adnnEmptyRoomFallbackContainer">
          <div class="illustration-art-logo">✦</div>
          <h3>AdnnStudio Core Connected</h3>
          <p>Please select an active conversational workspace line from your control column menu track matrix mapping paths.</p>
        </div>
        
        <div class="adnn-active-room-layout hidden" id="adnnActiveRoomLayoutContainer">
          <header class="adnn-room-appbar-header">
            <button type="button" class="adnn-back-arrow-mobile-btn" id="adnnRoomBackArrowMobileBtn">${ICONS.back}</button>
            <div class="adnn-room-meta-target-info">
              <div class="adnn-target-avatar-placeholder" id="adnnRoomTargetAvatar">C</div>
              <div>
                <h4 id="adnnRoomTargetTitle">Connecting Node...</h4>
                <p id="adnnRoomTargetSubtitle">Verifying end-point handshake parameters</p>
              </div>
            </div>
            <div class="adnn-room-actions-header-group">
              <button type="button" class="adnn-call-trigger-btn" data-call-type="audio" title="Start real-time secure audio call connection stream line track">${ICONS.phone}</button>
              <button type="button" class="adnn-call-trigger-btn" data-call-type="video" title="Start high definition WebRTC multi-surface video view matrix">${ICONS.video}</button>
            </div>
          </header>
          
          <div class="adnn-chat-messages-scroll-area" id="adnnRoomMessagesScroller"></div>
          
          <div class="adnn-drag-drop-full-box-overlay hidden" id="adnnDragDropFullBoxOverlay">
            <div class="drag-drop-card-view">
              <div class="drag-icon-announcement">✦</div>
              <h3>Drop structural media asset package</h3>
              <p>Files verified instantly under secure cloud storage frameworks guidelines rules.</p>
            </div>
          </div>
          
          <footer class="adnn-chat-footer-composer-wrapper">
            <div class="adnn-reply-context-banner-preview hidden" id="adnnReplyContextBannerPreview">
              <div class="reply-vertical-accent-line"></div>
              <div class="reply-context-body-content">
                <strong id="adnnReplyContextAuthorName">Author</strong>
                <p id="adnnReplyContextBodySnippet">Message body text parameters mapping context segment</p>
              </div>
              <button type="button" class="adnn-cancel-reply-context-btn" id="adnnCancelReplyContextBtn">${ICONS.close}</button>
            </div>
            
            <div class="adnn-composer-inline-media-preview-container hidden" id="adnnComposerInlineMediaPreviewContainer">
              <div class="media-preview-card-frame">
                <div class="media-render-target-box" id="adnnComposerMediaRenderTargetBox"></div>
                <button type="button" class="adnn-remove-attached-media-btn" id="adnnRemoveAttachedMediaBtn">${ICONS.close}</button>
              </div>
            </div>
            
            <div class="adnn-composer-integrated-camera-mirror-box hidden" id="adnnComposerIntegratedCameraMirrorBox">
              <video id="adnnComposerInlineCameraTrackView" autoplay playsinline class="mirror-corrected-stream"></video>
              <div class="camera-mirror-controls-bar">
                <button type="button" class="camera-action-circle-btn" id="adnnCameraComposerCaptureBtn" title="Execute Capture Segment Node Frame Block Specification"></button>
                <button type="button" class="camera-action-close-btn" id="adnnCameraComposerCloseBtn">${ICONS.close}</button>
              </div>
            </div>
            
            <form class="adnn-master-composer-core-form" id="adnnMasterComposerCoreForm" autocomplete="off">
              <label class="composer-action-icon-trigger-label" title="Attach multi-media asset package document bundles">
                <input type="file" id="adnnComposerFileInput" accept="image/*,.pdf,.doc,.docx,.zip" class="hidden">
                ${ICONS.paperclip}
              </label>
              
              <button type="button" class="composer-action-icon-trigger-btn" id="adnnComposerCameraInlineToggleBtn" title="Open integrated composition video capture lens framework">${ICONS.camera}</button>
              
              <div class="composer-input-field-workspace-box">
                <input type="text" id="adnnComposerTextInput" maxlength="1800" placeholder="Type a message...">
                
                <div class="adnn-voice-recording-view-component-layer hidden" id="adnnVoiceRecordingViewComponentLayer">
                  <span class="live-blink-pulse-dot"></span>
                  <span class="voice-duration-chronometer" id="adnnVoiceDurationChronometer">00:00</span>
                  <div class="voice-wave-canvas-visualization-simulation">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                </div>
              </div>
              
              <div class="composer-action-execution-context-matrix-box">
                <button type="button" class="composer-action-icon-trigger-btn" id="adnnVoiceRecordActionTriggerBtn" title="Hold to execute audio clip recordings package payload layers options"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.2 6 6.6V21h2v-3.4c3.28-.4 6-3.18 6-6.6h-1.7z"/></svg></button>
                <button type="submit" class="composer-submit-execution-action-btn hidden" id="adnnComposerSubmitExecutionActionBtn" title="Transmit Completed Data Segment Block Object Document Payload Record Path">${ICONS.send}</button>
              </div>
            </form>
          </footer>
        </div>
      </main>
    </div>
  `;

  // Dynamic DOM Placement Logic: Handle both explicit split components or standard layout overlays
  const clientMountContainer = document.getElementById("clientChatMount");
  const designerMountContainer = document.getElementById("directChatMount") || document.getElementById("chat");
  const adminMountContainer = document.getElementById("chats_view");

  if (adminMountContainer) {
    overlayShell.className = "adnn-chat-embedded-container-context-frame admin-view-override";
    adminMountContainer.appendChild(overlayShell);
  } else if (clientMountContainer) {
    // Isolated client space configuration bounds targeting layout frameworks blocks logic specifications
    overlayShell.className = "adnn-chat-embedded-container-context-frame client-support-view-only";
    clientMountContainer.appendChild(overlayShell);
  } else if (designerMountContainer) {
    overlayShell.className = "adnn-chat-embedded-container-context-frame user-chats-view-only";
    designerMountContainer.appendChild(overlayShell);
  } else {
    // Safe dynamic application overlay window integration base pipeline layer element components paths
    overlayShell.className = "adnn-chat-overlay-immersive hidden";
    document.body.appendChild(overlayShell);
    const triggerBtn = document.getElementById("adnnPremiumChatTrigger");
    if (triggerBtn) triggerBtn.classList.remove("hidden");
  }

  wireImmersiveCoreComponentInteractions();
}

/**
 * Handle Workspace Core Workspace Operations Layout Settings 
 */
function initializeAdminWorkspace() {
  document.getElementById("adnnOwnAvatarPlaceholder").textContent = "👑";
  document.getElementById("adnnOwnProfileName").textContent = "Admin Management Console";
  document.getElementById("adnnChatSidebarWrapper").classList.remove("hidden-structural-sidebar-forced-override-style-class-modifier");

  clearInterval(unsubscribedChatMeta);
  unsubscribedChatMeta = onSnapshot(collection(db, "chats"), (snapshot) => {
    const chatsData = [];
    snapshot.forEach(docSnap => {
      chatsData.push({ id: docSnap.id, ...docSnap.data() });
    });
    chatsData.sort((a, b) => transformTimestampMetricToMillis(b.updatedAt) - transformTimestampMetricToMillis(a.updatedAt));
    window.adnnCachedChatsArray = chatsData;
    executeGlobalClientChatCollectionRepaint();
  });
}

async function initializeUserWorkspace(user) {
  const isEmbeddedSupportOnlyViewBoxContainerContext = document.getElementById("clientChatMount") !== null;
  const isUserChatsSectionContainerActiveSlotFrame = document.getElementById("directChatMount") !== null || (location.hash === "#chat" || location.pathname.includes("designer-account.html"));

  clearInterval(unsubscribedChatMeta);

  if (isEmbeddedSupportOnlyViewBoxContainerContext) {
    /**
     * RULE 1: STRICT 1-ON-1 ISOLATED ADMIN SUPPORT DESK LINE ONLY
     */
    const supportChatIdStringLocatorKeyAddress = `support_${user.uid}`;
    document.getElementById("adnnOwnAvatarPlaceholder").textContent = "🛡️";
    document.getElementById("adnnOwnProfileName").textContent = "AdnnStudio Management Support";
    
    // Hide Left Navigation Columns completely since this is an isolated direct link pipeline context window
    document.getElementById("adnnChatSidebarWrapper").classList.add("hidden-structural-sidebar-forced-override-style-class-modifier");

    // Enforce active documentation baseline document registration parameters mapping space grid path channels context fields window locations bounds layout space framework
    const verificationDocumentRecordPayloadInstanceMap = {
      type: "support",
      clientUid: user.uid,
      clientEmail: emailNormalizationKey(user.email),
      clientName: user.displayName || user.email || "Client Station Node User Connection Profile Profile Instance",
      adminEmail: ADMIN_EMAIL,
      participantUids: [user.uid, ADMIN_ALIAS_UID],
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "chats", supportChatIdStringLocatorKeyAddress), verificationDocumentRecordPayloadInstanceMap, { merge: true });

    unsubscribedChatMeta = onSnapshot(doc(db, "chats", supportChatIdStringLocatorKeyAddress), (docSnap) => {
      if (docSnap.exists()) {
        activateSelectedChatTargetRoomContextLine({ id: docSnap.id, ...docSnap.data() });
      }
    });

  } else {
    /**
     * RULE 2: USER CHATS HUB SECTION PANEL SYSTEM VIEW LAYOUT
     * Users cannot discover or communicate with any external party until Admin registers an explicit Message Card bridge document reference record.
     */
    document.getElementById("adnnOwnAvatarPlaceholder").textContent = initialsProcessingUtility(user.displayName || user.email);
    document.getElementById("adnnOwnProfileName").textContent = "Your Authorized Encrypted Connections";
    document.getElementById("adnnChatSidebarWrapper").classList.remove("hidden-structural-sidebar-forced-override-style-class-modifier");

    const directConnectionsQueryCollectionFilteredMapping = query(
      collection(db, "chats"),
      where("type", "==", "direct"),
      where("participantUids", "array-contains", user.uid)
    );

    unsubscribedChatMeta = onSnapshot(directConnectionsQueryCollectionFilteredMapping, (snapshot) => {
      const authorizedConnectionsDataListTrackSegments = [];
      snapshot.forEach(docSnap => {
        authorizedConnectionsDataListTrackSegments.push({ id: docSnap.id, ...docSnap.data() });
      });
      authorizedConnectionsDataListTrackSegments.sort((a, b) => transformTimestampMetricToMillis(b.updatedAt) - transformTimestampMetricToMillis(a.updatedAt));
      window.adnnCachedChatsArray = authorizedConnectionsDataListTrackSegments;
      executeGlobalClientChatCollectionRepaint();

      if (authorizedConnectionsDataListTrackSegments.length > 0 && !activeChatId) {
        activateSelectedChatTargetRoomContextLine(authorizedConnectionsDataListTrackSegments[0]);
      } else if (authorizedConnectionsDataListTrackSegments.length === 0) {
        // Enforce structural zero-state notice indicators view context layout spaces
        document.getElementById("adnnMasterChatsListContainer").innerHTML = `<div class="empty-list-notice">No authorized chat lines active. Contact Admin to generate a secure bridge connection.</div>`;
        document.getElementById("adnnActiveRoomLayoutContainer").classList.add("hidden");
        document.getElementById("adnnEmptyRoomFallbackContainer").classList.remove("hidden");
      }
    });
  }
}

/**
 * Global Feed Component Rendering Core Utility Map Engine
 */
function executeGlobalClientChatCollectionRepaint() {
  const container = document.getElementById("adnnMasterChatsListContainer");
  if (!container || document.getElementById("adnnChatSidebarWrapper").classList.contains("hidden-structural-sidebar-forced-override-style-class-modifier")) return;

  const activeCollection = window.adnnCachedChatsArray || [];
  const filteredCollection = activeCollection.filter(chat => {
    if (!activeSearchQueryFilter) return true;
    const title = (chat.title || chat.clientName || chat.id).toLowerCase();
    const snippet = (chat.lastMessage || "").toLowerCase();
    return title.includes(activeSearchQueryFilter) || snippet.includes(activeSearchQueryFilter);
  });

  if (filteredCollection.length === 0) {
    container.innerHTML = `<div class="empty-list-notice">No secure connection profiles match filter queries index tracks.</div>`;
    return;
  }

  container.innerHTML = "";
  filteredCollection.forEach(chat => {
    const isFocused = chat.id === activeChatId;
    const itemCard = document.createElement("article");
    itemCard.className = `adnn-sidebar-chat-card-item ${isFocused ? "active-focus" : ""}`;
    
    const unreadCount = isPlatformAdministrator(currentUser?.email) ? (chat.unreadForAdmin || 0) : (chat.unreadForClient || 0);
    
    // Dynamically calculate friendly workspace user view labels context targeting rules configurations loops
    let resolvedTitleStringValueTextContextString = chat.title || chat.clientName || "Secure Terminal Window Handshake Connection Endpoint";
    if (chat.type === "direct" && chat.participantNames && currentUser) {
      const keys = Object.keys(chat.participantNames);
      const partnerKeyReferenceId = keys.find(uid => uid !== currentUser.uid);
      if (partnerKeyReferenceId) resolvedTitleStringValueTextContextString = chat.participantNames[partnerKeyReferenceId];
    }

    const snippetText = chat.lastMessage || "Secure baseline connection channel verification active...";

    itemCard.innerHTML = `
      <div class="card-item-avatar-element">${initialsProcessingUtility(resolvedTitleStringValueTextContextString)}</div>
      <div class="card-item-body-content-block">
        <div class="card-item-header-row">
          <h5>${escapeHtmlSanitizationUtility(resolvedTitleStringValueTextContextString)}</h5>
          <span class="timestamp-metric-label">${calculateRelativeHumanizedTimeMetric(chat.updatedAt)}</span>
        </div>
        <div class="card-item-footer-row">
          <p class="message-snippet-paragraph">${escapeHtmlSanitizationUtility(snippetText)}</p>
          ${unreadCount > 0 ? `<b class="unread-count-badge-element">${unreadCount}</b>` : ""}
        </div>
      </div>
    `;

    itemCard.addEventListener("click", () => activateSelectedChatTargetRoomContextLine(chat));
    container.appendChild(itemCard);
  });

  synchronizeGlobalPlatformUnreadCountMetrics(activeCollection);
}

/**
 * Message Feed Active Room Context Handshake Operational Engine Channel Route Data Source Node
 */
function activateSelectedChatTargetRoomContextLine(chat) {
  activeChatId = chat.id;
  currentActiveChat = chat;

  document.getElementById("adnnEmptyRoomFallbackContainer").classList.add("hidden");
  document.getElementById("adnnActiveRoomLayoutContainer").classList.remove("hidden");
  document.body.classList.add("adnn-mobile-room-active-focus-view");

  const titleHeader = document.getElementById("adnnRoomTargetTitle");
  const subtitleHeader = document.getElementById("adnnRoomTargetSubtitle");
  const avatarHeader = document.getElementById("adnnRoomTargetAvatar");

  let resolvedName = chat.title || chat.clientName || "Encrypted Communication Desk Tunnel Pipeline Node Station";
  if (chat.type === "direct" && chat.participantNames && currentUser) {
    const keys = Object.keys(chat.participantNames);
    const partnerKeyReferenceId = keys.find(uid => uid !== currentUser.uid);
    if (partnerKeyReferenceId) resolvedName = chat.participantNames[partnerKeyReferenceId];
  }

  titleHeader.textContent = resolvedName;
  if (avatarHeader) avatarHeader.textContent = initialsProcessingUtility(resolvedName);

  // Sync Unread states fields context parameters data flags indicators updates adjustments records changes values configurations maps base
  if (isPlatformAdministrator(currentUser?.email)) {
    updateDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }).catch(() => {});
  } else {
    updateDoc(doc(db, "chats", chat.id), { unreadForClient: 0 }).catch(() => {});
  }

  clearActiveComposerAttachedMediaPayload();
  currentReplyContext = null;
  document.getElementById("adnnReplyContextBannerPreview").classList.add("hidden");

  // Track the focused presence tracking indicator parameter monitoring node segment bounds rules metrics loops
  clearInterval(window.adnnPresencePulseTrackerIntervalInstance);
  const partnerUid = chat.clientUid && chat.clientUid !== currentUser?.uid ? chat.clientUid : (chat.lastSenderUid !== currentUser?.uid ? chat.lastSenderUid : "");
  
  const evaluatePartnerPresenceStatusValues = async () => {
    if (!partnerUid || chat.type === "direct") {
      subtitleHeader.textContent = "Authorized Channel Block Connection Stream Active";
      return;
    }
    const snap = await getDoc(doc(db, "presence", partnerUid)).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data();
      if (data.online) {
        if (data.typingChatId === activeChatId) {
          subtitleHeader.textContent = "typing...";
          subtitleHeader.className = "subtitle-status-text typing-status-active";
        } else {
          subtitleHeader.textContent = "online";
          subtitleHeader.className = "subtitle-status-text online-status-active";
        }
      } else {
        subtitleHeader.textContent = `last seen ${calculateRelativeHumanizedTimeMetric(data.lastSeen)}`;
        subtitleHeader.className = "subtitle-status-text offline-status-preserved";
      }
    }
  };
  evaluatePartnerPresenceStatusValues();
  window.adnnPresencePulseTrackerIntervalInstance = setInterval(evaluatePartnerPresenceStatusValues, 7000);

  // Reset the real-time query listener snapshot for incoming messages
  clearInterval(unsubscribedMessageFeed);
  const messagesQueryCollectionOrdered = query(collection(db, "chats", chat.id, "messages"), orderBy("createdAt", "asc"), limit(MSG_LIMIT));
  
  unsubscribedMessageFeed = onSnapshot(messagesQueryCollectionOrdered, (snapshot) => {
    const messagesArray = [];
    snapshot.forEach(docSnap => {
      messagesArray.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderConversationalMessageBubblesLayer(messagesArray);
    markIncomingUnreadMessagesAsReadSyncLine(messagesArray);
  });

  executeGlobalClientChatCollectionRepaint();
}

/**
 * Render Conversational Feed Structure Grid Array Matrix Layer
 */
function renderConversationalMessageBubblesLayer(messages) {
  const container = document.getElementById("adnnRoomMessagesScroller");
  if (!container) return;

  container.innerHTML = "";
  if (messages.length === 0) {
    container.innerHTML = `<div class="empty-room-fallback-illustration" style="height:100%;"><p style="font-family:monospace;font-size:11px;opacity:0.38;">Secure historical terminal link synchronized. Transmission endpoints initialized.</p></div>`;
    return;
  }

  messages.forEach(msg => {
    const isMine = msg.senderUid === currentUser?.uid;
    const bubbleWrapper = document.createElement("div");
    bubbleWrapper.className = `adnn-message-bubble-wrapper ${isMine ? "align-mine" : "align-other"}`;
    
    const isFavored = msg.favoritedByCollection?.includes(currentUser?.uid);

    let attachedAssetMarkupChunk = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        attachedAssetMarkupChunk = `
          <div class="bubble-attached-media-frame-box" onclick="window.open('${msg.mediaUrl}', '_blank')">
            <img src="${msg.mediaUrl}" alt="Immersive full screen visual asset frame multi upload interception location target preview context layout element container block box">
          </div>
        `;
      } else if (msg.mediaType?.startsWith("audio/")) {
        attachedAssetMarkupChunk = `
          <div class="bubble-attached-voice-memo-player-control-card">
            <audio src="${msg.mediaUrl}" controls class="native-voice-memo-rendering-element-player-bar"></audio>
          </div>
        `;
      } else {
        attachedAssetMarkupChunk = `
          <a href="${msg.mediaUrl}" target="_blank" rel="noopener" class="bubble-generic-file-attachment-download-anchor-link">
            <span class="generic-file-icon-avatar-badge">${ICONS.paperclip}</span>
            <div class="generic-file-info-metadata-stack-column">
              <strong>${escapeHtmlSanitizationUtility(msg.mediaName || "Secure_Cloud_Storage_Asset_Package_Data_Segment_Link_Item_Locator_Context")}</strong>
              <small>External Encrypted Asset Storage Vault Element Block Node</small>
            </div>
          </a>
        `;
      }
    }

    let replyContextSnippetChunk = "";
    if (msg.replyToContextObj) {
      replyContextSnippetChunk = `
        <div class="bubble-reply-context-reference-quote-box">
          <strong>${escapeHtmlSanitizationUtility(msg.replyToContextObj.authorName)}</strong>
          <p>${escapeHtmlSanitizationUtility(msg.replyToContextObj.bodySnippet)}</p>
        </div>
      `;
    }

    let reactionsRowMarkupChunk = "";
    if (msg.reactionsMap && Object.keys(msg.reactionsMap).length > 0) {
      reactionsRowMarkupChunk = `<div class="bubble-reactions-row-strip-wrapper">`;
      Object.entries(msg.reactionsMap).forEach(([uid, reactionSymbol]) => {
        reactionsRowMarkupChunk += `<span class="reaction-badge-symbol-pill-item" title="Verified context user interaction signature data key tracker bounds matrix profile element pointer address">${reactionSymbol}</span>`;
      });
      reactionsRowMarkupChunk += `</div>`;
    }

    let statusReceiptCheckmarkIconChunk = "";
    if (isMine) {
      const colorClass = msg.readStatusReceiptState === "read" ? "receipt-double-check-blue-active-color" : "receipt-double-check-muted-default-color";
      statusReceiptCheckmarkIconChunk = `<span class="message-receipt-status-checkmark-icon-span-wrapper-context-element ${colorClass}">${ICONS.checkDouble}</span>`;
    }

    bubbleWrapper.innerHTML = `
      <div class="adnn-message-bubble-body-card-frame glass edge ${msg.callEventTransmissionLineContextFlagMetricParameters ? "call-summary-bubble-card-style" : ""}">
        ${replyContextSnippetChunk}
        ${attachedAssetMarkupChunk}
        <div class="bubble-text-content-paragraph-layout-row">
          <p>${escapeHtmlSanitizationUtility(msg.textBodyPayloadContentValueStringContent || "")}</p>
        </div>
        <div class="bubble-metadata-metrics-row-strip">
          ${isFavored ? `<span class="favorite-star-filled-icon-indicator-badge-span">${ICONS.starFilled}</span>` : ""}
          <span class="metric-timestamp-clock-label">${calculateRelativeHumanizedTimeMetric(msg.createdAt)}</span>
          ${statusReceiptCheckmarkIconChunk}
        </div>
        
        <div class="adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip">
          <button type="button" class="action-strip-dot-btn emoji-trigger-speed-dial-action-btn" data-emoji="👍">👍</button>
          <button type="button" class="action-strip-dot-btn emoji-trigger-speed-dial-action-btn" data-emoji="❤️">❤️</button>
          <button type="button" class="action-strip-dot-btn emoji-trigger-speed-dial-action-btn" data-emoji="😂">😂</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn" data-action="reply" title="Quote reply context parameters">${ICONS.back}</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn" data-action="favorite" title="Toggle favorite data flag">${ICONS.star}</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn delete-destructive-action-color-btn" data-action="delete" title="Delete message source instance from history logs collection tracker reference bounds">${ICONS.close}</button>
        </div>
        ${reactionsRowMarkupChunk}
      </div>
    `;

    // Bind interaction triggers context layout variables profiles rules parameters mapping
    bubbleWrapper.querySelectorAll(".emoji-trigger-speed-dial-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        executeAppendUserReactionToMessageDocumentPayloadInstanceNodeContextBounds(msg.id, btn.getAttribute("data-emoji"));
      });
    });

    bubbleWrapper.querySelectorAll(".functional-utility-action-trigger-row-item-icon-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        processContextualMessageBubbleFunctionalActionInvocationExecutionTrack(msg.id, msg, btn.getAttribute("data-action"));
      });
    });

    container.appendChild(bubbleWrapper);
  });

  container.scrollTop = container.scrollHeight;
}

/**
 * Event-Driven Base Interaction Event Listener Binding Map Layer Routines
 */
function wireImmersiveCoreComponentInteractions() {
  const closeBtn = document.getElementById("adnnCloseImmersiveOverlayBtn");
  if (closeBtn) closeBtn.addEventListener("click", closePremiumChatImmersiveOverlay);

  const backMobileBtn = document.getElementById("adnnRoomBackArrowMobileBtn");
  if (backMobileBtn) {
    backMobileBtn.addEventListener("click", () => {
      document.body.classList.remove("adnn-mobile-room-active-focus-view");
    });
  }

  const formElement = document.getElementById("adnnMasterComposerCoreForm");
  if (formElement) formElement.addEventListener("submit", processOutgoingMessageSubmissionPayload);

  const textInput = document.getElementById("adnnComposerTextInput");
  if (textInput) {
    textInput.addEventListener("input", (e) => {
      const sendBtn = document.getElementById("adnnComposerSubmitExecutionActionBtn");
      const micBtn = document.getElementById("adnnVoiceRecordActionTriggerBtn");
      const textVal = e.target.value.trim();

      if (textVal.length > 0 || currentMediaUploadPayload || audioRecordingPlaybackBlob) {
        sendBtn.classList.remove("hidden");
        micBtn.classList.add("hidden");
      } else {
        sendBtn.classList.add("hidden");
        micBtn.classList.remove("hidden");
      }
      broadcastTypingStateIndicatorPresence(textVal.length > 0);
    });
  }

  const fileInput = document.getElementById("adnnComposerFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) processAttachedFileAssetContext(selectedFile);
    });
  }

  const cancelReplyBtn = document.getElementById("adnnCancelReplyContextBtn");
  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", () => {
      currentReplyContext = null;
      document.getElementById("adnnReplyContextBannerPreview").classList.add("hidden");
    });
  }

  const removeMediaBtn = document.getElementById("adnnRemoveAttachedMediaBtn");
  if (removeMediaBtn) removeMediaBtn.addEventListener("click", clearActiveComposerAttachedMediaPayload);

  const cameraToggleBtn = document.getElementById("adnnComposerCameraInlineToggleBtn");
  if (cameraToggleBtn) cameraToggleBtn.addEventListener("click", toggleInlineComposerCameraContextLayer);

  const cameraCloseBtn = document.getElementById("adnnCameraComposerCloseBtn");
  if (cameraCloseBtn) cameraCloseBtn.addEventListener("click", terminateInlineComposerCameraTracks);

  const cameraCaptureBtn = document.getElementById("adnnCameraComposerCaptureBtn");
  if (cameraCaptureBtn) cameraCaptureBtn.addEventListener("click", executeStillFrameCaptureFromInlineComposerCameraTrack);

  const voiceRecordBtn = document.getElementById("adnnVoiceRecordActionTriggerBtn");
  if (voiceRecordBtn) voiceRecordBtn.addEventListener("click", toggleVoiceAudioRecordingSessionContextLayer);

  // Drag and drop frame layer triggers context bounds configuration rules mapping lines setup
  const dragDropOverlay = document.getElementById("adnnDragDropFullBoxOverlay");
  if (dragDropOverlay) {
    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (activeChatId) dragDropOverlay.classList.remove("hidden");
    });
    dragDropOverlay.addEventListener("dragover", (e) => e.preventDefault());
    dragDropOverlay.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragDropOverlay.classList.add("hidden");
    });
    dragDropOverlay.addEventListener("drop", (e) => {
      e.preventDefault();
      dragDropOverlay.classList.add("hidden");
      const files = e.dataTransfer.files;
      if (files.length > 0 && activeChatId) processAttachedFileAssetContext(files[0]);
    });
  }

  document.querySelectorAll(".adnn-room-actions-header-group button").forEach(btn => {
    btn.addEventListener("click", () => {
      triggerOutgoingRealtimeCommunicationHandshakeLine(btn.getAttribute("data-call-type"));
    });
  });

  const searchInput = document.getElementById("adnnChatFilterSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      activeSearchQueryFilter = e.target.value.toLowerCase().trim();
      executeGlobalClientChatCollectionRepaint();
    });
  }
}

/**
 * ============================================================================
 * FIRESTORE BACKEND DATA MAPPING ENGINE INTERACTIVE OPERATIONS
 * ============================================================================
 */
async function processOutgoingMessageSubmissionPayload(event) {
  event.preventDefault();
  if (!currentUser || !activeChatId) return;

  const textInputObj = document.getElementById("adnnComposerTextInput");
  const rawTextContentStringContentValue = textInputObj.value.trim();
  
  if (rawTextContentStringContentValue.length === 0 && !currentMediaUploadPayload) return;

  const messageTextDataStringValueContentPayload = rawTextContentStringContentValue;
  const attachedAssetPayloadReferenceNodeFileObj = currentMediaUploadPayload;
  const boundReplyContextPayloadInstanceDataContainerObjectTrackNode = currentReplyContext;

  // Immediate UI Input Field Reset (Prevents lag on mobile viewports)
  textInputObj.value = "";
  clearActiveComposerAttachedMediaPayload();
  currentReplyContext = null;
  document.getElementById("adnnReplyContextBannerPreview").classList.add("hidden");
  document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.add("hidden");
  document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.remove("hidden");

  broadcastTypingStateIndicatorPresence(false);

  let assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap = null;
  if (attachedAssetPayloadReferenceNodeFileObj) {
    try {
      assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap = await executeSecureExternalAttachmentTargetStorageAssetUploadPayloadHandshakeLine(attachedAssetPayloadReferenceNodeFileObj, activeChatId);
    } catch (err) {
      alert("Attachment pipeline failure segment parameters configuration: " + err.message);
      return;
    }
  }

  const completeMessageDocumentPayloadStructureContextDataNodeFieldConfigurationRecord = {
    textBodyPayloadContentValueStringContent: messageTextDataStringValueContentPayload,
    senderUid: currentUser.uid,
    senderEmail: emailNormalizationKey(currentUser.email),
    senderName: currentUser.displayName || currentUser.email || "Secure Platform Terminal Workspace Profile",
    createdAt: serverTimestamp(),
    readStatusReceiptState: "sent",
    favoritedByCollection: [],
    reactionsMap: {},
    ...(assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap && {
      mediaUrl: assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap.mediaUrl,
      mediaName: assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap.mediaName,
      mediaType: assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap.mediaType,
      mediaPath: assetUploadResultMetadataObjectLinkPayloadContainerNodeChannelContextPropertiesFieldsMap.mediaPath
    }),
    ...(boundReplyContextPayloadInstanceDataContainerObjectTrackNode && {
      replyToContextObj: boundReplyContextPayloadInstanceDataContainerObjectTrackNode
    })
  };

  await addDoc(collection(db, "chats", activeChatId, "messages"), completeMessageDocumentPayloadStructureContextDataNodeFieldConfigurationRecord);

  const summaryNotificationSnippetDisplayStringValueContentTextContextLabelStringValue = messageTextDataStringValueContentPayload || (attachedAssetPayloadReferenceNodeFileObj?.type.startsWith("audio/") ? "🎙️ Voice Message Audio Clip" : "📁 Attached Document Asset Package");
  
  const parentChatDocumentMetaRecordUpdatePayloadContainerFieldMap = {
    lastMessage: summaryNotificationSnippetDisplayStringValueContentTextContextLabelStringValue,
    lastSenderUid: currentUser.uid,
    updatedAt: serverTimestamp()
  };

  if (isPlatformAdministrator(currentUser.email)) {
    parentChatDocumentMetaRecordUpdatePayloadContainerFieldMap.unreadForClient = increment(1);
  } else {
    parentChatDocumentMetaRecordUpdatePayloadContainerFieldMap.unreadForAdmin = increment(1);
  }

  await setDoc(doc(db, "chats", activeChatId), parentChatDocumentMetaRecordUpdatePayloadContainerFieldMap, { merge: true });
}

async function executeSecureExternalAttachmentTargetStorageAssetUploadPayloadHandshakeLine(file, chatId) {
  if (!storage) throw new Error("Cloud Storage buckets uninitialized reference paths mapping vectors channels context blocks.");
  
  const normalizedSafeCleanStringCharactersSanitizedFileNameStringValueContentTextPropertyString = String(file.name || "secure_binary_asset_stream")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);

  const referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress = `chat-media-vault/${chatId}/${currentUser.uid}/${Date.now()}_${normalizedSafeCleanStringCharactersSanitizedFileNameStringValueContentTextPropertyString}`;
  const bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField = storageRef(storage, referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress);
  
  await uploadBytes(bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField, file, { contentType: file.type || "application/octet-stream" });
  const absoluteSecuredDownloadURLStringAddressEndpointPathLocationResourceLinkString = await getDownloadURL(bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField);
  
  return {
    mediaUrl: absoluteSecuredDownloadURLStringAddressEndpointPathLocationResourceLinkString,
    mediaName: file.name || "Secured Platform Cryptographic Storage Package Object Component Block",
    mediaType: file.type || "application/octet-stream",
    mediaPath: referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress
  };
}

/**
 * ============================================================================
 * ADVANCED WEBRTC CALL ENGINE IMPLEMENTATION ARCHITECTURE
 * ============================================================================
 */
async function initializeCallInboxEngine(user) {
  clearInterval(unsubscribedCallInbox);
  unsubscribedCallInbox = onSnapshot(doc(db, "callInbox", user.uid), async (snapshot) => {
    if (!snapshot.exists()) return;
    const inboxData = snapshot.data();
    if (inboxData.status === "ringing" && inboxData.callerUid !== currentUser.uid && (!activeCallState || activeCallState.callId !== inboxData.callId)) {
      if (Date.now() > inboxData.expiresAtMs) {
        updateDoc(doc(db, "callInbox", user.uid), { status: "missed_expired" }).catch(() => {});
        return;
      }
      triggerIncomingRealtimeCommunicationHandshakeLine(inboxData);
    }
  });
}

function triggerIncomingRealtimeCommunicationHandshakeLine(inboxRecord) {
  if (activeCallState) return;
  audioRingerLoop.currentTime = 0;
  audioRingerLoop.play().catch(() => {});

  activeCallState = {
    callId: inboxRecord.callId,
    chatId: inboxRecord.chatId,
    mode: "incoming",
    type: inboxRecord.kind,
    partnerUid: inboxRecord.callerUid,
    partnerName: inboxRecord.callerName || "Remote Contact Location Terminal Key Pointer",
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    chronometerIntervalInstance: null
  };
  renderCommunicationImmersiveInterfaceOverlayWindowUI();
}

async function triggerOutgoingRealtimeCommunicationHandshakeLine(communicationTypeKindStringValuePropertyTypeContextIndicator) {
  if (!activeChatId || !currentActiveChat) return;
  audioRingerLoop.currentTime = 0;
  audioRingerLoop.play().catch(() => {});

  const generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue = `call_${Date.now()}_${currentUser.uid}`;
  const targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue = currentActiveChat.clientUid && currentActiveChat.clientUid !== currentUser.uid ? currentActiveChat.clientUid : (currentActiveChat.lastSenderUid !== currentUser.uid ? currentActiveChat.lastSenderUid : "adnn-admin");

  activeCallState = {
    callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
    chatId: activeChatId,
    mode: "outgoing",
    type: communicationTypeKindStringValuePropertyTypeContextIndicator,
    partnerUid: targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue,
    partnerName: document.getElementById("adnnRoomTargetTitle").textContent || "Secure Connection Target Profile Endpoint Destination Station",
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    chronometerIntervalInstance: null
  };
  renderCommunicationImmersiveInterfaceOverlayWindowUI();

  try {
    activeCallState.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: communicationTypeKindStringValuePropertyTypeContextIndicator === "video" ? { width: 1280, height: 720 } : false
    });

    const localVideoTrackFrameComponentElementView = document.getElementById("adnnCallLocalVideoTrackFrameComponentElementView");
    if (localVideoTrackFrameComponentElementView && activeCallState.localStream.getVideoTracks().length > 0) {
      localVideoTrackFrameComponentElementView.srcObject = activeCallState.localStream;
      document.getElementById("adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.remove("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance");
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
    activeCallState.peerConnection = pc;
    activeCallState.localStream.getTracks().forEach(track => pc.addTrack(track, activeCallState.localStream));

    activeCallState.remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => activeCallState.remoteStream.addTrack(track));
      const remoteVideoTrackFrameComponentElementView = document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView");
      if (remoteVideoTrackFrameComponentElementView) {
        remoteVideoTrackFrameComponentElementView.srcObject = activeCallState.remoteStream;
        document.getElementById("adnnCallRemoteVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.remove("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance");
        document.getElementById("adnnCallVideoWorkspaceLayoutGridStageFrameContainerElementArea").classList.add("dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, "calls", generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue, "offerCandidates"), event.candidate.toJSON()).catch(() => {});
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await setDoc(doc(db, "calls", generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue), {
      callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
      chatId: activeChatId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email || "Platform Caller Terminal Station Target Node Location Reference",
      receiverUid: targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue,
      kind: communicationTypeKindStringValuePropertyTypeContextIndicator,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "callInbox", targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue), {
      callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
      chatId: activeChatId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email || "Platform Caller Handshake Initialization Vector Source Desk",
      kind: communicationTypeKindStringValuePropertyTypeContextIndicator,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      createdAt: serverTimestamp()
    }, { merge: true });

    monitorActiveCallSignalingDocumentPipelineChannel(generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue, false);
  } catch (err) {
    console.error(err);
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "WebRTC internal acquisition parameter failure trace metrics blocks locator instances contexts rules lines.");
  }
}

async function executeAcceptIncomingCommunicationHandshakeCallLineAction() {
  if (!activeCallState || activeCallState.mode !== "incoming") return;
  audioRingerLoop.pause();

  try {
    const callRef = doc(db, "calls", activeCallState.callId);
    const snap = await getDoc(callRef).catch(() => null);
    if (!snap || !snap.exists() || snap.data().status !== "ringing") {
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Session expired or dropped before answer connection handshake verification operations tracking lines paths segment bounds layout frames components nodes.");
      return;
    }

    const callData = snap.data();
    activeCallState.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callData.kind === "video" ? { width: 1280, height: 720 } : false
    });

    const localVideoTrackFrameComponentElementView = document.getElementById("adnnCallLocalVideoTrackFrameComponentElementView");
    if (localVideoTrackFrameComponentElementView && activeCallState.localStream.getVideoTracks().length > 0) {
      localVideoTrackFrameComponentElementView.srcObject = activeCallState.localStream;
      document.getElementById("adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.remove("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance");
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    activeCallState.peerConnection = pc;
    activeCallState.localStream.getTracks().forEach(track => pc.addTrack(track, activeCallState.localStream));

    activeCallState.remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => activeCallState.remoteStream.addTrack(track));
      const remoteVideoTrackFrameComponentElementView = document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView");
      if (remoteVideoTrackFrameComponentElementView) {
        remoteVideoTrackFrameComponentElementView.srcObject = activeCallState.remoteStream;
        document.getElementById("adnnCallRemoteVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.remove("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance");
        document.getElementById("adnnCallVideoWorkspaceLayoutGridStageFrameContainerElementArea").classList.add("dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance");
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, "calls", activeCallState.callId, "answerCandidates"), event.candidate.toJSON()).catch(() => {});
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await updateDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, status: "connected", connectedAt: serverTimestamp() });
    await setDoc(doc(db, "callInbox", currentUser.uid), { status: "connected_accepted" }, { merge: true });

    document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden");
    document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden");
    
    startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine();
    monitorActiveCallSignalingDocumentPipelineChannel(activeCallState.callId, true);
  } catch (err) {
    console.error(err);
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "WebRTC configuration tracks answer routine exceptions: " + err.message);
  }
}

function monitorActiveCallSignalingDocumentPipelineChannel(callId, isAnswerer) {
  const callRef = doc(db, "calls", callId);
  window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineA = onSnapshot(callRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    
    if (data.status === "connected" && activeCallState && activeCallState.mode === "outgoing" && !activeCallState.chronometerIntervalInstance) {
      if (data.answer && activeCallState.peerConnection.signalingState !== "stable") {
        activeCallState.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
      }
      document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden");
      document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden");
      startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine();
    }
    if (data.status === "terminated" || data.status === "rejected") {
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Secure session pipeline disconnected from host point link tracker context boundaries frameworks trace maps values configurations.");
    }
  });

  window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineB = onSnapshot(collection(db, "calls", callId, isAnswerer ? "offerCandidates" : "answerCandidates"), (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" && activeCallState && activeCallState.peerConnection) {
        activeCallState.peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      }
    });
  });
}

async function executeRejectIncomingCommunicationHandshakeCallLineAction() {
  if (!activeCallState) return;
  audioRingerLoop.pause();
  if (activeCallState.callId) {
    await updateDoc(doc(db, "calls", activeCallState.callId), { status: "rejected" }).catch(() => {});
    await setDoc(doc(db, "callInbox", currentUser.uid), { status: "rejected_declined" }, { merge: true }).catch(() => {});
  }
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Call declined context configuration baseline node path locator parameters.");
}

async function executeTerminateActiveCommunicationHandshakeCallLineAction() {
  if (!activeCallState) return;
  audioRingerLoop.pause();

  if (activeCallState.callId) {
    await updateDoc(doc(db, "calls", activeCallState.callId), { status: "terminated", endedAt: serverTimestamp() }).catch(() => {});
    await setDoc(doc(db, "callInbox", activeCallState.mode === "incoming" ? currentUser.uid : activeCallState.partnerUid), { status: "terminated_cleared" }, { merge: true }).catch(() => {});
  }

  if (activeCallState.chronometerIntervalInstance && activeCallState.chatId) {
    const totalDurationLabelValMetricContextStringContentValueText = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel").textContent || "00:00";
    await addDoc(collection(db, "chats", activeCallState.chatId, "messages"), {
      textBodyPayloadContentValueStringContent: `✦ Secure Chat ${activeCallState.type === "video" ? "FaceTime Video view" : "Audio connection track line"} session closed safely · Duration record indicator: ${totalDurationLabelValMetricContextStringContentValueText} · Synchronized Reference Node Track Log Document`,
      senderUid: currentUser.uid,
      senderEmail: emailNormalizationKey(currentUser.email),
      senderName: currentUser.displayName || currentUser.email || "System WebRTC Communication Signal Route Core Core Module Pipeline Connection Node Location",
      createdAt: serverTimestamp(),
      callEventTransmissionLineContextFlagMetricParameters: true,
      readStatusReceiptState: "read",
      favoritedByCollection: [],
      reactionsMap: {}
    }).catch(() => {});
  }
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(true, "Communication session link trace closed smoothly structural guidelines lines rules configuration tracks mapping setup contexts profile properties values.");
}

/**
 * ============================================================================
 * TEXT WRAPPERS & UTILITY DEEP COMPLIANCE PARSER MODULES
 * ============================================================================
 */
function toggleInlineComposerCameraContextLayer() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  const liveVideoTrackFrame = document.getElementById("adnnComposerInlineCameraTrackView");
  if (inlineComposerCameraStream) { terminateInlineComposerCameraTracks(); return; }
  navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: 640, height: 480 } }).then(stream => {
    inlineComposerCameraStream = stream; liveVideoTrackFrame.srcObject = stream; containerBox.classList.remove("hidden");
    document.getElementById("adnnComposerCameraInlineToggleBtn").classList.add("camera-active-glow-neon-tint-accent-color-style");
  }).catch(() => alert("Camera acquisition locked parameters metrics indicators context blocks windows locators paths channels elements lines."));
}

function terminateInlineComposerCameraTracks() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  if (inlineComposerCameraStream) { inlineComposerCameraStream.getTracks().forEach(t => t.stop()); inlineComposerCameraStream = null; }
  if (document.getElementById("adnnComposerInlineCameraTrackView")) document.getElementById("adnnComposerInlineCameraTrackView").srcObject = null;
  if (containerBox) containerBox.classList.add("hidden");
  const toggleBtn = document.getElementById("adnnComposerCameraInlineToggleBtn");
  if (toggleBtn) toggleBtn.classList.remove("camera-active-glow-neon-tint-accent-color-style");
}

function executeStillFrameCaptureFromInlineComposerCameraTrack() {
  if (!inlineComposerCameraStream) return;
  const video = document.getElementById("adnnComposerInlineCameraTrackView");
  const canvas = document.createElement("canvas"); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d"); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(b => { if (b) processAttachedFileAssetContext(new File([b], `capture_${Date.now()}.jpg`, { type: "image/jpeg" })); terminateInlineComposerCameraTracks(); }, "image/jpeg", 0.9);
}

function toggleVoiceAudioRecordingSessionContextLayer() {
  const layer = document.getElementById("adnnVoiceRecordingViewComponentLayer");
  const textInput = document.getElementById("adnnComposerTextInput");
  const btn = document.getElementById("adnnVoiceRecordActionTriggerBtn");
  if (currentAudioRecorderInstance && currentAudioRecorderInstance.state !== "inactive") {
    currentAudioRecorderInstance.stop(); clearInterval(audioRecordingChronometer); layer.classList.add("hidden"); textInput.classList.remove("hidden"); btn.classList.remove("recording-session-active-pulse-red-glow-tint-style"); return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const chunks = []; currentAudioRecorderInstance = new MediaRecorder(stream, { mimeType: "audio/webm" });
    currentAudioRecorderInstance.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    currentAudioRecorderInstance.onstop = () => {
      audioRecordingPlaybackBlob = new Blob(chunks, { type: "audio/webm" }); stream.getTracks().forEach(t => t.stop());
      currentMediaUploadPayload = new File([audioRecordingPlaybackBlob], `voice_clip_${Date.now()}.webm`, { type: "audio/webm" });
      document.getElementById("adnnComposerMediaRenderTargetBox").innerHTML = `<div class="generic-document-file-preview-thumbnail-avatar-card-frame-box voice-memo-preview-override-box-layout-card-style"><span>🎙️</span><strong>Audio Message Segment Clip Bundle</strong><small>Interception Layer Ready</small></div>`;
      document.getElementById("adnnComposerInlineMediaPreviewContainer").classList.remove("hidden"); document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.remove("hidden"); btn.classList.add("hidden");
    };
    chunks.length = 0; currentAudioRecorderInstance.start(); let count = 0;
    clearInterval(audioRecordingChronometer); audioRecordingChronometer = setInterval(() => { count++; const m = String(Math.floor(count / 60)).padStart(2, "0"); const s = String(count % 60).padStart(2, "0"); document.getElementById("adnnVoiceDurationChronometer").textContent = `${m}:${s}`; }, 1000);
    layer.classList.remove("hidden"); textInput.classList.add("hidden"); btn.classList.add("recording-session-active-pulse-red-glow-tint-style");
  }).catch(() => alert("Voice acquisition peripherals rejected trace parameter block value configuration fields matrix layout rules."));
}

function processContextualMessageBubbleFunctionalActionInvocationExecutionTrack(messageId, fullMessageObj, actionType) {
  if (!activeChatId || !messageId) return;
  if (actionType === "reply") {
    currentReplyContext = { messageId, authorName: fullMessageObj.senderName || "User Context Source Desk Locator Index Pointer Key Code Field", bodySnippet: fullMessageObj.textBodyPayloadContentValueStringContent || "[Asset Transmission Payload Bundle Data Source Indicator Reference]" };
    document.getElementById("adnnReplyContextAuthorName").textContent = currentReplyContext.authorName; document.getElementById("adnnReplyContextBodySnippet").textContent = currentReplyContext.bodySnippet;
    document.getElementById("adnnReplyContextBannerPreview").classList.remove("hidden"); document.getElementById("adnnComposerTextInput").focus();
  } else if (actionType === "favorite") {
    const arr = fullMessageObj.favoritedByCollection || []; const idx = arr.indexOf(currentUser?.uid); if (idx >= 0) arr.splice(idx, 1); else arr.push(currentUser?.uid);
    updateDoc(doc(db, "chats", activeChatId, "messages", messageId), { favoritedByCollection: arr }).catch(() => {});
  } else if (actionType === "delete") {
    if (fullMessageObj.senderUid === currentUser?.uid || isPlatformAdministrator(currentUser?.email)) deleteDoc(doc(db, "chats", activeChatId, "messages", messageId)).catch(() => {});
  }
}

function executeAppendUserReactionToMessageDocumentPayloadInstanceNodeContextBounds(messageId, emoji) {
  if (!activeChatId || !messageId) return; updateDoc(doc(db, "chats", activeChatId, "messages", messageId), { [`reactionsMap.${currentUser.uid}`]: emoji }).catch(() => {});
}

function processAttachedFileAssetContext(file) {
  if (file.size > 10 * 1024 * 1024) { alert("File size constraints exceeded (10MB target parameter configuration boundaries threshold capped bounds rules indices paths context limit values maximum value properties total amount)."); return; }
  currentMediaUploadPayload = file; const box = document.getElementById("adnnComposerMediaRenderTargetBox"); box.innerHTML = ""; document.getElementById("adnnComposerInlineMediaPreviewContainer").classList.remove("hidden");
  if (file.type.startsWith("image/")) { const url = URL.createObjectURL(file); box.innerHTML = `<img src="${url}" alt="Multi-upload layout sequence context frame preview container slot rendering node space structural visual container card area element pointer segment path asset component">`; }
  else { box.innerHTML = `<div class="generic-document-file-preview-thumbnail-avatar-card-frame-box"><span>📄</span><strong>${escapeHtmlSanitizationUtility(file.name)}</strong><small>${(file.size / (1024 * 1024)).toFixed(2)} MB Package Object Document Source Component Data Block Unit Context Target Parameter Value Size Properties Field Module}</small></div>`; }
  document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.remove("hidden"); document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.add("hidden");
}

function clearActiveComposerAttachedMediaPayload() {
  currentMediaUploadPayload = null; audioRecordingPlaybackBlob = null; document.getElementById("adnnComposerInlineMediaPreviewContainer").classList.add("hidden"); document.getElementById("adnnComposerMediaRenderTargetBox").innerHTML = ""; document.getElementById("adnnComposerFileInput").value = "";
  if (document.getElementById("adnnComposerTextInput").value.trim().length === 0) { document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.add("hidden"); document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.remove("hidden"); }
}

function startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine() {
  let count = 0; const lbl = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel"); clearInterval(activeCallState.chronometerIntervalInstance);
  activeCallState.chronometerIntervalInstance = setInterval(() => { count++; const m = String(Math.floor(count / 60)).padStart(2, "0"); const s = String(count % 60).padStart(2, "0"); if (lbl) lbl.textContent = `${m}:${s}`; }, 1000);
}

function renderCommunicationImmersiveInterfaceOverlayWindowUI() {
  // Enforces direct baseline execution from code mapping variables directly context elements layers properties paths fields matrix
  const currentImmersiveOverlayUIInstanceFrameBoxSlotLocatorInstanceElementNode = document.getElementById("adnnCallImmersiveInterfaceOverlayPanelContainerWindow");
  if (currentImmersiveOverlayUIInstanceFrameBoxSlotLocatorInstanceElementNode) currentImmersiveOverlayUIInstanceFrameBoxSlotLocatorInstanceElementNode.remove();
  
  const windowContainerCardOverlayViewWrapperNode = document.createElement("div");
  windowContainerCardOverlayViewWrapperNode.id = "adnnCallImmersiveInterfaceOverlayPanelContainerWindow";
  windowContainerCardOverlayViewWrapperNode.className = "adnn-call-immersive-interface-overlay-panel-container-window-context-layer-frame-box-slot-locator-instance glass";
  windowContainerCardOverlayViewWrapperNode.innerHTML = `
    <div class="call-interface-window-card-box edge">
      <div class="call-interface-top-metadata-bar-strip"><span class="crypto-lock-icon-tint-badge-span">🔒 Secure Encrypted Connection Route Track</span><span class="chronometer-duration-timer-display-label-value-metrics-properties" id="adnnCallImmersiveChronometerDurationDisplayLabel">Handshaking Parameters Module Pipeline...</span></div>
      <div class="call-interface-target-profile-avatar-banner-block"><div class="target-profile-avatar-large-circle-element">${initialsProcessingUtility(activeCallState.partnerName)}</div><h3>${escapeHtmlSanitizationUtility(activeCallState.partnerName)}</h3><p id="adnnCallInterfaceDynamicStatusContextLabelMessageLineString">End-to-End Cryptographic WebRTC Stream Context Terminal Line Station</p></div>
      <div class="adnn-call-video-workspace-layout-grid-stage-frame-container-element-area" id="adnnCallVideoWorkspaceLayoutGridStageFrameContainerElementArea">
        <div class="camera-tile-window-frame-block-card remote-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallRemoteVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode"><video id="adnnCallRemoteVideoTrackFrameComponentElementView" autoplay playsinline></video><div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Remote Stream Lens Standby</div><span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Remote Participant Feed Endpoint Destination Station Location</span></div>
        <div class="camera-tile-window-frame-block-card local-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode"><video id="adnnCallLocalVideoTrackFrameComponentElementView" autoplay muted playsinline class="mirror-corrected-stream-track-rendering-engine-element-node"></video><div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Local Video Signal Capture Track Transmit Node Inactive</div><span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Your Workspace Vector Preview Frame Layout Space Matrix (Opposite Mirror Matrix Layout Transformation Transformation Equation Bounds)</span></div>
      </div>
      <div class="call-interface-actions-toolbar-buttons-row-strip-control-matrix-wrapper-box-container-element">
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip" id="adnnCallIncomingActionsContextControlsContainerBoxStrip"><button type="button" class="toolbar-functional-action-circle-icon-btn accept-action-green-color-pulse-neon-tint-style-btn" id="adnnCallAcceptActionBtn" title="Accept connection line mappings and initialize WebRTC stream paths variables">${ICONS.phone}<span>Accept Secure Connection Handshake Vector Layer</span></button><button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallDeclineActionBtn" title="Reject request line execution traces">${ICONS.close}<span>Decline Secure Line Request Handshake Connection</span></button></div>
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip hidden" id="adnnCallConnectedActiveActionsContextControlsContainerBoxStrip"><button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallMuteMicToggleActionBtn">${ICONS.mic}</button><button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleVideoMuteTrackStateActionBtn">${ICONS.video}</button><button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleSpeakerSinkOutputRouteActionBtn">${ICONS.speaker}</button><button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleHoldStateActionBtn">${ICONS.hold}</button><button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallEndConnectedActiveSessionActionBtn">${ICONS.close}</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(windowContainerCardOverlayViewWrapperNode);
  document.getElementById("adnnCallAcceptActionBtn").addEventListener("click", executeAcceptIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallDeclineActionBtn").addEventListener("click", executeRejectIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallEndConnectedActiveSessionActionBtn").addEventListener("click", executeTerminateActiveCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallMuteMicToggleActionBtn").addEventListener("click", e => { const track = activeCallState.localStream.getAudioTracks()[0]; if (track) { track.enabled = !track.enabled; e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !track.enabled); e.currentTarget.innerHTML = track.enabled ? ICONS.mic : ICONS.micOff; } });
  document.getElementById("adnnCallToggleVideoMuteTrackStateActionBtn").addEventListener("click", e => { const track = activeCallState.localStream.getVideoTracks()[0]; if (track) { track.enabled = !track.enabled; e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !track.enabled); e.currentTarget.innerHTML = track.enabled ? ICONS.video : ICONS.videoOff; document.getElementById("adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.toggle("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance", !track.enabled); } });
  document.getElementById("adnnCallToggleSpeakerSinkOutputRouteActionBtn").addEventListener("click", e => { const m = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color"); e.currentTarget.innerHTML = m ? ICONS.speakerOff : ICONS.speaker; if (document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView")) document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView").muted = m; });
  document.getElementById("adnnCallToggleHoldStateActionBtn").addEventListener("click", e => { const h = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color"); if (activeCallState?.peerConnection) updateDoc(doc(db, "calls", activeCallState.callId), { [`sessionHoldStateParametersMap.${currentUser.uid}`]: h }).catch(() => {}); });
  if (activeCallState.mode === "incoming") { document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.remove("hidden"); document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.add("hidden"); }
  else { document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden"); document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden"); }
}

function closePremiumChatImmersiveOverlay() {
  const overlay = document.getElementById("adnnPremiumChatOverlayPanel");
  if (overlay?.classList.contains("adnn-chat-overlay-immersive")) { overlay.classList.remove("is-visible"); setTimeout(() => overlay.classList.add("hidden"), 300); }
  terminateInlineComposerCameraTracks();
}

function toggleChatComponentTriggerVisibility(user) {
  const trigger = document.getElementById("adnnPremiumChatTrigger"); if (trigger) trigger.classList.toggle("hidden", !user);
}

function broadcastTypingStateIndicatorPresence(isTyping) {
  if (db && currentUser?.uid) setDoc(doc(db, "presence", currentUser.uid), { typingChatId: isTyping ? activeChatId : "" }, { merge: true }).catch(() => {});
}

function markIncomingUnreadMessagesAsReadSyncLine(messages) {
  if (!db || messages.length === 0) return; messages.forEach(m => { if (m.senderUid !== currentUser?.uid && m.readStatusReceiptState !== "read") updateDoc(doc(db, "chats", activeChatId, "messages", m.id), { readStatusReceiptState: "read" }).catch(() => {}); });
}

function emailNormalizationKey(email) { return String(email || "").trim().toLowerCase(); }
function isPlatformAdministrator(email) { return emailNormalizationKey(email) === ADMIN_EMAIL; }
function initialsProcessingUtility(str) { const tokens = String(str || "AD").trim().toUpperCase().split(/\s+/).filter(Boolean); if (tokens.length === 0) return "AD"; if (tokens.length === 1) return tokens[0].slice(0, 2); return `${tokens[0][0]}${tokens[1][0]}`; }
function transformTimestampMetricToMillis(obj) { if (!obj) return Date.now(); if (typeof obj.toMillis === "function") return obj.toMillis(); if (obj instanceof Date) return obj.getTime(); const p = new Date(obj); return Number.isNaN(p.getTime()) ? Date.now() : p.getTime(); }
function calculateRelativeHumanizedTimeMetric(obj) { const m = transformTimestampMetricToMillis(obj); const diff = Math.max(0, Math.floor((Date.now() - m) / 1000)); if (diff < 60) return "Just now"; const mins = Math.floor(diff / 60); if (mins < 60) return `${mins}m ago`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; return new Date(m).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function escapeHtmlSanitizationUtility(str) { return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function synchronizeGlobalPlatformUnreadCountMetrics(arr) { let total = 0; arr.forEach(c => { total += isPlatformAdministrator(currentUser?.email) ? (c.unreadForAdmin || 0) : (c.unreadForClient || 0); }); document.querySelectorAll(".adnn-badge-counter").forEach(b => { b.textContent = String(total); b.classList.toggle("hidden", total === 0); }); }
function terminateAllActiveSubscribers() { clearInterval(unsubscribedChatMeta); clearInterval(unsubscribedMessageFeed); clearInterval(unsubscribedPresenceMeta); clearInterval(unsubscribedCallInbox); clearInterval(window.adnnPresencePulseTrackerIntervalInstance); terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Teardown context lifecycle indices routes execution maps vectors blocks values channels indicators."); }

function injectStylesheetRules() {
  if (document.getElementById("adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode")) return;
  const style = document.createElement("style"); style.id = "adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode";
  style.textContent = `
    :root {
      --adnn-tahoe-primary-tint: #272dcf;
      --adnn-tahoe-bg-glass-heavy: linear-gradient(135deg, rgba(26, 26, 30, 0.96), rgba(12, 12, 16, 0.92) 50%, rgba(6, 6, 10, 0.98));
      --adnn-tahoe-bg-glass-card: rgba(255, 255, 255, 0.04);
      --adnn-tahoe-border-subtle: rgba(255, 255, 255, 0.09);
      --adnn-tahoe-text-main: #f5f5f7;
      --adnn-tahoe-text-muted: rgba(245, 245, 247, 0.52);
      --adnn-tahoe-bubble-mine: linear-gradient(135deg, rgba(39, 45, 207, 0.94), rgba(18, 22, 140, 0.84));
      --adnn-tahoe-bubble-other: rgba(255, 255, 255, 0.06);
      --adnn-tahoe-neon-green: #25d366;
      --adnn-tahoe-neon-red: #ff3b30;
      --adnn-chat-vh: 100svh;
    }

    /* Fixed Height Container Setup to prevent clipping context viewboxes layout frameworks bounds tracks */
    .adnn-chat-window-container {
      width: 100%; height: 680px; max-height: calc(var(--adnn-chat-vh) - 20px); border-radius: 20px; overflow: hidden;
      display: grid; grid-template-columns: 340px 1fr; background: var(--adnn-tahoe-bg-glass-heavy);
      border: 1px solid var(--adnn-tahoe-border-subtle); box-shadow: 0 24px 80px rgba(0,0,0,0.5); position: relative;
    }
    
    .adnn-chat-embedded-container-context-frame { width: 100%; height: auto; display: block; overflow: hidden; }
    .hidden-structural-sidebar-forced-override-style-class-modifier { display: none !important; }
    .client-support-view-only .adnn-chat-window-container { grid-template-columns: 1fr !important; }

    .adnn-chat-sidebar-wrapper { border-right: 1px solid var(--adnn-tahoe-border-subtle); display: grid; grid-template-rows: 76px 54px 1fr; min-height: 0; background: rgba(0,0,0,0.12); }
    .adnn-sidebar-identity-header { padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--adnn-tahoe-border-subtle); }
    .adnn-identity-profile-info { display: flex; align-items: center; gap: 12px; color: var(--adnn-tahoe-text-main); }
    .adnn-identity-avatar-placeholder { width: 38px; height: 38px; border-radius: 10px; background: var(--adnn-tahoe-primary-tint); display: grid; place-items: center; font-weight: 600; font-size: 14px; }
    .adnn-identity-profile-info h4 { font-size: 14.5px; font-weight: 500; margin: 0; }
    .online-pill-indicator { font-size: 9.5px; margin: 2px 0 0; color: var(--adnn-tahoe-neon-green); font-family: monospace; }
    .adnn-close-overlay-btn { display: none; background: transparent; border: 0; color: #fff; cursor: pointer; }

    .adnn-sidebar-search-container { padding: 8px 12px; }
    .adnn-search-input-group { background: rgba(0,0,0,0.2); border-radius: 10px; border: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; padding: 0 10px; height: 36px; }
    .adnn-search-input-group input { background: transparent; border: 0; outline: 0; color: #fff; font-size: 13px; width: 100%; margin-left: 6px; }
    .search-icon-span { color: var(--adnn-tahoe-text-muted); display: flex; }

    .adnn-sidebar-conversations-list { min-height: 0; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
    .empty-list-notice { padding: 40px 16px; text-align: center; color: var(--adnn-tahoe-text-muted); font-size: 11.5px; font-family: monospace; line-height: 1.5; }
    
    .adnn-sidebar-chat-card-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; cursor: pointer; transition: background 0.15s ease; border: 1px solid transparent; }
    .adnn-sidebar-chat-card-item:hover { background: rgba(255,255,255,0.03); }
    .adnn-sidebar-chat-card-item.active-focus { background: rgba(39, 45, 207, 0.14); border-color: rgba(39, 45, 207, 0.25); }
    .card-item-avatar-element { width: 40px; height: 40px; border-radius: 50%; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); display: grid; place-items: center; font-weight: 500; font-size: 13.5px; color: #fff; flex-shrink: 0; }
    .card-item-body-content-block { flex: 1; min-width: 0; }
    .card-item-header-row { display: flex; justify-content: space-between; align-items: baseline; }
    .card-item-header-row h5 { margin: 0; font-size: 14px; font-weight: 500; color: var(--adnn-tahoe-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timestamp-metric-label { font-size: 9.5px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    .card-item-footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .message-snippet-paragraph { margin: 0; font-size: 12px; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread-count-badge-element { background: var(--adnn-tahoe-primary-tint); color: #fff; font-size: 9px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; display: grid; place-items: center; font-family: monospace; }

    .adnn-chat-main-room-view { min-width: 0; min-height: 0; background: rgba(0,0,0,0.04); position: relative; }
    .empty-room-fallback-illustration { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--adnn-tahoe-text-muted); padding: 32px; }
    .illustration-art-logo { font-size: 44px; color: var(--adnn-tahoe-primary-tint); margin-bottom: 12px; }
    .empty-room-fallback-illustration h3 { font-size: 17px; font-weight: 400; color: var(--adnn-tahoe-text-main); margin: 0 0 8px; }
    .empty-room-fallback-illustration p { font-size: 12.5px; max-width: 360px; margin: 0; line-height: 1.5; }
    
    .adnn-active-room-layout { display: grid; grid-template-rows: 72px 1fr auto; height: 100%; min-height: 0; position: relative; }
    .adnn-room-appbar-header { padding: 0 18px; height: 72px; border-bottom: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.06); }
    .adnn-back-arrow-mobile-btn { display: none; background: transparent; border: 0; color: #fff; width: 36px; height: 36px; place-items: center; margin-right: 4px; font-size: 20px; }
    .adnn-room-meta-target-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .adnn-target-avatar-placeholder { width: 42px; height: 42px; border-radius: 50%; background: var(--adnn-tahoe-primary-tint); font-weight: 600; font-size: 14.5px; color: #fff; display: grid; place-items: center; flex-shrink: 0; }
    .adnn-room-meta-target-info h4 { margin: 0; font-size: 14.5px; font-weight: 500; color: var(--adnn-tahoe-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .subtitle-status-text { margin: 2px 0 0; font-size: 10.5px; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
    .online-status-active { color: var(--adnn-tahoe-neon-green); }
    .typing-status-active { color: var(--adnn-tahoe-primary-tint); font-weight: 600; }
    
    .adnn-room-actions-header-group { display: flex; align-items: center; gap: 8px; }
    .adnn-call-trigger-btn { width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); color: #fff; cursor: pointer; display: grid; place-items: center; transition: all 0.2s ease; }
    .adnn-call-trigger-btn:hover { background: var(--adnn-tahoe-primary-tint); border-color: transparent; }
    .adnn-call-trigger-btn svg { width: 15px; height: 15px; }

    /* Feed Scroller Configuration Rules Mappings */
    .adnn-chat-messages-scroll-area { min-height: 0; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; -webkit-overflow-scrolling: touch; }
    .adnn-message-bubble-wrapper { display: flex; width: 100%; position: relative; clear: both; }
    .adnn-message-bubble-wrapper.align-mine { justify-content: flex-end; }
    .adnn-message-bubble-wrapper.align-other { justify-content: flex-start; }
    
    .adnn-message-bubble-body-card-frame { max-width: 72%; padding: 10px 14px; border-radius: 16px; position: relative; }
    .align-mine .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-mine); color: #fff; border-bottom-right-radius: 4px; border: 1px solid rgba(255,255,255,0.08); }
    .align-other .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-other); color: var(--adnn-tahoe-text-main); border: 1px solid var(--adnn-tahoe-border-subtle); border-bottom-left-radius: 4px; }
    
    .bubble-text-content-paragraph-layout-row p { margin: 0; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; }
    .bubble-metadata-metrics-row-strip { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; font-size: 9px; color: rgba(255,255,255,0.45); font-family: monospace; }
    .align-other .metric-timestamp-clock-label { color: var(--adnn-tahoe-text-muted); }
    
    /* Hover Dropdowns Layer Action Bars Strip Styles Context Units Coordinates Matrix */
    .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip {
      position: absolute; bottom: 100%; right: 0; background: rgba(18,18,22,0.96); border: 1px solid var(--adnn-tahoe-border-subtle);
      border-radius: 10px; padding: 3px; display: flex; gap: 1px; opacity: 0; pointer-events: none; transform: translateY(4px); transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1); z-index: 10; backdrop-filter: blur(10px);
    }
    .adnn-message-bubble-body-card-frame:hover .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .action-strip-dot-btn { background: transparent; border: 0; color: #fff; font-size: 12px; padding: 4px 6px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .action-strip-dot-btn:hover { background: rgba(255,255,255,0.1); }
    .action-strip-dot-btn svg { width: 12px; height: 12px; }
    .delete-destructive-action-color-btn:hover { background: var(--adnn-tahoe-neon-red) !important; }

    .bubble-attached-media-frame-box { margin-bottom: 6px; border-radius: 10px; overflow: hidden; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); max-height: 240px; }
    .bubble-attached-media-frame-box img { width: 100%; height: auto; display: block; object-fit: cover; max-height: 240px; }
    .bubble-reply-context-reference-quote-box { background: rgba(0,0,0,0.14); border-left: 3px solid var(--adnn-tahoe-primary-tint); padding: 4px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 11.5px; }
    .bubble-reply-context-reference-quote-box strong { display: block; color: rgba(255,255,255,0.8); }
    .bubble-reply-context-reference-quote-box p { margin: 1px 0 0; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .bubble-generic-file-attachment-download-anchor-link { display: flex; align-items: center; gap: 8px; padding: 6px; background: rgba(0,0,0,0.1); border-radius: 8px; text-decoration: none; color: inherit; margin-bottom: 6px; border: 1px solid var(--adnn-tahoe-border-subtle); }
    .generic-file-icon-avatar-badge { width: 30px; height: 30px; border-radius: 6px; background: rgba(255,255,255,0.06); display: grid; place-items: center; }
    .generic-file-info-metadata-stack-column strong { font-size: 11.5px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; display: block; }
    .generic-file-info-metadata-stack-column small { font-size: 9.5px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    .bubble-reactions-row-strip-wrapper { position: absolute; top: calc(100% - 5px); left: 10px; display: flex; gap: 1px; background: #18181b; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 1px 3px; border-radius: 6px; font-size: 9px; z-index: 2; }

    /* Drag Drop Full Box Overlays Component */
    .adnn-drag-drop-full-box-overlay { position: absolute; inset: 10px; z-index: 100; background: rgba(39, 45, 207, 0.12); backdrop-filter: blur(6px); border-radius: 16px; padding: 16px; pointer-events: none; }
    .drag-drop-card-view { border: 2px dashed var(--adnn-tahoe-primary-tint); border-radius: 12px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #fff; background: rgba(0,0,0,0.7); }
    .drag-icon-announcement { font-size: 28px; margin-bottom: 4px; }
    
    /* Composer Layout Settings Rules Infrastructure Components Parameters Mappings Fields Window Context */
    .adnn-chat-footer-composer-wrapper { padding: 12px; border-top: 1px solid var(--adnn-tahoe-border-subtle); background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 6px; }
    .adnn-master-composer-core-form { display: flex; align-items: center; gap: 8px; }
    .composer-action-icon-trigger-label, .composer-action-icon-trigger-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); color: var(--adnn-tahoe-text-muted); cursor: pointer; display: grid; place-items: center; transition: all 0.15s ease; padding: 0; }
    .composer-action-icon-trigger-label:hover, .composer-action-icon-trigger-btn:hover, .camera-active-glow-neon-tint-accent-color-style { color: #fff; border-color: var(--adnn-tahoe-primary-tint); background: rgba(255,255,255,0.06); }
    .composer-action-icon-trigger-label svg, .composer-action-icon-trigger-btn svg { width: 15px; height: 15px; }
    
    .composer-input-field-workspace-box { flex: 1; position: relative; display: flex; align-items: center; min-width: 0; }
    .composer-input-field-workspace-box input { width: 100%; height: 38px; border-radius: 19px; background: rgba(0,0,0,0.3); border: 1px solid var(--adnn-tahoe-border-subtle); padding: 0 14px; color: #fff; outline: 0; font-size: 13.5px; }
    .composer-input-field-workspace-box input:focus { border-color: var(--adnn-tahoe-primary-tint); }
    
    .composer-submit-execution-action-btn { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--adnn-tahoe-primary-tint); color: #fff; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; }
    .composer-submit-execution-action-btn svg { width: 13px; height: 13px; transform: rotate(45deg); }

    .adnn-reply-context-banner-preview { background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 6px 10px; display: flex; align-items: center; gap: 10px; }
    .reply-vertical-accent-line { width: 3px; height: 24px; background: var(--adnn-tahoe-primary-tint); border-radius: 1.5px; }
    .reply-context-body-content { flex: 1; min-width: 0; font-size: 11.5px; }
    .reply-context-body-content strong { display: block; color: #fff; }
    .reply-context-body-content p { margin: 1px 0 0; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    
    .adnn-composer-inline-media-preview-container { padding: 4px; background: rgba(0,0,0,0.2); border-radius: 10px; border: 1px solid var(--adnn-tahoe-border-subtle); display: inline-flex; }
    .media-preview-card-frame { position: relative; }
    .media-render-target-box img { max-width: 120px; max-height: 80px; border-radius: 6px; object-fit: cover; display: block; }
    .adnn-remove-attached-media-btn { position: absolute; top: -5px; right: -5px; background: #000; color: #fff; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--adnn-tahoe-border-subtle); cursor: pointer; display: grid; place-items: center; font-size: 9px; }
    
    .generic-document-file-preview-thumbnail-avatar-card-frame-box { padding: 10px; background: rgba(0,0,0,0.25); border-radius: 6px; display: flex; flex-direction: column; gap: 2px; width: 130px; font-size: 10.5px; text-align: center; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box span { font-size: 18px; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box strong { color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box small { color: var(--adnn-tahoe-text-muted); font-family: monospace; }

    .adnn-composer-integrated-camera-mirror-box { position: relative; width: 100%; max-width: 200px; aspect-ratio: 4/3; border-radius: 10px; overflow: hidden; border: 1px solid var(--adnn-tahoe-primary-tint); margin-bottom: 2px; }
    .mirror-corrected-stream { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); background: #000; }
    .camera-mirror-controls-bar { position: absolute; bottom: 0; inset-inline: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 6px; display: flex; justify-content: center; align-items: center; gap: 16px; }
    .camera-action-circle-btn { width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 2px solid #000; cursor: pointer; }
    .camera-action-close-btn { background: rgba(0,0,0,0.5); border: 0; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }

    .adnn-voice-recording-view-component-layer { display: flex; align-items: center; gap: 8px; width: 100%; padding-left: 4px; }
    .live-blink-pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--adnn-tahoe-neon-red); animation: liveBlinkPulse 0.8s infinite alternate; }
    .voice-duration-chronometer { font-size: 12px; color: #fff; font-family: monospace; }
    .voice-wave-canvas-visualization-simulation { display: flex; align-items: center; gap: 1.5px; height: 16px; }
    .voice-wave-canvas-visualization-simulation span { width: 2px; height: 60%; background: var(--adnn-tahoe-primary-tint); border-radius: 1px; animation: soundWaveSim 0.5s infinite cubic-bezier(0.2, 0.8, 0.2, 1) alternate; }
    .voice-wave-canvas-visualization-simulation span:nth-child(2n) { animation-delay: 0.1s; height: 40%; }
    .voice-wave-canvas-visualization-simulation span:nth-child(3n) { animation-delay: 0.2s; height: 85%; }
    .recording-session-active-pulse-red-glow-tint-style { background: var(--adnn-tahoe-neon-red) !important; color: #fff !important; }

    .call-summary-bubble-card-style { background: rgba(255,255,255,0.01) !important; border: 1px dashed var(--adnn-tahoe-border-subtle) !important; border-radius: 10px !important; text-align: center !important; width: 85% !important; max-width: 400px !important; margin: 4px auto !important; }
    .call-summary-bubble-card-style p { font-family: monospace !important; font-size: 11px !important; color: var(--adnn-tahoe-text-muted) !important; }

    /* WebRTC FaceTime Component Panels Window View Objects Matrix */
    .adnn-call-immersive-interface-overlay-panel-container-window-context-layer-frame-box-slot-locator-instance {
      position: fixed; inset: 0; z-index: 2147483640; background: rgba(6,6,8,0.88); backdrop-filter: blur(24px) saturate(130%); display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .call-interface-window-card-box {
      width: min(780px, 100%); background: #111113; border-radius: 24px; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 32px 100px rgba(0,0,0,0.55);
    }
    .call-interface-top-metadata-bar-strip { display: flex; justify-content: space-between; font-size: 10.5px; font-family: monospace; color: var(--adnn-tahoe-text-muted); border-bottom: 1px solid var(--adnn-tahoe-border-subtle); padding-bottom: 8px; }
    .crypto-lock-icon-tint-badge-span { color: var(--adnn-tahoe-neon-green); }
    
    .call-interface-target-profile-avatar-banner-block { text-align: center; color: #fff; }
    .target-profile-avatar-large-circle-element { width: 56px; height: 56px; border-radius: 18px; background: var(--adnn-tahoe-primary-tint); font-size: 22px; font-weight: 600; display: grid; place-items: center; margin: 0 auto 8px; box-shadow: 0 6px 20px rgba(39, 45, 207, 0.3); }
    .call-interface-target-profile-avatar-banner-block h3 { margin: 0; font-size: 16.5px; font-weight: 500; }
    .call-interface-target-profile-avatar-banner-block p { margin: 3px 0 0; font-size: 11.5px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    
    .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area { display: none; width: 100%; aspect-ratio: 16/9; max-height: 340px; border-radius: 14px; overflow: hidden; border: 1px solid var(--adnn-tahoe-border-subtle); position: relative; background: #000; }
    .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area.dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance { display: grid !important; grid-template-columns: 1fr 1fr; gap: 6px; padding: 6px; }
    
    .camera-tile-window-frame-block-card { position: relative; height: 100%; width: 100%; border-radius: 10px; overflow: hidden; background: #08080a; }
    .camera-tile-window-frame-block-card video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mirror-corrected-stream-track-rendering-engine-element-node { transform: scaleX(-1); }
    
    .camera-stream-track-placeholder-fallback-text-overlay-label-box { position: absolute; inset: 0; display: none; place-items: center; text-align: center; color: var(--adnn-tahoe-text-muted); font-size: 10.5px; font-family: monospace; letter-spacing: 0.06em; text-transform: uppercase; background: #09090c; }
    .camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance video { display: none !important; }
    .camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance .camera-stream-track-placeholder-fallback-text-overlay-label-box { display: grid !important; }
    .camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge { position: absolute; left: 8px; bottom: 8px; background: rgba(0,0,0,0.6); padding: 3px 6px; border-radius: 14px; font-size: 9px; color: #fff; font-family: monospace; }

    .call-interface-actions-toolbar-buttons-row-strip-control-matrix-wrapper-box-container-element { display: flex; justify-content: center; padding-top: 4px; }
    .actions-toolbar-conditional-state-sub-group-flex-layout-strip { display: flex; align-items: center; gap: 10px; }
    .toolbar-functional-action-circle-icon-btn { width: 48px; height: 48px; border-radius: 14px; border: 1px solid var(--adnn-tahoe-border-subtle); background: var(--adnn-tahoe-bg-glass-card); color: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 15px; padding: 0; }
    .toolbar-functional-action-circle-icon-btn:hover { background: rgba(255,255,255,0.06); }
    .toolbar-functional-action-circle-icon-btn span { font-size: 8.5px; display: block; font-family: monospace; color: var(--adnn-tahoe-text-muted); margin-top: 1px; }
    .toolbar-functional-action-circle-icon-btn svg { width: 16px; height: 16px; display: block; }

    .accept-action-green-color-pulse-neon-tint-style-btn { background: var(--adnn-tahoe-neon-green) !important; border-color: transparent !important; width: auto !important; padding: 0 16px !important; flex-direction: row !important; gap: 6px !important; border-radius: 16px !important; font-size: 13.5px; }
    .accept-action-green-color-pulse-neon-tint-style-btn span { color: #fff !important; font-size: 12px !important; font-family: inherit !important; }
    .decline-destructive-action-red-color-style-btn { background: var(--adnn-tahoe-neon-red) !important; border-color: transparent !important; border-radius: 50% !important; }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn { width: auto !important; padding: 0 16px !important; flex-direction: row !important; gap: 6px !important; border-radius: 16px !important; font-size: 13.5px; }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn span { color: #fff !important; font-size: 12px !important; font-family: inherit !important; }

    .disabled-muted-state-active-glow-style-class-modifier-tint-color { background: rgba(255,255,255,0.18) !important; color: var(--adnn-tahoe-neon-red) !important; }

    /* Core Media Queries Configuration Profiles Breakpoints (Stops All Forms of Screen Cropping) */
    @media (max-width: 768px) {
      .adnn-chat-window-container { grid-template-columns: 1fr !important; height: var(--adnn-chat-vh) !important; max-height: var(--adnn-chat-vh) !important; border-radius: 0; border: 0; }
      .adnn-chat-sidebar-wrapper { display: grid !important; }
      .adnn-chat-main-room-view { display: none; }
      
      body.adnn-mobile-room-active-focus-view .adnn-chat-sidebar-wrapper { display: none !important; }
      body.adnn-mobile-room-active-focus-view .adnn-chat-main-room-view { display: block !important; position: fixed; inset: 0; z-index: 999999; height: var(--adnn-chat-vh) !important; }
      body.adnn-mobile-room-active-focus-view .adnn-active-room-layout { display: grid !important; height: 100% !important; }
      body.adnn-mobile-room-active-focus-view .adnn-back-arrow-mobile-btn { display: grid !important; }
      
      .adnn-chat-messages-scroll-area { padding: 10px; }
      .adnn-message-bubble-body-card-frame { max-width: 85%; }
      .adnn-chat-footer-composer-wrapper { padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important; }
      
      .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area.dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance { grid-template-columns: 1fr !important; grid-template-rows: 1fr 1fr !important; max-height: none !important; }
      .call-interface-window-card-box { height: var(--adnn-chat-vh) !important; border-radius: 0; border: 0; justify-content: space-between; padding: 24px 14px; }
    }

    @keyframes liveBlinkPulse { from { opacity: 0.3; } to { opacity: 1; } }
    @keyframes soundWaveSim { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
  `;
  document.head.appendChild(style);
}
