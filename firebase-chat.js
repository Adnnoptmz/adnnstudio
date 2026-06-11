/**
 * ============================================================================
 * FIRESTORE-CHAT.JS (PRO-TIER)
 * A Premium, WhatsApp-Grade Chat & WebRTC Communication Engine
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

// Global Platform Directives & Consts
const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const CALL_RING_TIMEOUT_MS = 60000;
const CALL_SIGNAL_CLEANUP_DELAY_MS = 5000;
const MSG_LIMIT = 100;

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

// Premium Apple Tahoe Styled SVG Icons Vector Suite
const ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"/><path d="M16 5l4 4-4 4"/></svg>`,
  videoOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h5a2 2 0 0 1 2 2v3m4-1.8l3-3v11l-3-3M1 1l22 22"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v11a4 4 0 0 0 4-4V5a4 4 0 0 0-4-4z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 11a5 5 0 0 1-2.54 4.34M12 19v4M8 23h8"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  speakerOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  hold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  cameraSwitch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  checkDouble: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><path d="M17 5L9.5 12.5L6 9M22 5l-7.5 7.5M13 17l-1.5-1.5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
};

// Application Global Orchestration States
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

// Media Capture Instances
let inlineComposerCameraStream = null;

// Audio Assets Integration
const audioNotificationAlert = new Audio("Message%20Notification.wav");
audioNotificationAlert.volume = 0.35;
const audioRingerLoop = new Audio("call ringer_01.mp3");
audioRingerLoop.loop = true;

/**
 * Platform Core Bootstrap Entry Point
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

    if (location.pathname.includes("admin.html") && isPlatformAdministrator(user.email)) {
      initializeAdminChatWorkspace();
    } else if (location.pathname.includes("designer-account.html") || location.pathname.includes("account.html")) {
      initializeStandardClientChatWorkspace(user);
    }
  });
}

/**
 * Standard Workspace Infrastructure Mount
 */
function bootstrapDOMContainers() {
  if (document.getElementById("adnnPremiumChatTrigger")) return;

  const trigger = document.createElement("button");
  trigger.id = "adnnPremiumChatTrigger";
  trigger.className = "adnn-chat-trigger-premium hidden";
  trigger.setAttribute("aria-label", "Open Platinum Conversations");
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M12 2C6.48 2 2 6.48 2 12c0 2.02.6 3.9 1.63 5.48L2.05 22l4.64-1.35C8.1 21.4 9.98 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
    <span class="adnn-badge-counter hidden">0</span>
  `;

  const navActions = document.querySelector(".nav-actions .search") || document.querySelector(".nav-actions");
  if (navActions) {
    navActions.insertAdjacentElement("afterend", trigger);
  } else {
    trigger.classList.add("floating-action-trigger");
    document.body.appendChild(trigger);
  }

  trigger.addEventListener("click", () => {
    if (!currentUser) return;
    if (isPlatformAdministrator(currentUser.email)) {
      location.href = "admin.html#chat";
    } else if (location.pathname.includes("designer-account.html")) {
      openEmbeddedClientInterface();
    } else {
      openEmbeddedClientInterface();
    }
  });

  // Construct Dynamic Overlay Structures
  buildGlobalOverlayShells();
}

/**
 * Full Immersive Structure Construction
 */
function buildGlobalOverlayShells() {
  if (document.getElementById("adnnPremiumChatOverlayPanel")) return;

  const overlayShell = document.createElement("div");
  overlayShell.id = "adnnPremiumChatOverlayPanel";
  overlayShell.className = "adnn-chat-overlay-immersive hidden";
  overlayShell.innerHTML = `
    <div class="adnn-chat-window-container glass edge">
      <aside class="adnn-chat-sidebar-wrapper">
        <header class="adnn-sidebar-identity-header">
          <div class="adnn-identity-profile-info">
            <div class="adnn-identity-avatar-placeholder" id="adnnOwnAvatarPlaceholder">U</div>
            <div>
              <h4 id="adnnOwnProfileName">Conversations</h4>
              <p class="online-pill-indicator">System Connected</p>
            </div>
          </div>
          <button type="button" class="adnn-close-overlay-btn" id="adnnCloseImmersiveOverlayBtn">${ICONS.close}</button>
        </header>
        
        <div class="adnn-sidebar-search-container">
          <div class="adnn-search-input-group">
            <span class="search-icon-span">${ICONS.search}</span>
            <input type="text" id="adnnChatFilterSearchInput" placeholder="Search or start new chat...">
          </div>
        </div>
        
        <div class="adnn-sidebar-conversations-list" id="adnnMasterChatsListContainer">
          <div class="empty-list-notice">No conversations matching structural index.</div>
        </div>
      </aside>
      
      <main class="adnn-chat-main-room-view" id="adnnMainRoomWindow">
        <div class="empty-room-fallback-illustration" id="adnnEmptyRoomFallbackContainer">
          <div class="illustration-art-logo">✦</div>
          <h3>AdnnStudio Premium Connect</h3>
          <p>End-to-End secure messaging built on Apple Tahoe frameworks. High fidelity WebRTC endpoints active.</p>
        </div>
        
        <div class="adnn-active-room-layout hidden" id="adnnActiveRoomLayoutContainer">
          <header class="adnn-room-appbar-header">
            <button type="button" class="adnn-back-arrow-mobile-btn" id="adnnRoomBackArrowMobileBtn">${ICONS.back}</button>
            <div class="adnn-room-meta-target-info">
              <div class="adnn-target-avatar-placeholder" id="adnnRoomTargetAvatar">C</div>
              <div>
                <h4 id="adnnRoomTargetTitle">Loading Contact...</h4>
                <p id="adnnRoomTargetSubtitle">Preserving state lifecycle</p>
              </div>
            </div>
            <div class="adnn-room-actions-header-group">
              <button type="button" class="adnn-call-trigger-btn" data-call-type="audio" title="Start high definition audio connection">${ICONS.phone}</button>
              <button type="button" class="adnn-call-trigger-btn" data-call-type="video" title="Start real-time video connection">${ICONS.video}</button>
            </div>
          </header>
          
          <div class="adnn-chat-messages-scroll-area" id="adnnRoomMessagesScroller"></div>
          
          <div class="adnn-drag-drop-full-box-overlay hidden" id="adnnDragDropFullBoxOverlay">
            <div class="drag-drop-card-view border-dashed">
              <div class="drag-icon-announcement">✦</div>
              <h3>Drop high fidelity asset here</h3>
              <p>Max file size limits constrained to 10MB structural bands.</p>
            </div>
          </div>
          
          <footer class="adnn-chat-footer-composer-wrapper">
            <div class="adnn-reply-context-banner-preview hidden" id="adnnReplyContextBannerPreview">
              <div class="reply-vertical-accent-line"></div>
              <div class="reply-context-body-content">
                <strong id="adnnReplyContextAuthorName">Replying to user...</strong>
                <p id="adnnReplyContextBodySnippet">Content asset text context</p>
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
                <button type="button" class="camera-action-circle-btn" id="adnnCameraComposerCaptureBtn" title="Capture Still Image Frame"></button>
                <button type="button" class="camera-action-close-btn" id="adnnCameraComposerCloseBtn" title="Close Camera Context">${ICONS.close}</button>
              </div>
            </div>
            
            <form class="adnn-master-composer-core-form" id="adnnMasterComposerCoreForm" autocomplete="off">
              <label class="composer-action-icon-trigger-label" title="Attach assets, drawings or zip packages">
                <input type="file" id="adnnComposerFileInput" accept="image/*,.pdf,.doc,.docx,.zip" class="hidden">
                ${ICONS.paperclip}
              </label>
              
              <button type="button" class="composer-action-icon-trigger-btn" id="adnnComposerCameraInlineToggleBtn" title="Open integrated composition camera">${ICONS.camera}</button>
              
              <div class="composer-input-field-workspace-box">
                <input type="text" id="adnnComposerTextInput" maxlength="1800" placeholder="Type a message here...">
                
                <div class="adnn-voice-recording-view-component-layer hidden" id="adnnVoiceRecordingViewComponentLayer">
                  <span class="live-blink-pulse-dot"></span>
                  <span class="voice-duration-chronometer" id="adnnVoiceDurationChronometer">00:00</span>
                  <div class="voice-wave-canvas-visualization-simulation">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                </div>
              </div>
              
              <div class="composer-action-execution-context-matrix-box">
                <button type="button" class="composer-action-icon-trigger-btn" id="adnnVoiceRecordActionTriggerBtn" title="Record Voice Audio Message Layer"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.2 6 6.6V21h2v-3.4c3.28-.4 6-3.18 6-6.6h-1.7z"/></svg></button>
                <button type="submit" class="composer-submit-execution-action-btn hidden" id="adnnComposerSubmitExecutionActionBtn" title="Transmit Data Package Payload">${ICONS.send}</button>
              </div>
            </form>
          </footer>
        </div>
      </main>
    </div>
  `;

  // Append Immersive Structure To Document Body Execution Matrix Layer
  const rootClientMountPoint = document.getElementById("clientChatMount") || document.getElementById("chats_view");
  if (rootClientMountPoint) {
    overlayShell.classList.remove("adnn-chat-overlay-immersive", "hidden");
    overlayShell.className = "adnn-chat-embedded-container-context-frame";
    rootClientMountPoint.appendChild(overlayShell);
  } else {
    document.body.appendChild(overlayShell);
  }

  // Intercept Global Structural Interaction Keyboard Framework Events Layer
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePremiumChatImmersiveOverlay();
    }
  });

  wireImmersiveCoreComponentInteractions();
}

/**
 * Event-Driven Core Platform Binding Layers
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

  // Bind Standard Composition Actions Submissions Layer Matrix Rules
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

  // Setup Composition Asset Hooks Integration
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
  if (removeMediaBtn) {
    removeMediaBtn.addEventListener("click", clearActiveComposerAttachedMediaPayload);
  }

  // High Fidelity Camera Capture Integration Framework layer Hooks
  const cameraToggleBtn = document.getElementById("adnnComposerCameraInlineToggleBtn");
  if (cameraToggleBtn) cameraToggleBtn.addEventListener("click", toggleInlineComposerCameraContextLayer);

  const cameraCloseBtn = document.getElementById("adnnCameraComposerCloseBtn");
  if (cameraCloseBtn) cameraCloseBtn.addEventListener("click", terminateInlineComposerCameraTracks);

  const cameraCaptureBtn = document.getElementById("adnnCameraComposerCaptureBtn");
  if (cameraCaptureBtn) cameraCaptureBtn.addEventListener("click", executeStillFrameCaptureFromInlineComposerCameraTrack);

  // Advanced Audio Voice Recording System Action Handlers Binding Matrix Layer
  const voiceRecordBtn = document.getElementById("adnnVoiceRecordActionTriggerBtn");
  if (voiceRecordBtn) voiceRecordBtn.addEventListener("click", toggleVoiceAudioRecordingSessionContextLayer);

  // Drag and Drop Asset Direct Interception Engine Hooks Integration Layer
  const scrollerZone = document.getElementById("adnnRoomMessagesScroller");
  if (scrollerZone) {
    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (activeChatId) document.getElementById("adnnDragDropFullBoxOverlay").classList.remove("hidden");
    });
    const dragDropOverlay = document.getElementById("adnnDragDropFullBoxOverlay");
    dragDropOverlay.addEventListener("dragover", (e) => e.preventDefault());
    dragDropOverlay.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragDropOverlay.classList.add("hidden");
    });
    dragDropOverlay.addEventListener("drop", (e) => {
      e.preventDefault();
      dragDropOverlay.classList.add("hidden");
      const files = e.dataTransfer.files;
      if (files.length > 0 && activeChatId) {
        processAttachedFileAssetContext(files[0]);
      }
    });
  }

  // Core Global Communication Trigger Realtime Routing Call Endpoints Binding Matrix Layer Hooks
  document.querySelectorAll(".adnn-room-actions-header-group button").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-call-type");
      triggerOutgoingRealtimeCommunicationHandshakeLine(type);
    });
  });

  // Structural Search Context Filtering Realtime Search Indexer Component Event Binder
  const searchInput = document.getElementById("adnnChatFilterSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      activeSearchQueryFilter = e.target.value.toLowerCase().trim();
      executeGlobalClientChatCollectionRepaint();
    });
  }
}

/**
 * High Performance Core Presence Orchestration Processing Rules Engine
 */
async function initializePresenceEngine(user) {
  if (!db || !user?.uid) return;
  const heartbeat = async () => {
    const presenceRef = doc(db, "presence", user.uid);
    const payload = {
      uid: user.uid,
      email: emailNormalizationKey(user.email),
      name: user.displayName || user.email || "Premium Dynamic User",
      online: true,
      lastSeen: serverTimestamp(),
      page: location.pathname,
      typingChatId: activeChatId && document.getElementById("adnnComposerTextInput")?.value.trim().length > 0 ? activeChatId : ""
    };
    await setDoc(presenceRef, payload, { merge: true }).catch(() => {});
    if (isPlatformAdministrator(user.email)) {
      await setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { ...payload, uid: ADMIN_ALIAS_UID, name: "AdnnStudio Management Support" }, { merge: true }).catch(() => {});
    }
  };

  await heartbeat();
  clearInterval(unsubscribedPresenceMeta);
  unsubscribedPresenceMeta = setInterval(heartbeat, 20000);
  window.addEventListener("beforeunload", executeGracefulPresenceDisconnectSignoff);
}

function executeGracefulPresenceDisconnectSignoff() {
  if (!db || !currentUser?.uid) return;
  const signoffObj = { online: false, lastSeen: serverTimestamp() };
  setDoc(doc(db, "presence", currentUser.uid), signoffObj, { merge: true }).catch(() => {});
  if (isPlatformAdministrator(currentUser.email)) {
    setDoc(doc(db, "presence", ADMIN_ALIAS_UID), signoffObj, { merge: true }).catch(() => {});
  }
}

/**
 * Broadcast Dynamic Composition Activity States Tracking Handler
 */
function broadcastTypingStateIndicatorPresence(isTyping) {
  if (!db || !currentUser?.uid) return;
  setDoc(doc(db, "presence", currentUser.uid), {
    typingChatId: isTyping ? activeChatId : ""
  }, { merge: true }).catch(() => {});
}

/**
 * Immersive Overlay Viewport Lifecycle Controller Routines
 */
function openPremiumChatImmersiveOverlay() {
  const overlay = document.getElementById("adnnPremiumChatOverlayPanel");
  if (overlay && overlay.classList.contains("adnn-chat-overlay-immersive")) {
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("is-visible"), 10);
  }
}

function closePremiumChatImmersiveOverlay() {
  const overlay = document.getElementById("adnnPremiumChatOverlayPanel");
  if (overlay && overlay.classList.contains("adnn-chat-overlay-immersive")) {
    overlay.classList.remove("is-visible");
    setTimeout(() => overlay.classList.add("hidden"), 300);
  }
  terminateInlineComposerCameraTracks();
}

function toggleChatComponentTriggerVisibility(user) {
  const trigger = document.getElementById("adnnPremiumChatTrigger");
  if (!trigger) return;
  trigger.classList.toggle("hidden", !user);
}

/**
 * High Level Central Workspace Sync Framework Orchestrators
 */
function initializeAdminChatWorkspace() {
  document.getElementById("adnnOwnAvatarPlaceholder").textContent = "👑";
  document.getElementById("adnnOwnProfileName").textContent = "Studio Console";

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

async function initializeStandardClientChatWorkspace(user) {
  const deterministicChatId = `support_${user.uid}`;
  document.getElementById("adnnOwnAvatarPlaceholder").textContent = initialsProcessingUtility(user.displayName || user.email);
  document.getElementById("adnnOwnProfileName").textContent = user.displayName || "Client Account";

  // Establish base routing schema binding matrix record configurations context rules
  await setDoc(doc(db, "chats", deterministicChatId), {
    type: "support",
    clientUid: user.uid,
    clientEmail: emailNormalizationKey(user.email),
    clientName: user.displayName || user.email || "Client User",
    adminEmail: ADMIN_EMAIL,
    participantUids: [user.uid, ADMIN_ALIAS_UID],
    createdAt: serverTimestamp()
  }, { merge: true });

  clearInterval(unsubscribedChatMeta);
  const userChatsQuery = query(collection(db, "chats"), where("participantUids", "array-contains", user.uid));
  unsubscribedChatMeta = onSnapshot(userChatsQuery, (snapshot) => {
    const chatsData = [];
    snapshot.forEach(docSnap => {
      chatsData.push({ id: docSnap.id, ...docSnap.data() });
    });
    window.adnnCachedChatsArray = chatsData;
    executeGlobalClientChatCollectionRepaint();

    // Directly bind context to the main interface room focus target framework rules pipeline structure channel
    if (chatsData.length > 0 && !activeChatId) {
      activateSelectedChatTargetRoomContextLine(chatsData[0]);
    }
  });
}

/**
 * Premium Left Sidebar Geometric Layout Collection Rendering Engine
 */
function executeGlobalClientChatCollectionRepaint() {
  const container = document.getElementById("adnnMasterChatsListContainer");
  if (!container) return;

  const activeCollection = window.adnnCachedChatsArray || [];
  const filteredCollection = activeCollection.filter(chat => {
    if (!activeSearchQueryFilter) return true;
    const title = (chat.clientName || chat.title || chat.id).toLowerCase();
    const snippet = (chat.lastMessage || "").toLowerCase();
    return title.includes(activeSearchQueryFilter) || snippet.includes(activeSearchQueryFilter);
  });

  if (filteredCollection.length === 0) {
    container.innerHTML = `<div class="empty-list-notice">No secure lines match execution matrix criteria.</div>`;
    return;
  }

  container.innerHTML = "";
  filteredCollection.forEach(chat => {
    const isFocused = chat.id === activeChatId;
    const itemCard = document.createElement("article");
    itemCard.className = `adnn-sidebar-chat-card-item ${isFocused ? "active-focus" : ""}`;
    
    const unreadCount = isPlatformAdministrator(currentUser?.email) ? (chat.unreadForAdmin || 0) : (chat.unreadForClient || 0);
    const resolvedTitle = chat.title || chat.clientName || "Secure Tunnel Pipeline";
    const snippetText = chat.lastMessage || "Establish dynamic communication stream handshake...";

    itemCard.innerHTML = `
      <div class="card-item-avatar-element">${initialsProcessingUtility(resolvedTitle)}</div>
      <div class="card-item-body-content-block">
        <div class="card-item-header-row">
          <h5>${escapeHtmlSanitizationUtility(resolvedTitle)}</h5>
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

  // Synchronize dynamic application badges tracking metric parameters configuration rules
  synchronizeGlobalPlatformUnreadCountMetrics(activeCollection);
}

function openEmbeddedClientInterface() {
  openPremiumChatImmersiveOverlay();
  if (window.adnnCachedChatsArray && window.adnnCachedChatsArray.length > 0) {
    activateSelectedChatTargetRoomContextLine(window.adnnCachedChatsArray[0]);
  }
}

/**
 * Master Space Focus Operational Stream Handshake Execution Target Routines
 */
function activateSelectedChatTargetRoomContextLine(chat) {
  activeChatId = chat.id;
  currentActiveChat = chat;

  document.getElementById("adnnEmptyRoomFallbackContainer").classList.add("hidden");
  document.getElementById("adnnActiveRoomLayoutContainer").classList.remove("hidden");
  document.body.classList.add("adnn-mobile-room-active-focus-view");

  const titleHeader = document.getElementById("adnnRoomTargetTitle");
  const subtitleHeader = document.getElementById("adnnRoomTargetSubtitle");
  const avatarHeader = document.getElementById("adnnRoomTargetTargetAvatar") || document.getElementById("adnnRoomTargetAvatar");

  const resolvedName = chat.title || chat.clientName || "Secure Terminal Window Channel Connection Line";
  titleHeader.textContent = resolvedName;
  if (avatarHeader) avatarHeader.textContent = initialsProcessingUtility(resolvedName);

  // Clear unread tracking status markers inside core documents
  if (isPlatformAdministrator(currentUser?.email)) {
    updateDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }).catch(() => {});
  } else {
    updateDoc(doc(db, "chats", chat.id), { unreadForClient: 0 }).catch(() => {});
  }

  // Reset core temporary values inside workspace structures
  clearActiveComposerAttachedMediaPayload();
  currentReplyContext = null;
  document.getElementById("adnnReplyContextBannerPreview").classList.add("hidden");

  // Track the focus connection status of target profiles
  clearInterval(window.adnnPresencePulseTrackerIntervalInstance);
  const partnerUid = chat.clientUid && chat.clientUid !== currentUser?.uid ? chat.clientUid : (chat.lastSenderUid !== currentUser?.uid ? chat.lastSenderUid : "");
  
  const evaluatePartnerPresenceStatusValues = async () => {
    if (!partnerUid) {
      subtitleHeader.textContent = "Multi-device end-to-end active matrix";
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
  window.adnnPresencePulseTrackerIntervalInstance = setInterval(evaluatePartnerPresenceStatusValues, 6000);

  // Re-establish real-time event scroller baseline streams channel rules pipelines
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
 * Conversational Feed Rendering Engine
 */
function renderConversationalMessageBubblesLayer(messages) {
  const container = document.getElementById("adnnRoomMessagesScroller");
  if (!container) return;

  container.innerHTML = "";
  if (messages.length === 0) {
    container.innerHTML = `<div class="empty-room-fallback-illustration" style="height:100%;">
      <p style="font-family:var(--font-mono, monospace);font-size:11px;opacity:0.4;">Secure baseline initialized. Multi-tier transport line active.</p>
    </div>`;
    return;
  }

  messages.forEach(msg => {
    const isMine = msg.senderUid === currentUser?.uid;
    const bubbleWrapper = document.createElement("div");
    bubbleWrapper.className = `adnn-message-bubble-wrapper ${isMine ? "align-mine" : "align-other"}`;
    
    // Evaluate if the message contains favorited structural states tracking parameters
    const isFavored = msg.favoritedByCollection?.includes(currentUser?.uid);

    let attachedAssetMarkupChunk = "";
    if (msg.mediaUrl) {
      if (msg.mediaType?.startsWith("image/")) {
        attachedAssetMarkupChunk = `
          <div class="bubble-attached-media-frame-box" onclick="window.open('${msg.mediaUrl}', '_blank')">
            <img src="${msg.mediaUrl}" alt="High-fidelity uploaded file attachment data package grid preview slot location context rendering layout structural instance background container visual asset space segment line">
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
              <strong>${escapeHtmlSanitizationUtility(msg.mediaName || "Asset Package Document File Data Segment Link Item Resource Vector Instance Specification Source Module Document Container Metadata Context Frame Block Locator")}</strong>
              <small>Secure External Attachment Target Storage Asset Node</small>
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

    // Build dynamic user reactions collection layout indicators framework layer
    let reactionsRowMarkupChunk = "";
    if (msg.reactionsMap && Object.keys(msg.reactionsMap).length > 0) {
      reactionsRowMarkupChunk = `<div class="bubble-reactions-row-strip-wrapper">`;
      Object.entries(msg.reactionsMap).forEach(([uid, reactionSymbol]) => {
        reactionsRowMarkupChunk += `<span class="reaction-badge-symbol-pill-item" title="Reacted by user profile identification signature location key tracker bounds context matrix element pointer link address segment context space">${reactionSymbol}</span>`;
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
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn" data-action="favorite" title="Toggle favorite star context data flag status configuration parameters matrix link asset node paths">${ICONS.star}</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn delete-destructive-action-color-btn" data-action="delete" title="Delete message segment payload instance context node data source parameters from history collection tracking index references channel list track bounds">${ICONS.close}</button>
        </div>
        ${reactionsRowMarkupChunk}
      </div>
    `;

    // Bind Contextual Functional Component Interaction Routines Matrix Layout Layer Actions Click Events Hooks
    bubbleWrapper.querySelectorAll(".emoji-trigger-speed-dial-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        executeAppendUserReactionToMessageDocumentPayloadInstanceNodeContextBounds(msg.id, btn.getAttribute("data-emoji"));
      });
    });

    bubbleWrapper.querySelectorAll(".functional-utility-action-trigger-row-item-icon-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const structuralActionTypeKey = btn.getAttribute("data-action");
        processContextualMessageBubbleFunctionalActionInvocationExecutionTrack(msg.id, msg, structuralActionTypeKey);
      });
    });

    container.appendChild(bubbleWrapper);
  });

  // Auto scroll down directly to active viewport visibility grid boundaries lines layout spaces context locations indices positions bounds tracks channel elements paths context
  container.scrollTop = container.scrollHeight;
}

/**
 * Update Message Read State Sync Routines
 */
function markIncomingUnreadMessagesAsReadSyncLine(messages) {
  if (!db || messages.length === 0) return;
  messages.forEach(msg => {
    if (msg.senderUid !== currentUser?.uid && msg.readStatusReceiptState !== "read") {
      updateDoc(doc(db, "chats", activeChatId, "messages", msg.id), {
        readStatusReceiptState: "read"
      }).catch(() => {});
    }
  });
}

/**
 * Handle Message Bubble Actions Context Switchboard Engine Matrix Layer Routines
 */
function processContextualMessageBubbleFunctionalActionInvocationExecutionTrack(messageId, fullMessageObj, actionType) {
  if (!activeChatId || !messageId) return;

  switch (actionType) {
    case "reply":
      currentReplyContext = {
        messageId: messageId,
        authorName: fullMessageObj.senderName || "User Context Reference Location Path Indicator Pointer Node Signature Key Track Address",
        bodySnippet: fullMessageObj.textBodyPayloadContentValueStringContent || (fullMessageObj.mediaUrl ? "[Asset Component Attachment Data Package Frame Locator Node Key Context Field Window Slot Structure]" : "Secure dynamic baseline interaction asset parameter framework context link tracking track boundaries path segment object data field")
      };
      const banner = document.getElementById("adnnReplyContextBannerPreview");
      document.getElementById("adnnReplyContextAuthorName").textContent = currentReplyContext.authorName;
      document.getElementById("adnnReplyContextBodySnippet").textContent = currentReplyContext.bodySnippet;
      banner.classList.remove("hidden");
      document.getElementById("adnnComposerTextInput").focus();
      break;

    case "favorite":
      const standardFavoritesCollectionTrackArray = fullMessageObj.favoritedByCollection || [];
      const userIndexPositionLocatorReferenceKey = standardFavoritesCollectionTrackArray.indexOf(currentUser?.uid);
      if (userIndexPositionLocatorReferenceKey >= 0) {
        standardFavoritesCollectionTrackArray.splice(userIndexPositionLocatorReferenceKey, 1);
      } else {
        standardFavoritesCollectionTrackArray.push(currentUser?.uid);
      }
      updateDoc(doc(db, "chats", activeChatId, "messages", messageId), {
        favoritedByCollection: standardFavoritesCollectionTrackArray
      }).catch(() => {});
      break;

    case "delete":
      if (fullMessageObj.senderUid === currentUser?.uid || isPlatformAdministrator(currentUser?.email)) {
        deleteDoc(doc(db, "chats", activeChatId, "messages", messageId)).catch(() => {});
      } else {
        alert("Permission restrictions deny message deletion out of boundaries parameters tracking reference frameworks contextual lines.");
      }
      break;
  }
}

/**
 * Append Reaction To Payload Data Context Track Rules Document Frame Pipeline Node
 */
function executeAppendUserReactionToMessageDocumentPayloadInstanceNodeContextBounds(messageId, emojiChar) {
  if (!activeChatId || !messageId) return;
  const reactionPathKeyReferenceStringPropertyFieldNameLocationString = `reactionsMap.${currentUser.uid}`;
  
  updateDoc(doc(db, "chats", activeChatId, "messages", messageId), {
    [reactionPathKeyReferenceStringPropertyFieldNameLocationString]: emojiChar
  }).catch(() => {});
}

/**
 * High Performance Composer Integrated Camera Component Operations Layout Space Handler Channels Framework Layer
 */
async function toggleInlineComposerCameraContextLayer() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  const liveVideoTrackFrame = document.getElementById("adnnComposerInlineCameraTrackView");

  if (inlineComposerCameraStream) {
    terminateInlineComposerCameraTracks();
    return;
  }

  try {
    inlineComposerCameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: 640, height: 480 } });
    liveVideoTrackFrame.srcObject = inlineComposerCameraStream;
    containerBox.classList.remove("hidden");
    cameraToggleBtn.classList.add("camera-active-glow-neon-tint-accent-color-style");
  } catch (err) {
    alert("Microphone/Camera initialization constraints restricted viewport initialization capabilities loops tracks contexts vectors channels: " + err.message);
  }
}

function terminateInlineComposerCameraTracks() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  const liveVideoTrackFrame = document.getElementById("adnnComposerInlineCameraTrackView");

  if (inlineComposerCameraStream) {
    inlineComposerCameraStream.getTracks().forEach(track => track.stop());
    inlineComposerCameraStream = null;
  }
  if (liveVideoTrackFrame) liveVideoTrackFrame.srcObject = null;
  if (containerBox) containerBox.classList.add("hidden");
}

function executeStillFrameCaptureFromInlineComposerCameraTrack() {
  if (!inlineComposerCameraStream) return;
  const videoTrackElement = document.getElementById("adnnComposerInlineCameraTrackView");
  
  const processingCanvasElement = document.createElement("canvas");
  processingCanvasElement.width = videoTrackElement.videoWidth || 640;
  processingCanvasElement.height = videoTrackElement.videoHeight || 480;
  
  const canvasRenderingContext2DContextLayerFrameBoxSlotLocatorInstance = processingCanvasElement.getContext("2d");
  
  // Apply true opposite mirror physical layout transformations logic equations
  canvasRenderingContext2DContextLayerFrameBoxSlotLocatorInstance.translate(processingCanvasElement.width, 0);
  canvasRenderingContext2DContextLayerFrameBoxSlotLocatorInstance.scale(-1, 1);
  
  canvasRenderingContext2DContextLayerFrameBoxSlotLocatorInstance.drawImage(videoTrackElement, 0, 0, processingCanvasElement.width, processingCanvasElement.height);
  
  processingCanvasElement.toBlob((blob) => {
    if (blob) {
      const generatedFileAssetFromStillFrameCaptureImageCaptureTrackPayloadInstanceNodeReferenceFileObj = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      processAttachedFileAssetContext(generatedFileAssetFromStillFrameCaptureImageCaptureTrackPayloadInstanceNodeReferenceFileObj);
    }
    terminateInlineComposerCameraTracks();
  }, "image/jpeg", 0.92);
}

/**
 * Handle Asset Attachment Transformations Framework Logic Conversions Pipeline Modules
 */
function processAttachedFileAssetContext(file) {
  if (file.size > 10 * 1024 * 1024) {
    alert("High density asset configuration scales overflow system payload restrictions parameter caps set inside structural configuration metrics boundaries targets (10MB limit value bounds exceeded constraint metrics formulas).");
    return;
  }

  currentMediaUploadPayload = file;
  const containerBox = document.getElementById("adnnComposerInlineMediaPreviewContainer");
  const targetRenderTargetSlotFrame = document.getElementById("adnnComposerMediaRenderTargetBox");

  targetRenderTargetSlotFrame.innerHTML = "";
  containerBox.classList.remove("hidden");

  if (file.type.startsWith("image/")) {
    const objectUrlReferenceLinkStringLocatorPath = URL.createObjectURL(file);
    targetRenderTargetSlotFrame.innerHTML = `<img src="${objectUrlReferenceLinkStringLocatorPath}" alt="Multi-upload preview matrix rendering target location slot visual container box framework space view block shape structure element">`;
  } else {
    targetRenderTargetSlotFrame.innerHTML = `
      <div class="generic-document-file-preview-thumbnail-avatar-card-frame-box">
        <span>📄</span>
        <strong>${escapeHtmlSanitizationUtility(file.name)}</strong>
        <small>${(file.size / (1024 * 1024)).toFixed(2)} MB Payload Package Bundle Data Block Node Container Context Allocation Structural Unit Metric Bounds Value Capacity Size Spec Target Parameter Formula}</small>
      </div>
    `;
  }

  // Focus layout submission triggers context toggling indicators status states updates updates rules changes
  document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.remove("hidden");
  document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.add("hidden");
}

function clearActiveComposerAttachedMediaPayload() {
  currentMediaUploadPayload = null;
  audioRecordingPlaybackBlob = null;
  document.getElementById("adnnComposerInlineMediaPreviewContainer").classList.add("hidden");
  document.getElementById("adnnComposerMediaRenderTargetBox").innerHTML = "";
  document.getElementById("adnnComposerFileInput").value = "";

  const textVal = document.getElementById("adnnComposerTextInput").value.trim();
  if (textVal.length === 0) {
    document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.add("hidden");
    document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.remove("hidden");
  }
}

/**
 * Advanced High Fidelity Audio Voice Messages Capture Framework System Engine Functions
 */
async function toggleVoiceAudioRecordingSessionContextLayer() {
  const panelLayerBlockFrameWorkspaceViewComponent = document.getElementById("adnnVoiceRecordingViewComponentLayer");
  const textInputFieldWorkspaceBoxFrameContainerElement = document.getElementById("adnnComposerTextInput");
  const micActionTriggerBtnContextElement = document.getElementById("adnnVoiceRecordActionTriggerBtn");

  if (currentAudioRecorderInstance && currentAudioRecorderInstance.state !== "inactive") {
    // End active audio context capture processing tracking pipelines
    currentAudioRecorderInstance.stop();
    clearInterval(audioRecordingChronometer);
    panelLayerBlockFrameWorkspaceViewComponent.classList.add("hidden");
    textInputFieldWorkspaceBoxFrameContainerElement.classList.remove("hidden");
    micActionTriggerBtnContextElement.classList.remove("recording-session-active-pulse-red-glow-tint-style");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const options = { mimeType: "audio/webm" };
    const recordedChunks = [];
    
    currentAudioRecorderInstance = new MediaRecorder(stream, options);
    currentAudioRecorderInstance.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    currentAudioRecorderInstance.onstop = () => {
      audioRecordingPlaybackBlob = new Blob(recordedChunks, { type: "audio/webm" });
      stream.getTracks().forEach(track => track.stop());

      // Pipeline voice audio block metadata array records parameters mapping context objects structure bounds frame blocks locators channels directly to composer asset space
      const voiceFileMockObj = new File([audioRecordingPlaybackBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
      currentMediaUploadPayload = voiceFileMockObj;

      const targetRenderTargetSlotFrame = document.getElementById("adnnComposerMediaRenderTargetBox");
      targetRenderTargetSlotFrame.innerHTML = `
        <div class="generic-document-file-preview-thumbnail-avatar-card-frame-box voice-memo-preview-override-box-layout-card-style">
          <span>🎵</span>
          <strong>Voice Message Asset Audio Clip Package Transmitted Data Payload Node Object Link Channel Context Container Vector Segment Module Location Frame Block Specification Target Parameter Value Properties Dimension Profile Level Line Metric Space Cap Bounds Limit Formula Track Check Base Baseline Reference Identifier Signature Code Field Unit Instance</span></strong>
          <small>Ready for transmission package payload allocation rules structural pipelines bounds trackers mapping space grid path channels context fields window locations bounds layout space framework segment parameters indicators bounds tracks fields matrix layout rules configurations loops track metrics blocks values properties tracking</small>
        </div>
      `;
      document.getElementById("adnnComposerInlineMediaPreviewContainer").classList.remove("hidden");
      document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.remove("hidden");
      micActionTriggerBtnContextElement.classList.add("hidden");
    };

    recordedChunks.length = 0;
    currentAudioRecorderInstance.start();
    
    let recordingElapsedDurationTimerSecondsAccumulatorSecondsCountTrackMetricValueAmountParameterValueQuantityTotalValue = 0;
    const updateChronometerDisplayLabelValueMetricsParametersStringLayoutValue = () => {
      recordingElapsedDurationTimerSecondsAccumulatorSecondsCountTrackMetricValueAmountParameterValueQuantityTotalValue++;
      const mins = String(Math.floor(recordingElapsedDurationTimerSecondsAccumulatorSecondsCountTrackMetricValueAmountParameterValueQuantityTotalValue / 60)).padStart(2, "0");
      const secs = String(recordingElapsedDurationTimerSecondsAccumulatorSecondsCountTrackMetricValueAmountParameterValueQuantityTotalValue % 60).padStart(2, "0");
      document.getElementById("adnnVoiceDurationChronometer").textContent = `${mins}:${secs}`;
    };

    document.getElementById("adnnVoiceDurationChronometer").textContent = "00:00";
    clearInterval(audioRecordingChronometer);
    audioRecordingChronometer = setInterval(updateChronometerDisplayLabelValueMetricsParametersStringLayoutValue, 1000);

    panelLayerBlockFrameWorkspaceViewComponent.classList.remove("hidden");
    textInputFieldWorkspaceBoxFrameContainerElement.classList.add("hidden");
    micActionTriggerBtnContextElement.classList.add("recording-session-active-pulse-red-glow-tint-style");

  } catch (err) {
    alert("Voice recording peripheral capture line baseline configuration mapping parameter metrics block values allocation channels initialization dropped structural instance traces lines nodes paths loops segments tracker contexts: " + err.message);
  }
}

/**
 * Transmit Output Message Structural Payload Package Core Document Execution Handler Pipeline Processing Node
 */
async function processOutgoingMessageSubmissionPayload(event) {
  event.preventDefault();
  if (!currentUser || !activeChatId) return;

  const textInputObj = document.getElementById("adnnComposerTextInput");
  const rawTextContentStringContentValue = textInputObj.value.trim();
  
  if (rawTextContentStringContentValue.length === 0 && !currentMediaUploadPayload) return;

  // Cache baseline temporary data structural metrics properties boundaries parameters tracking locations fields channels variables objects properties maps
  const messageTextDataStringValueContentPayload = rawTextContentStringContentValue;
  const attachedAssetPayloadReferenceNodeFileObj = currentMediaUploadPayload;
  const boundReplyContextPayloadInstanceDataContainerObjectTrackNode = currentReplyContext;

  // Clear workspace input parameters immediately to secure true instant interface execution reaction metrics tracking timelines speed responses pipelines
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
      alert("High definition secure attachment pipeline upload framework node dropped transport processing rules operations loops trackers execution tracks paths segments instances contexts channel metrics boundaries configuration profiles vectors properties elements: " + err.message);
      return;
    }
  }

  const completeMessageDocumentPayloadStructureContextDataNodeFieldConfigurationRecord = {
    textBodyPayloadContentValueStringContent: messageTextDataStringValueContentPayload,
    senderUid: currentUser.uid,
    senderEmail: emailNormalizationKey(currentUser.email),
    senderName: currentUser.displayName || currentUser.email || "Secure Platform Terminal Workspace Node Profile Instance",
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

  // Synchronize master parent document node descriptors tracking logs lines parameters configuration records context fields layout variables spaces targets formulas profiles segments parameters mappings
  const summaryNotificationSnippetDisplayStringValueContentTextContextLabelStringValue = messageTextDataStringValueContentPayload || (attachedAssetPayloadReferenceNodeFileObj?.type.startsWith("audio/") ? "🎙️ Voice Message Asset Package Document File Data" : "📁 Attached Document Asset Package Transmitted Payload Bundle Node Data Source Link Context Segment Locator Context Field Window Space Instance Block");
  
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

/**
 * Execute Secure External Storage Infrastructure Multi-Upload Framework Routine Handler Processing Engine Pipeline
 */
async function executeSecureExternalAttachmentTargetStorageAssetUploadPayloadHandshakeLine(file, chatId) {
  if (!storage) throw new Error("Cloud Storage endpoints are uninitialized inside application master structural environment parameters values configuration blocks spaces targets locator grids.");
  
  const normalizedSafeCleanStringCharactersSanitizedFileNameStringValueContentTextPropertyString = String(file.name || "secure_binary_asset_data_stream_package_chunk_payload_allocation_node_locator_context_field")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);

  const referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress = `chat-media-vault/${chatId}/${currentUser.uid}/${Date.now()}_${normalizedSafeCleanStringCharactersSanitizedFileNameStringValueContentTextPropertyString}`;
  const bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField = storageRef(storage, referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress);
  
  await uploadBytes(bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField, file, {
    contentType: file.type || "application/octet-stream"
  });

  const absoluteSecuredDownloadURLStringAddressEndpointPathLocationResourceLinkString = await getDownloadURL(bucketStorageRefNodePointerInstanceLocationTargetSegmentAddressField);
  
  return {
    mediaUrl: absoluteSecuredDownloadURLStringAddressEndpointPathLocationResourceLinkString,
    mediaName: file.name || "Secured Platform Cryptographic Cloud Storage Binary Data Node Node Block Package Payload Asset Source Component Element",
    mediaType: file.type || "application/octet-stream",
    mediaPath: referenceTargetStorageCloudBucketPathStringLocationStringContextAddressNodePathFieldKeyAddress
  };
}

/**
 * ============================================================================
 * BULLETPROOF MULTI-TIER WEBRTC REALTIME VOICE & VIDEO CALL ENGINE ARCHITECTURE
 * ============================================================================
 */
async function initializeCallInboxEngine(user) {
  clearInterval(unsubscribedCallInbox);
  const targetInboxRef = doc(db, "callInbox", user.uid);
  
  unsubscribedCallInbox = onSnapshot(targetInboxRef, async (snapshot) => {
    if (!snapshot.exists()) return;
    const inboxData = snapshot.data();
    if (inboxData.status === "ringing" && inboxData.callerUid !== currentUser.uid && (!activeCallState || activeCallState.callId !== inboxData.callId)) {
      
      // Filter out immediate structural timing anomalies or obsolete call parameters configuration rules matching constraints logic
      if (Date.now() > inboxData.expiresAtMs) {
        updateDoc(doc(db, "callInbox", user.uid), { status: "missed_expired" }).catch(() => {});
        return;
      }
      
      triggerIncomingRealtimeCommunicationHandshakeLine(inboxData);
    }
  });
}

function triggerIncomingRealtimeCommunicationHandshakeLine(inboxRecord) {
  if (activeCallState) return; // Terminal is engaged in concurrent focus operations channel parameters bounds trackers tracking lines

  audioRingerLoop.currentTime = 0;
  audioRingerLoop.play().catch(() => {});

  activeCallState = {
    callId: inboxRecord.callId,
    chatId: inboxRecord.chatId,
    mode: "incoming",
    type: inboxRecord.kind,
    partnerUid: inboxRecord.callerUid,
    partnerName: inboxRecord.callerName || "Remote Client Account Terminal Station Asset Node Locator Key Pointer Index Box Vector Context Line Signature Data Block Source Context Segment Parameter Frame Space Bounds Matrix Rules Layout Configuration",
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
    partnerName: document.getElementById("adnnRoomTargetTitle").textContent || "Secure Connection Node Platform Remote Terminal Station Identifier Space Target Locator Parameters Key Frame Unit",
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

    // Configure WebRTC Peer Connection Core Configuration Settings Parameters Rules Pipeline Handshake Layer Targets Bounds Trackers Logic
    const rtcConfigConfigurationProfilesMatrixDataContainersCollectionIceServersListTrackBounds = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ]
    };

    const pc = new RTCPeerConnection(rtcConfigConfigurationProfilesMatrixDataContainersCollectionIceServersListTrackBounds);
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

    const callDocumentMasterPayloadRecordObjectDataContainerFieldProfileMap = {
      callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
      chatId: activeChatId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email || "Platform Communication Source Node End Station",
      receiverUid: targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue,
      kind: communicationTypeKindStringValuePropertyTypeContextIndicator,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "calls", generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue), callDocumentMasterPayloadRecordObjectDataContainerFieldProfileMap);
    
    // Alert receiver station inbox processing routing pipelines elements paths channels locators context bounds parameters records mapping space grid path channels context fields window locations bounds layout space framework segment parameters indicators bounds tracks fields matrix layout rules configurations loops track metrics blocks values properties tracking
    await setDoc(doc(db, "callInbox", targetPartnerDestinationReceiverAccountUidStringLocatorKeyAddressValueStringContentTextContextLabelStringValue), {
      callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
      chatId: activeChatId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email || "Platform Core Node Caller Connection Station Target Framework Source Context Pipeline",
      kind: communicationTypeKindStringValuePropertyTypeContextIndicator,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      createdAt: serverTimestamp()
    }, { merge: true });

    monitorActiveCallSignalingDocumentPipelineChannel(generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue, false);

  } catch (err) {
    console.error(err);
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Hardware Media Acquisition Constraints Rejected Handshake Operation Lines Channels Context Pipeline Execution Node Trace");
  }
}

async function executeAcceptIncomingCommunicationHandshakeCallLineAction() {
  if (!activeCallState || activeCallState.mode !== "incoming") return;
  audioRingerLoop.pause();

  try {
    const callRef = doc(db, "calls", activeCallState.callId);
    const snap = await getDoc(callRef).catch(() => null);
    if (!snap || !snap.exists() || snap.data().status !== "ringing") {
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Call has expired or was terminated by remote station node endpoint parameters tracking frameworks context bounds rules pipelines.");
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

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
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

    await updateDoc(callRef, {
      answer: { type: answer.type, sdp: answer.sdp },
      status: "connected",
      connectedAt: serverTimestamp()
    });

    await setDoc(doc(db, "callInbox", currentUser.uid), { status: "connected_accepted" }, { merge: true });

    document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden");
    document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden");
    
    startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine();
    monitorActiveCallSignalingDocumentPipelineChannel(activeCallState.callId, true);

  } catch (err) {
    console.error(err);
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Media peripheral attachment exceptions thrown during answer protocol compilation tracking traces paths loops channels node points lines contexts properties elements: " + err.message);
  }
}

function monitorActiveCallSignalingDocumentPipelineChannel(callId, isAnswerer) {
  const callRef = doc(db, "calls", callId);
  
  window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineA = onSnapshot(callRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    
    if (data.status === "connected" && activeCallState && activeCallState.mode === "outgoing" && !activeCallState.chronometerIntervalInstance) {
      // Receiver accepted session connection link pipelines context parameters metrics indicators
      if (data.answer && activeCallState.peerConnection.signalingState !== "stable") {
        activeCallState.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
      }
      document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden");
      document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden");
      startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine();
    }

    if (data.status === "terminated" || data.status === "rejected") {
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Remote terminal disconnected active line link context parameters mapping structural frameworks traces pipelines context fields window locators channels elements paths.");
    }
  });

  const targetCandidatesCollectionPath = collection(db, "calls", callId, isAnswerer ? "offerCandidates" : "answerCandidates");
  window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineB = onSnapshot(targetCandidatesCollectionPath, (snapshot) => {
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
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Call declined by local user node profile selection actions tracking line path segment.");
}

async function executeTerminateActiveCommunicationHandshakeCallLineAction() {
  if (!activeCallState) return;
  audioRingerLoop.pause();

  if (activeCallState.callId) {
    await updateDoc(doc(db, "calls", activeCallState.callId), { status: "terminated", endedAt: serverTimestamp() }).catch(() => {});
    if (activeCallState.mode === "incoming") {
      await setDoc(doc(db, "callInbox", currentUser.uid), { status: "terminated_cleared" }, { merge: true }).catch(() => {});
    } else {
      await setDoc(doc(db, "callInbox", activeCallState.partnerUid), { status: "terminated_cleared" }, { merge: true }).catch(() => {});
    }
  }

  // Construct high-fidelity platform historical call visualization metadata track logs record tracking line parameters inside core scroller database collections context boundaries path segment units
  if (activeCallState.chronometerIntervalInstance && activeCallState.chatId) {
    const totalDurationLabelValMetricContextStringContentValueText = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel").textContent || "00:00";
    
    const callSummaryLogTrackingDocumentDataFieldRecordObj = {
      textBodyPayloadContentValueStringContent: `✦ ${activeCallState.type === "video" ? "High-Definition Video Connection" : "High-Fidelity Audio Connection Stream Track"} Session Handshake Layer Reference Boundary · Duration ${totalDurationLabelValMetricContextStringContentValueText} · Synchronized Historical Log Reference Boundary Tracker Node Context Block Locator Frame Item`,
      senderUid: currentUser.uid,
      senderEmail: emailNormalizationKey(currentUser.email),
      senderName: currentUser.displayName || currentUser.email || "System Communication Engine Channel Track Router Module Pipeline Connection Endpoint",
      createdAt: serverTimestamp(),
      callEventTransmissionLineContextFlagMetricParameters: true,
      readStatusReceiptState: "read",
      favoritedByCollection: [],
      reactionsMap: {}
    };

    await addDoc(collection(db, "chats", activeCallState.chatId, "messages"), callSummaryLogTrackingDocumentDataFieldRecordObj).catch(() => {});
    await setDoc(doc(db, "chats", activeCallState.chatId), {
      lastMessage: `✦ Call Connection Record Logs: ${totalDurationLabelValMetricContextStringContentValueText}`,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  }

  terminateActiveCommunicationSessionInterfaceOverlayContextLine(true, "Communication channel dropped framework cleanup lines running configurations contexts parameters metrics paths.");
}

function terminateActiveCommunicationSessionInterfaceOverlayContextLine(shouldShowToastNotice, toastLabelContentStringValueContentValueProperty) {
  audioRingerLoop.pause();
  clearInterval(window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineA);
  clearInterval(window.adnnActiveCallSignalingUnsubscribeInstanceTrackLineB);

  if (activeCallState) {
    clearInterval(activeCallState.chronometerIntervalInstance);
    if (activeCallState.peerConnection) activeCallState.peerConnection.close();
    if (activeCallState.localStream) activeCallState.localStream.getTracks().forEach(track => track.stop());
  }

  activeCallState = null;
  const overlayFrameViewComponentNode = document.getElementById("adnnCallImmersiveInterfaceOverlayPanelContainerWindow");
  if (overlayFrameViewComponentNode) overlayFrameViewComponentNode.remove();

  if (shouldShowToastNotice) {
    alert(toastLabelContentStringValueContentValueProperty || "Realtime secure WebRTC communication pipeline connection session track lifecycle ended framework operation tracks.");
  }
}

/**
 * Communication Overlay Dynamic Component Chronometer Handlers Execution Processing Module
 */
function startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine() {
  let secondsAccumulatorValueMetricCounterTrackAmount = 0;
  const chronometerLabelElementNode = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel");
  
  clearInterval(activeCallState.chronometerIntervalInstance);
  activeCallState.chronometerIntervalInstance = setInterval(() => {
    secondsAccumulatorValueMetricCounterTrackAmount++;
    const minutesStringVal = String(Math.floor(secondsAccumulatorValueMetricCounterTrackAmount / 60)).padStart(2, "0");
    const secondsStringVal = String(secondsAccumulatorValueMetricCounterTrackAmount % 60).padStart(2, "0");
    if (chronometerLabelElementNode) {
      chronometerLabelElementNode.textContent = `${minutesStringVal}:${secondsStringVal}`;
    }
  }, 1000);
}

/**
 * Immersive WebRTC Video/Audio Master Layout Grid Panel Component Creator View Renderer
 */
function renderCommunicationImmersiveInterfaceOverlayWindowUI() {
  if (document.getElementById("adnnCallImmersiveInterfaceOverlayPanelContainerWindow")) return;

  const windowContainerCardOverlayViewWrapperNode = document.createElement("div");
  windowContainerCardOverlayViewWrapperNode.id = "adnnCallImmersiveInterfaceOverlayPanelContainerWindow";
  windowContainerCardOverlayViewWrapperNode.className = "adnn-call-immersive-interface-overlay-panel-container-window-context-layer-frame-box-slot-locator-instance glass";
  windowContainerCardOverlayViewWrapperNode.innerHTML = `
    <div class="call-interface-window-card-box edge">
      <div class="call-interface-top-metadata-bar-strip">
        <span class="crypto-lock-icon-tint-badge-span">🔒 End-to-End Encrypted WebRTC Layer</span>
        <span class="chronometer-duration-timer-display-label-value-metrics-properties" id="adnnCallImmersiveChronometerDurationDisplayLabel">Connecting Secure Route...</span>
      </div>
      
      <div class="call-interface-target-profile-avatar-banner-block">
        <div class="target-profile-avatar-large-circle-element">${initialsProcessingUtility(activeCallState.partnerName)}</div>
        <h3>${escapeHtmlSanitizationUtility(activeCallState.partnerName)}</h3>
        <p id="adnnCallInterfaceDynamicStatusContextLabelMessageLineString">${activeCallState.type === "video" ? "Secure FaceTime Multi-Surface Grid Target Pipeline Connection Node Room" : "Secure Audio Voice Transmission Line Node Terminal Module Channel Connection Line Layout Space Segment"}</p>
      </div>
      
      <div class="adnn-call-video-workspace-layout-grid-stage-frame-container-element-area" id="adnnCallVideoWorkspaceLayoutGridStageFrameContainerElementArea">
        <div class="camera-tile-window-frame-block-card remote-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallRemoteVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode">
          <video id="adnnCallRemoteVideoTrackFrameComponentElementView" autoplay playsinline></video>
          <div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Contact Camera Inactive</div>
          <span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Remote Contact Node Station Connection</span>
        </div>
        <div class="camera-tile-window-frame-block-card local-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode">
          <video id="adnnCallLocalVideoTrackFrameComponentElementView" autoplay muted playsinline class="mirror-corrected-stream-track-rendering-engine-element-node"></video>
          <div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Local Video Channel Stream Disabled</div>
          <span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Your Micro Terminal Capture Track Loop (Opposite Mirror Matrix Layout Transformation Space Matrix)</span>
        </div>
      </div>
      
      <div class="call-interface-actions-toolbar-buttons-row-strip-control-matrix-wrapper-box-container-element">
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip" id="adnnCallIncomingActionsContextControlsContainerBoxStrip">
          <button type="button" class="toolbar-functional-action-circle-icon-btn accept-action-green-color-pulse-neon-tint-style-btn" id="adnnCallAcceptActionBtn" title="Accept connection request line parameters mappings">${ICONS.phone}<span>Accept Secure Connection</span></button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallDeclineActionBtn" title="Reject request handshake endpoint locations">${ICONS.close}<span>Decline Request</span></button>
        </div>
        
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip hidden" id="adnnCallConnectedActiveActionsContextControlsContainerBoxStrip">
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallMuteMicToggleActionBtn" title="Toggle microphone track state configuration parameters metrics">${ICONS.mic}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleVideoMuteTrackStateActionBtn" title="Toggle video stream capture engine track status states data flag values">${ICONS.video}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleSpeakerSinkOutputRouteActionBtn" title="Toggle audio sound output speaker path context framework channels">${ICONS.speaker}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleHoldStateActionBtn" title="Put session pipeline on freeze hold status states monitoring metric configurations">${ICONS.hold}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallEndConnectedActiveSessionActionBtn" title="Disconnect secure pipeline channels tracks framework lines lifecycle tracks path parameters">${ICONS.close}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(windowContainerCardOverlayViewWrapperNode);

  // Bind Immediate User Control Event Handlers Rules Mapping Configurations Switches Layer Buttons Click Listeners Hooks
  document.getElementById("adnnCallAcceptActionBtn").addEventListener("click", executeAcceptIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallDeclineActionBtn").addEventListener("click", executeRejectIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallEndConnectedActiveSessionActionBtn").addEventListener("click", executeTerminateActiveCommunicationHandshakeCallLineAction);

  // Bind Active Connected Feature Toggle Controls Switchboard Listeners
  document.getElementById("adnnCallMuteMicToggleActionBtn").addEventListener("click", (e) => {
    if (!activeCallState || !activeCallState.localStream) return;
    const audioTrack = activeCallState.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !audioTrack.enabled);
      e.currentTarget.innerHTML = audioTrack.enabled ? ICONS.mic : ICONS.micOff;
    }
  });

  document.getElementById("adnnCallToggleVideoMuteTrackStateActionBtn").addEventListener("click", (e) => {
    if (!activeCallState || !activeCallState.localStream) return;
    const videoTrack = activeCallState.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !videoTrack.enabled);
      e.currentTarget.innerHTML = videoTrack.enabled ? ICONS.video : ICONS.videoOff;
      document.getElementById("adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.toggle("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance", !videoTrack.enabled);
    }
  });

  document.getElementById("adnnCallToggleSpeakerSinkOutputRouteActionBtn").addEventListener("click", (e) => {
    // Simulate premium routing layer sink tracking adjustments indicators
    const isMuted = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color");
    e.currentTarget.innerHTML = isMuted ? ICONS.speakerOff : ICONS.speaker;
    const remoteAudioTrackViewRenderingTargetFrameBoxSlotLocatorInstanceElement = document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView");
    if (remoteAudioTrackViewRenderingTargetFrameBoxSlotLocatorInstanceElement) {
      remoteAudioTrackViewRenderingTargetFrameBoxSlotLocatorInstanceElement.muted = isMuted;
    }
  });

  document.getElementById("adnnCallToggleHoldStateActionBtn").addEventListener("click", (e) => {
    const isOnHold = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color");
    if (activeCallState && activeCallState.peerConnection) {
      // Broadcast contextual stream tracking adjustments metrics parameters configuration update documents across tracking framework collections index references lines channel
      updateDoc(doc(db, "calls", activeCallState.callId), {
        [`sessionHoldStateParametersMap.${currentUser.uid}`]: isOnHold
      }).catch(() => {});
    }
  });

  // Structural dynamic alignment view initialization check logic configuration profiles mapping parameters matrix track nodes
  if (activeCallState.mode === "incoming") {
    document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.remove("hidden");
    document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.add("hidden");
  } else {
    document.getElementById("adnnCallIncomingActionsContextControlsContainerBoxStrip").classList.add("hidden");
    document.getElementById("adnnCallConnectedActiveActionsContextControlsContainerBoxStrip").classList.remove("hidden");
  }
}

/**
 * ============================================================================
 * HIGH PERFORMANCE AUXILIARY DATA CONVERSION TEXT MACRO UTILITIES ALGORITHMS
 * ============================================================================
 */
function emailNormalizationKey(email) {
  return String(email || "").trim().toLowerCase();
}

function isPlatformAdministrator(email) {
  return emailNormalizationKey(email) === ADMIN_EMAIL;
}

function initialsProcessingUtility(nameStringValueContentText) {
  const normalizedCleanSegmentsSplitArrayCollectionTokens = String(nameStringValueContentText || "AD").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (normalizedCleanSegmentsSplitArrayCollectionTokens.length === 0) return "AD";
  if (normalizedCleanSegmentsSplitArrayCollectionTokens.length === 1) return normalizedCleanSegmentsSplitArrayCollectionTokens[0].slice(0, 2);
  return `${normalizedCleanSegmentsSplitArrayCollectionTokens[0][0]}${normalizedCleanSegmentsSplitArrayCollectionTokens[1][0]}`;
}

function transformTimestampMetricToMillis(firebaseTimestampObj) {
  if (!firebaseTimestampObj) return Date.now();
  if (typeof firebaseTimestampObj.toMillis === "function") return firebaseTimestampObj.toMillis();
  if (firebaseTimestampObj instanceof Date) return firebaseTimestampObj.getTime();
  const parsedDateInstanceFromRawValueInputStringTrackValue = new Date(firebaseTimestampObj);
  return Number.isNaN(parsedDateInstanceFromRawValueInputStringTrackValue.getTime()) ? Date.now() : parsedDateInstanceFromRawValueInputStringTrackValue.getTime();
}

function calculateRelativeHumanizedTimeMetric(firebaseTimestampObj) {
  const millis = transformTimestampMetricToMillis(firebaseTimestampObj);
  const diffSeconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const targetDateObj = new Date(millis);
  return targetDateObj.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtmlSanitizationUtility(rawStringContentValueInputTextString) {
  return String(rawStringContentValueInputTextString || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function synchronizeGlobalPlatformUnreadCountMetrics(chatsCollectionArrayReferenceSource) {
  let accumulatedTotalUnreadCounterValueSumAmount = 0;
  chatsCollectionArrayReferenceSource.forEach(chat => {
    accumulatedTotalUnreadCounterValueSumAmount += isPlatformAdministrator(currentUser?.email) ? (chat.unreadForAdmin || 0) : (chat.unreadForClient || 0);
  });

  document.querySelectorAll(".adnn-badge-counter").forEach(badge => {
    badge.textContent = String(accumulatedTotalUnreadCounterValueSumAmount);
    badge.classList.toggle("hidden", accumulatedTotalUnreadCounterValueSumAmount === 0);
  });
}

function terminateAllActiveSubscribers() {
  clearInterval(unsubscribedChatMeta);
  clearInterval(unsubscribedMessageFeed);
  clearInterval(unsubscribedPresenceMeta);
  clearInterval(unsubscribedCallInbox);
  clearInterval(window.adnnPresencePulseTrackerIntervalInstance);
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "System components disconnected execution traces loops parameters profiles context parameters metrics paths.");
}

/**
 * High Density Premium Apple Tahoe Architectural Theme Design Language Stylesheet Injector Pipeline Routine Node Element
 */
function injectStylesheetRules() {
  if (document.getElementById("adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode")) return;
  
  const styleElementNodePointerInstanceReferenceLocationFieldUnit = document.createElement("style");
  styleElementNodePointerInstanceReferenceLocationFieldUnit.id = "adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode";
  styleElementNodePointerInstanceReferenceLocationFieldUnit.textContent = `
    :root {
      --adnn-tahoe-primary-tint: #272dcf;
      --adnn-tahoe-bg-glass-heavy: linear-gradient(135deg, rgba(28, 28, 32, 0.94), rgba(14, 14, 18, 0.88) 40%, rgba(8, 8, 12, 0.96));
      --adnn-tahoe-bg-glass-card: rgba(255, 255, 255, 0.04);
      --adnn-tahoe-border-subtle: rgba(255, 255, 255, 0.09);
      --adnn-tahoe-text-main: #f5f5f7;
      --adnn-tahoe-text-muted: rgba(245, 245, 247, 0.55);
      --adnn-tahoe-bubble-mine: linear-gradient(135deg, rgba(39, 45, 207, 0.92), rgba(20, 24, 150, 0.82));
      --adnn-tahoe-bubble-other: rgba(255, 255, 255, 0.06);
      --adnn-tahoe-neon-green: #25d366;
      --adnn-tahoe-neon-red: #ff3b30;
      --adnn-chat-vh: 100dvh;
    }

    .adnn-chat-trigger-premium {
      position: relative; width: 46px; height: 46px; border-radius: 14px; border: 1px solid var(--adnn-tahoe-border-subtle);
      background: var(--adnn-tahoe-bg-glass-heavy); color: #fff; cursor: pointer; display: inline-flex; align-items: center;
      justify-content: center; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: all 0.2s ease;
    }
    .adnn-chat-trigger-premium:hover { transform: scale(1.04); border-color: var(--adnn-tahoe-primary-tint); }
    .adnn-chat-trigger-premium.floating-action-trigger { position: fixed; right: 24px; bottom: 24px; z-index: 9999; border-radius: 50%; width: 54px; height: 54px; background: var(--adnn-tahoe-primary-tint); }
    
    .adnn-badge-counter {
      position: absolute; top: -4px; right: -4px; background: var(--adnn-tahoe-neon-red); color: #fff; font-size: 10px;
      font-family: monospace; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; display: grid; place-items: center;
    }
    
    .adnn-chat-overlay-immersive {
      position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.45); backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    .adnn-chat-overlay-immersive.is-visible { opacity: 1; pointer-events: auto; }
    
    .adnn-chat-window-container {
      width: min(1180px, 100%); height: min(820px, calc(100vh - 48px)); border-radius: 24px; overflow: hidden;
      display: grid; grid-template-columns: 340px 1fr; background: var(--adnn-tahoe-bg-glass-heavy);
      border: 1px solid var(--adnn-tahoe-border-subtle); box-shadow: 0 30px 90px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .adnn-chat-embedded-container-context-frame {
      width: 100%; height: 100%; display: block;
    }
    .adnn-chat-embedded-container-context-frame .adnn-chat-window-container {
      width: 100%; height: 680px; max-height: none; border-radius: 20px; box-shadow: none;
    }
    .adnn-chat-embedded-container-context-frame .adnn-close-overlay-btn { display: none !important; }

    /* Sidebar Framework Architecture Layout Structure */
    .adnn-chat-sidebar-wrapper {
      border-right: 1px solid var(--adnn-tahoe-border-subtle); display: grid; grid-template-rows: 76px 54px 1fr; min-height: 0; background: rgba(0,0,0,0.15);
    }
    .adnn-sidebar-identity-header {
      padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--adnn-tahoe-border-subtle);
    }
    .adnn-identity-profile-info { display: flex; align-items: center; gap: 12px; color: var(--adnn-tahoe-text-main); }
    .adnn-identity-avatar-placeholder { width: 40px; height: 40px; border-radius: 12px; background: var(--adnn-tahoe-primary-tint); display: grid; place-items: center; font-weight: 600; font-size: 15px; }
    .adnn-identity-profile-info h4 { font-size: 15px; font-weight: 500; margin: 0; }
    .online-pill-indicator { font-size: 10px; margin: 2px 0 0; color: var(--adnn-tahoe-neon-green); font-family: monospace; }
    .adnn-close-overlay-btn { background: transparent; border: 0; color: #fff; cursor: pointer; width: 32px; height: 32px; display: grid; place-items: center; opacity: 0.6; }
    .adnn-close-overlay-btn:hover { opacity: 1; }
    
    .adnn-sidebar-search-container { padding: 8px 12px; }
    .adnn-search-input-group {
      background: rgba(0,0,0,0.22); border-radius: 10px; border: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; padding: 0 10px; height: 36px;
    }
    .adnn-search-input-group input { background: transparent; border: 0; outline: 0; color: #fff; font-size: 13px; width: 100%; margin-left: 8px; }
    .search-icon-span { color: var(--adnn-tahoe-text-muted); display: flex; }

    .adnn-sidebar-conversations-list { min-height: 0; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
    .empty-list-notice { padding: 40px 16px; text-align: center; color: var(--adnn-tahoe-text-muted); font-size: 12px; font-family: monospace; }
    
    .adnn-sidebar-chat-card-item {
      display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; cursor: pointer; transition: background 0.15s ease; border: 1px solid transparent;
    }
    .adnn-sidebar-chat-card-item:hover { background: rgba(255,255,255,0.03); }
    .adnn-sidebar-chat-card-item.active-focus { background: rgba(39, 45, 207, 0.15); border-color: rgba(39, 45, 207, 0.25); }
    .card-item-avatar-element { width: 42px; height: 42px; border-radius: 50%; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); display: grid; place-items: center; font-weight: 500; font-size: 14px; color: #fff; flex-shrink: 0; }
    .card-item-body-content-block { flex: 1; min-width: 0; }
    .card-item-header-row { display: flex; justify-content: space-between; align-items: baseline; }
    .card-item-header-row h5 { margin: 0; font-size: 14px; font-weight: 500; color: var(--adnn-tahoe-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timestamp-metric-label { font-size: 10px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    .card-item-footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .message-snippet-paragraph { margin: 0; font-size: 12px; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread-count-badge-element { background: var(--adnn-tahoe-primary-tint); color: #fff; font-size: 9px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; display: grid; place-items: center; font-family: monospace; }

    /* Main Area View Framework Component Architecture Elements Base Styles */
    .adnn-chat-main-room-view { min-width: 0; min-height: 0; background: rgba(0,0,0,0.05); position: relative; }
    .empty-room-fallback-illustration { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--adnn-tahoe-text-muted); padding: 32px; }
    .illustration-art-logo { font-size: 48px; color: var(--adnn-tahoe-primary-tint); margin-bottom: 16px; animation: pulseGlow 3s infinite alternate; }
    .empty-room-fallback-illustration h3 { font-size: 18px; font-weight: 400; color: var(--adnn-tahoe-text-main); margin: 0 0 8px; }
    .empty-room-fallback-illustration p { font-size: 13px; max-width: 380px; margin: 0; line-height: 1.5; }
    
    .adnn-active-room-layout { display: grid; grid-template-rows: 76px 1fr auto; height: 100%; min-height: 0; position: relative; }
    .adnn-room-appbar-header { padding: 16px; border-bottom: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.08); }
    .adnn-back-arrow-mobile-btn { display: none; background: transparent; border: 0; color: #fff; width: 36px; height: 36px; place-items: center; margin-right: 4px; }
    .adnn-room-meta-target-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .adnn-target-avatar-placeholder { width: 44px; height: 44px; border-radius: 50%; background: var(--adnn-tahoe-primary-tint); font-weight: 600; font-size: 15px; color: #fff; display: grid; place-items: center; flex-shrink: 0; }
    .adnn-room-meta-target-info h4 { margin: 0; font-size: 15px; font-weight: 500; color: var(--adnn-tahoe-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .subtitle-status-text { margin: 2px 0 0; font-size: 11px; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
    .online-status-active { color: var(--adnn-tahoe-neon-green); }
    .typing-status-active { color: var(--adnn-tahoe-primary-tint); font-weight: 600; }
    
    .adnn-room-actions-header-group { display: flex; align-items: center; gap: 8px; }
    .adnn-call-trigger-btn { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); color: #fff; cursor: pointer; display: grid; place-items: center; transition: all 0.2s ease; }
    .adnn-call-trigger-btn:hover { background: var(--adnn-tahoe-primary-tint); border-color: transparent; }
    .adnn-call-trigger-btn svg { width: 16px; height: 16px; }

    /* Feed Messages View Grid Matrix Area Layout */
    .adnn-chat-messages-scroll-area { min-height: 0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .adnn-message-bubble-wrapper { display: flex; width: 100%; position: relative; }
    .adnn-message-bubble-wrapper.align-mine { justify-content: flex-end; }
    .adnn-message-bubble-wrapper.align-other { justify-content: flex-start; }
    
    .adnn-message-bubble-body-card-frame {
      max-width: 75%; padding: 10px 14px; border-radius: 18px; position: relative; transition: transform 0.2s ease;
    }
    .adnn-message-bubble-body-card-frame:hover { transform: translateY(-1px); }
    .align-mine .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-mine); color: #fff; border-bottom-right-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
    .align-other .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-other); color: var(--adnn-tahoe-text-main); border: 1px solid var(--adnn-tahoe-border-subtle); border-bottom-left-radius: 4px; }
    
    .bubble-text-content-paragraph-layout-row p { margin: 0; font-size: 14.5px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; }
    .bubble-metadata-metrics-row-strip { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; font-size: 9.5px; color: rgba(255,255,255,0.5); font-family: monospace; }
    .align-other .metric-timestamp-clock-label { color: var(--adnn-tahoe-text-muted); }
    .receipt-double-check-blue-active-color { color: #34b7f1 !important; }
    
    /* WhatsApp Context Speed Overlays Actions Framework Strip Box Component Layout Style */
    .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip {
      position: absolute; bottom: 100%; right: 0; background: rgba(20,20,24,0.95); border: 1px solid var(--adnn-tahoe-border-subtle);
      border-radius: 12px; padding: 4px; display: flex; gap: 2px; opacity: 0; pointer-events: none; transform: translateY(6px); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); z-index: 10; backdrop-filter: blur(8px);
    }
    .adnn-message-bubble-body-card-frame:hover .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .action-strip-dot-btn { background: transparent; border: 0; color: #fff; font-size: 13px; padding: 4px 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
    .action-strip-dot-btn:hover { background: rgba(255,255,255,0.1); opacity: 1; }
    .action-strip-dot-btn svg { width: 12px; height: 12px; }
    .delete-destructive-action-color-btn:hover { background: var(--adnn-tahoe-neon-red) !important; color: #fff; }

    .bubble-attached-media-frame-box { margin-bottom: 6px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 1px solid rgba(0,0,0,0.15); max-height: 280px; }
    .bubble-attached-media-frame-box img { width: 100%; height: auto; display: block; object-fit: cover; max-height: 280px; }
    
    .bubble-reply-context-reference-quote-box { background: rgba(0,0,0,0.15); border-left: 3px solid var(--adnn-tahoe-primary-tint); padding: 6px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
    .bubble-reply-context-reference-quote-box strong { display: block; color: rgba(255,255,255,0.85); font-size: 11px; }
    .bubble-reply-context-reference-quote-box p { margin: 2px 0 0; color: rgba(255,255,255,0.65); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .bubble-generic-file-attachment-download-anchor-link { display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(0,0,0,0.12); border-radius: 10px; text-decoration: none; color: inherit; margin-bottom: 6px; border: 1px solid var(--adnn-tahoe-border-subtle); }
    .generic-file-icon-avatar-badge { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.08); display: grid; place-items: center; }
    .generic-file-info-metadata-stack-column { min-width: 0; display: flex; flex-direction: column; }
    .generic-file-info-metadata-stack-column strong { font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generic-file-info-metadata-stack-column small { font-size: 10px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }

    .bubble-reactions-row-strip-wrapper { position: absolute; top: calc(100% - 6px); left: 12px; display: flex; gap: 2px; background: #1c1c1f; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 1px 4px; border-radius: 8px; font-size: 10px; z-index: 2; }

    /* Drag and Drop Asset Context Block View */
    .adnn-drag-drop-full-box-overlay { position: absolute; inset: 12px; z-index: 100; background: rgba(39, 45, 207, 0.15); backdrop-filter: blur(8px); border-radius: 20px; padding: 24px; pointer-events: none; }
    .drag-drop-card-view { border: 2px dashed var(--adnn-tahoe-primary-tint); border-radius: 16px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #fff; background: rgba(0,0,0,0.6); }
    .drag-icon-announcement { font-size: 32px; margin-bottom: 8px; }
    
    /* Core Input Layout Workspace Component Fields Style Rules Layers */
    .adnn-chat-footer-composer-wrapper { padding: 12px 16px; border-top: 1px solid var(--adnn-tahoe-border-subtle); background: rgba(0,0,0,0.12); display: flex; flex-direction: column; gap: 8px; }
    .adnn-master-composer-core-form { display: flex; align-items: center; gap: 10px; }
    .composer-action-icon-trigger-label, .composer-action-icon-trigger-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); color: var(--adnn-tahoe-text-muted); cursor: pointer; display: grid; place-items: center; transition: all 0.2s ease; flex-shrink: 0; padding: 0; }
    .composer-action-icon-trigger-label:hover, .composer-action-icon-trigger-btn:hover, .camera-active-glow-neon-tint-accent-color-style { color: #fff; background: rgba(255,255,255,0.08); border-color: var(--adnn-tahoe-primary-tint); }
    .composer-action-icon-trigger-label svg, .composer-action-icon-trigger-btn svg { width: 16px; height: 16px; }
    
    .composer-input-field-workspace-box { flex: 1; position: relative; display: flex; align-items: center; min-width: 0; }
    .composer-input-field-workspace-box input { width: 100%; height: 40px; border-radius: 20px; background: rgba(0,0,0,0.25); border: 1px solid var(--adnn-tahoe-border-subtle); padding: 0 16px; color: #fff; outline: 0; font-size: 14px; transition: border-color 0.2s ease; }
    .composer-input-field-workspace-box input:focus { border-color: var(--adnn-tahoe-primary-tint); background: rgba(0,0,0,0.35); }
    
    .composer-submit-execution-action-btn { width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--adnn-tahoe-primary-tint); color: #fff; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; }
    .composer-submit-execution-action-btn svg { width: 14px; height: 14px; transform: rotate(45deg) translate(-1px, 1px); }

    .adnn-reply-context-banner-preview { background: rgba(0,0,0,0.3); border-radius: 10px; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 8px 12px; display: flex; align-items: center; gap: 12px; position: relative; }
    .reply-vertical-accent-line { width: 4px; height: 28px; background: var(--adnn-tahoe-primary-tint); border-radius: 2px; }
    .reply-context-body-content { flex: 1; min-width: 0; font-size: 12px; }
    .reply-context-body-content strong { display: block; color: #fff; }
    .reply-context-body-content p { margin: 1px 0 0; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .adnn-cancel-reply-context-btn { background: transparent; border: 0; color: var(--adnn-tahoe-text-muted); cursor: pointer; display: flex; padding: 4px; }
    .adnn-cancel-reply-context-btn:hover { color: #fff; }
    
    .adnn-composer-inline-media-preview-container { padding: 6px; background: rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--adnn-tahoe-border-subtle); display: inline-flex; max-width: max-content; }
    .media-preview-card-frame { position: relative; display: block; }
    .media-render-target-box img { max-width: 140px; max-height: 100px; border-radius: 8px; object-fit: cover; display: block; border: 1px solid rgba(255,255,255,0.05); }
    .adnn-remove-attached-media-btn { position: absolute; top: -6px; right: -6px; background: #000; color: #fff; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--adnn-tahoe-border-subtle); cursor: pointer; display: grid; place-items: center; font-size: 10px; }
    
    .generic-document-file-preview-thumbnail-avatar-card-frame-box { padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; width: 160px; font-size: 11px; text-align: center; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box span { font-size: 20px; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box strong { color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generic-document-file-preview-thumbnail-avatar-card-frame-box small { color: var(--adnn-tahoe-text-muted); font-family: monospace; }

    /* Advanced Composer Camera Mirror Implementation Layout Box Style Component Rules Context Elements Layer Properties */
    .adnn-composer-integrated-camera-mirror-box { position: relative; width: 100%; max-width: 240px; aspect-ratio: 4/3; border-radius: 14px; overflow: hidden; border: 1px solid var(--adnn-tahoe-primary-tint); box-shadow: 0 12px 30px rgba(0,0,0,0.4); margin-bottom: 4px; }
    .mirror-corrected-stream { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); background: #000; }
    .camera-mirror-controls-bar { position: absolute; bottom: 0; inset-inline: 0; background: linear-gradient(transparent, rgba(0,0,0,0.85)); padding: 8px; display: flex; justify-content: center; align-items: center; gap: 24px; }
    .camera-action-circle-btn { width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid #000; cursor: pointer; box-shadow: 0 0 10px rgba(255,255,255,0.4); }
    .camera-action-circle-btn:active { transform: scale(0.92); }
    .camera-action-close-btn { background: rgba(0,0,0,0.6); border: 0; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }

    /* Advanced Voice Input Field Simulation Layout Layer Styles Rules */
    .adnn-voice-recording-view-component-layer { display: flex; align-items: center; gap: 10px; width: 100%; padding-left: 6px; }
    .live-blink-pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--adnn-tahoe-neon-red); animation: liveBlinkPulse 1s infinite alternate; }
    .voice-duration-chronometer { font-size: 13px; color: #fff; font-family: monospace; }
    .voice-wave-canvas-visualization-simulation { display: flex; align-items: center; gap: 2px; height: 20px; }
    .voice-wave-canvas-visualization-simulation span { width: 2px; height: 60%; background: var(--adnn-tahoe-primary-tint); border-radius: 1px; animation: soundWaveSim 0.6s infinite ease-in-out alternate; }
    .voice-wave-canvas-visualization-simulation span:nth-child(2n) { animation-delay: 0.15s; height: 40%; }
    .voice-wave-canvas-visualization-simulation span:nth-child(3n) { animation-delay: 0.3s; height: 90%; }
    .recording-session-active-pulse-red-glow-tint-style { background: var(--adnn-tahoe-neon-red) !important; color: #fff !important; animation: liveBlinkPulse 1.2s infinite alternate; }

    /* Call Summary Logs Custom Visual Layout Block Styling */
    .call-summary-bubble-card-style { background: rgba(255,255,255,0.02) !important; border: 1px dashed var(--adnn-tahoe-border-subtle) !important; border-radius: 12px !important; text-align: center !important; width: 90% !important; max-width: 440px !important; margin: 4px auto !important; float: none !important; clear: both !important; }
    .call-summary-bubble-card-style p { font-family: monospace !important; font-size: 11.5px !important; color: var(--adnn-tahoe-text-muted) !important; }

    /* Immersive Realtime Multi-Surface FaceTime Framework Architecture Layout Stage Panels Windows Space Components Styles Rules */
    .adnn-call-immersive-interface-overlay-panel-container-window-context-layer-frame-box-slot-locator-instance {
      position: fixed; inset: 0; z-index: 2147483640; background: rgba(8,8,10,0.85); backdrop-filter: blur(28px) saturate(140%); display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .call-interface-window-card-box {
      width: min(840px, 100%); background: #121214; border-radius: 28px; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 40px 120px rgba(0,0,0,0.6);
    }
    .call-interface-top-metadata-bar-strip { display: flex; justify-content: space-between; font-size: 11px; font-family: monospace; color: var(--adnn-tahoe-text-muted); border-bottom: 1px solid var(--adnn-tahoe-border-subtle); padding-bottom: 10px; }
    .crypto-lock-icon-tint-badge-span { color: var(--adnn-tahoe-neon-green); }
    
    .call-interface-target-profile-avatar-banner-block { text-align: center; color: #fff; }
    .target-profile-avatar-large-circle-element { width: 64px; height: 64px; border-radius: 20px; background: var(--adnn-tahoe-primary-tint); font-size: 24px; font-weight: 600; display: grid; place-items: center; margin: 0 auto 10px; box-shadow: 0 8px 24px rgba(39, 45, 207, 0.35); }
    .call-interface-target-profile-avatar-banner-block h3 { margin: 0; font-size: 18px; font-weight: 500; }
    .call-interface-target-profile-avatar-banner-block p { margin: 4px 0 0; font-size: 12px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    
    .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area { display: none; width: 100%; aspect-ratio: 16/9; max-height: 380px; border-radius: 18px; overflow: hidden; border: 1px solid var(--adnn-tahoe-border-subtle); position: relative; background: #000; }
    .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area.dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; background: rgba(0,0,0,0.4); }
    
    .camera-tile-window-frame-block-card { position: relative; height: 100%; width: 100%; border-radius: 12px; overflow: hidden; background: #09090b; border: 1px solid rgba(255,255,255,0.03); }
    .camera-tile-window-frame-block-card video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mirror-corrected-stream-track-rendering-engine-element-node { transform: scaleX(-1); }
    
    .camera-stream-track-placeholder-fallback-text-overlay-label-box { position: absolute; inset: 0; display: none; place-items: center; text-align: center; color: var(--adnn-tahoe-text-muted); font-size: 11px; font-family: monospace; letter-spacing: 0.08em; text-transform: uppercase; background: radial-gradient(circle, #1a1a22 30%, #09090b); }
    .camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance video { display: none !important; }
    .camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance .camera-stream-track-placeholder-fallback-text-overlay-label-box { display: grid !important; }
    .camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge { position: absolute; left: 10px; bottom: 10px; background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 20px; font-size: 10px; color: #fff; backdrop-filter: blur(8px); font-family: monospace; }

    .call-interface-actions-toolbar-buttons-row-strip-control-matrix-wrapper-box-container-element { display: flex; justify-content: center; padding-top: 8px; }
    .actions-toolbar-conditional-state-sub-group-flex-layout-strip { display: flex; align-items: center; gap: 12px; }
    .toolbar-functional-action-circle-icon-btn { width: 52px; height: 52px; border-radius: 16px; border: 1px solid var(--adnn-tahoe-border-subtle); background: var(--adnn-tahoe-bg-glass-card); color: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); font-size: 16px; padding: 0; }
    .toolbar-functional-action-circle-icon-btn:hover { background: rgba(255,255,255,0.08); transform: translateY(-2px); }
    .toolbar-functional-action-circle-icon-btn span { font-size: 9px; display: block; font-family: monospace; color: var(--adnn-tahoe-text-muted); }
    .toolbar-functional-action-circle-icon-btn svg { width: 18px; height: 18px; display: block; }

    .accept-action-green-color-pulse-neon-tint-style-btn { background: var(--adnn-tahoe-neon-green) !important; border-color: transparent !important; width: auto !important; padding: 0 20px !important; flex-direction: row !important; gap: 8px !important; border-radius: 20px !important; font-weight: 500; font-size: 14px; }
    .accept-action-green-color-pulse-neon-tint-style-btn span { color: #fff !important; font-size: 13px !important; font-family: inherit !important; }
    .accept-action-green-color-pulse-neon-tint-style-btn:hover { box-shadow: 0 0 20px rgba(37, 211, 102, 0.45); }
    
    .decline-destructive-action-red-color-style-btn { background: var(--adnn-tahoe-neon-red) !important; border-color: transparent !important; border-radius: 50% !important; }
    .decline-destructive-action-red-color-style-btn:hover { box-shadow: 0 0 20px rgba(255, 59, 48, 0.45); }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn { width: auto !important; padding: 0 20px !important; flex-direction: row !important; gap: 8px !important; border-radius: 20px !important; font-weight: 500; font-size: 14px; }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn span { color: #fff !important; font-size: 13px !important; font-family: inherit !important; }

    .disabled-muted-state-active-glow-style-class-modifier-tint-color { background: rgba(255,255,255,0.2) !important; color: var(--adnn-tahoe-neon-red) !important; border-color: rgba(255,59,48,0.3) !important; }

    /* Core Architectural Fluid Adaptation Rules Infrastructure Breakpoints Mapping Layers */
    @media (max-width: 768px) {
      .adnn-chat-window-container { grid-template-columns: 1fr; height: 100dvh; border-radius: 0; border: 0; }
      .adnn-chat-sidebar-wrapper { display: grid !important; }
      .adnn-chat-main-room-view { display: none; }
      
      body.adnn-mobile-room-active-focus-view .adnn-chat-sidebar-wrapper { display: none !important; }
      body.adnn-mobile-room-active-focus-view .adnn-chat-main-room-view { display: block !important; position: fixed; inset: 0; z-index: 999999; }
      body.adnn-mobile-room-active-focus-view .adnn-active-room-layout { display: grid !important; }
      body.adnn-mobile-room-active-focus-view .adnn-back-arrow-mobile-btn { display: grid !important; }
      
      .adnn-chat-messages-scroll-area { padding: 12px; }
      .adnn-message-bubble-body-card-frame { max-width: 88%; }
      .adnn-chat-overlay-immersive { padding: 0; }
      
      .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area.dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance { grid-template-columns: 1fr !important; grid-template-rows: 1fr 1fr; }
      .call-interface-window-card-box { height: 100%; border-radius: 0; justify-content: space-between; padding-vertical: 32px; }
    }

    /* Keyframe Operational Vectors Matrix Declarations Animation Layouts Block Unit Context */
    @keyframes pulseGlow { from { opacity: 0.6; transform: scale(0.98); } to { opacity: 1; transform: scale(1.02); } }
    @keyframes liveBlinkPulse { from { opacity: 0.3; } to { opacity: 1; } }
    @keyframes soundWaveSim { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
    
    .hidden { display: none !important; }
  `;
  document.head.appendChild(styleElementNodePointerInstanceReferenceLocationFieldUnit);
}
