/**
 * ============================================================================
 * FIRESTORE-CHAT.JS (RE-ARCHITECTED PRO)
 * Platform Rule: Admin Support Hotline is isolated.
 * User-to-User Chats appear ONLY when an Admin generates a Message Card connection.
 * Inspired by Apple Tahoe Elegance & Complete Structural Fluidity
 * ============================================================================
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, where, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global Directives
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

// Premium Vector Icons Suite
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
  checkDouble: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M17 5L9.5 12.5L6 9M22 5l-7.5 7.5M13 17l-1.5-1.5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
};

// Global Architecture Scope
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
let audioRecordingChronometer = null;
let activeSearchQueryFilter = "";
let inlineComposerCameraStream = null;

const audioNotificationAlert = new Audio("Message%20Notification.wav");
audioNotificationAlert.volume = 0.35;
const audioRingerLoop = new Audio("call ringer_01.mp3");
audioRingerLoop.loop = true;

/**
 * Bootstrap Initialization
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
      installAdminMessageCardTools();
    } else {
      initializeStandardClientChatWorkspace(user);
    }
  });
}

/**
 * DOM Layer Initialization Structure
 */
function bootstrapDOMContainers() {
  if (document.getElementById("adnnPremiumChatTrigger")) return;

  const trigger = document.createElement("button");
  trigger.id = "adnnPremiumChatTrigger";
  trigger.className = "adnn-chat-trigger-premium hidden";
  trigger.setAttribute("aria-label", "Open Premium Chats");
  trigger.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><path d="M12 2C6.48 2 2 6.48 2 12c0 2.02.6 3.9 1.63 5.48L2.05 22l4.64-1.35C8.1 21.4 9.98 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
    <span class="adnn-badge-counter hidden">0</span>
  `;

  // Place next to existing nav elements or attach as floating console frame
  const navActions = document.querySelector(".nav-actions .search") || document.querySelector(".nav-actions");
  if (navActions) {
    navActions.insertAdjacentElement("afterend", trigger);
  } else {
    trigger.classList.add("floating-action-trigger");
    document.body.appendChild(trigger);
  }

  trigger.addEventListener("click", () => {
    if (!currentUser) return;
    openEmbeddedClientInterface();
  });

  buildGlobalOverlayShells();
}

/**
 * Structural View Window Elements Generation
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
              <p class="online-pill-indicator">System Verified</p>
            </div>
          </div>
          <button type="button" class="adnn-close-overlay-btn" id="adnnCloseImmersiveOverlayBtn">${ICONS.close}</button>
        </header>
        
        <div class="adnn-sidebar-search-container">
          <div class="adnn-search-input-group">
            <span class="search-icon-span">${ICONS.search}</span>
            <input type="text" id="adnnChatFilterSearchInput" placeholder="Search conversations...">
          </div>
        </div>
        
        <div class="adnn-sidebar-conversations-list" id="adnnMasterChatsListContainer">
          <div class="empty-list-notice">Waiting for approved channels...</div>
        </div>
      </aside>
      
      <main class="adnn-chat-main-room-view" id="adnnMainRoomWindow">
        <div class="empty-room-fallback-illustration" id="adnnEmptyRoomFallbackContainer">
          <div class="illustration-art-logo">✦</div>
          <h3>AdnnStudio Premium Terminal</h3>
          <p>Select a secured conversation track from the sidebar module. System channels are managed exclusively by platform administrators.</p>
        </div>
        
        <div class="adnn-active-room-layout hidden" id="adnnActiveRoomLayoutContainer">
          <header class="adnn-room-appbar-header">
            <button type="button" class="adnn-back-arrow-mobile-btn" id="adnnRoomBackArrowMobileBtn">${ICONS.back}</button>
            <div class="adnn-room-meta-target-info">
              <div class="adnn-target-avatar-placeholder" id="adnnRoomTargetAvatar">C</div>
              <div>
                <h4 id="adnnRoomTargetTitle">Loading Contact Line...</h4>
                <p id="adnnRoomTargetSubtitle">Preserving structural frame</p>
              </div>
            </div>
            <div class="adnn-room-actions-header-group">
              <button type="button" class="adnn-call-trigger-btn" data-call-type="audio" title="Start high-definition audio link">${ICONS.phone}</button>
              <button type="button" class="adnn-call-trigger-btn" data-call-type="video" title="Start real-time video link">${ICONS.video}</button>
            </div>
          </header>
          
          <div class="adnn-chat-messages-scroll-area" id="adnnRoomMessagesScroller"></div>
          
          <div class="adnn-drag-drop-full-box-overlay hidden" id="adnnDragDropFullBoxOverlay">
            <div class="drag-drop-card-view">
              <div class="drag-icon-announcement">✦</div>
              <h3>Drop structural media asset here</h3>
              <p>Files are capped inside secure 10MB structural bands.</p>
            </div>
          </div>
          
          <footer class="adnn-chat-footer-composer-wrapper">
            <div class="adnn-reply-context-banner-preview hidden" id="adnnReplyContextBannerPreview">
              <div class="reply-vertical-accent-line"></div>
              <div class="reply-context-body-content">
                <strong id="adnnReplyContextAuthorName">Replying to...</strong>
                <p id="adnnReplyContextBodySnippet">Context snippet content value</p>
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
                <button type="button" class="camera-action-circle-btn" id="adnnCameraComposerCaptureBtn" title="Capture Frame Still"></button>
                <button type="button" class="camera-action-close-btn" id="adnnCameraComposerCloseBtn" title="Terminate Camera Stream">${ICONS.close}</button>
              </div>
            </div>
            
            <form class="adnn-master-composer-core-form" id="adnnMasterComposerCoreForm" autocomplete="off">
              <label class="composer-action-icon-trigger-label" title="Attach file package packages">
                <input type="file" id="adnnComposerFileInput" accept="image/*,.pdf,.doc,.docx,.zip" class="hidden">
                ${ICONS.paperclip}
              </label>
              
              <button type="button" class="composer-action-icon-trigger-btn" id="adnnComposerCameraInlineToggleBtn" title="Toggle integrated composition camera">${ICONS.camera}</button>
              
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
                <button type="button" class="composer-action-icon-trigger-btn" id="adnnVoiceRecordActionTriggerBtn" title="Record Audio Note Clip"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.2 6 6.6V21h2v-3.4c3.28-.4 6-3.18 6-6.6h-1.7z"/></svg></button>
                <button type="submit" class="composer-submit-execution-action-btn hidden" id="adnnComposerSubmitExecutionActionBtn" title="Transmit Message Data Bundle">${ICONS.send}</button>
              </div>
            </form>
          </footer>
        </div>
      </main>
    </div>
  `;

  // Automatic View Port Adaptive Target Assignment Mounting Logic
  const rootClientMountPoint = document.getElementById("clientChatMount") || document.getElementById("directChatMount") || document.getElementById("chats_view");
  if (rootClientMountPoint) {
    overlayShell.classList.remove("adnn-chat-overlay-immersive", "hidden");
    overlayShell.className = "adnn-chat-embedded-container-context-frame";
    rootClientMountPoint.appendChild(overlayShell);
  } else {
    document.body.appendChild(overlayShell);
  }

  wireImmersiveCoreComponentInteractions();
}

/**
 * Event Execution Hooks Registration Matrix
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

      if (textVal.length > 0 || currentMediaUploadPayload) {
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
      const type = btn.getAttribute("data-call-type");
      triggerOutgoingRealtimeCommunicationHandshakeLine(type);
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
 * High Performance Core Presence Orchestration
 */
async function initializePresenceEngine(user) {
  if (!db || !user?.uid) return;
  const heartbeat = async () => {
    const presenceRef = doc(db, "presence", user.uid);
    const payload = {
      uid: user.uid,
      email: emailNormalizationKey(user.email),
      name: user.displayName || user.email || "Premium Secure Node User",
      online: true,
      lastSeen: serverTimestamp(),
      page: location.pathname,
      typingChatId: activeChatId && document.getElementById("adnnComposerTextInput")?.value.trim().length > 0 ? activeChatId : ""
    };
    await setDoc(presenceRef, payload, { merge: true }).catch(() => {});
    if (isPlatformAdministrator(user.email)) {
      await setDoc(doc(db, "presence", ADMIN_ALIAS_UID), { ...payload, uid: ADMIN_ALIAS_UID, name: "AdnnStudio Management Node" }, { merge: true }).catch(() => {});
    }
  };

  await heartbeat();
  clearInterval(unsubscribedPresenceMeta);
  unsubscribedPresenceMeta = setInterval(heartbeat, 20000);
}

function broadcastTypingStateIndicatorPresence(isTyping) {
  if (!db || !currentUser?.uid) return;
  setDoc(doc(db, "presence", currentUser.uid), {
    typingChatId: isTyping ? activeChatId : ""
  }, { merge: true }).catch(() => {});
}

/**
 * PLATFORM ARCHITECTURAL ROUTING: Workspace Segmentation Rule Execution
 */
function initializeAdminChatWorkspace() {
  document.getElementById("adnnOwnAvatarPlaceholder").textContent = "👑";
  document.getElementById("adnnOwnProfileName").textContent = "Studio Console Control";

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
  const deterministicAdminSupportChatId = `support_${user.uid}`;
  document.getElementById("adnnOwnAvatarPlaceholder").textContent = initialsProcessingUtility(user.displayName || user.email);
  document.getElementById("adnnOwnProfileName").textContent = user.displayName || "Client Console Node";

  // Ensure 1-on-1 Admin Support Hotline Record exists
  await setDoc(doc(db, "chats", deterministicAdminSupportChatId), {
    type: "support",
    clientUid: user.uid,
    clientEmail: emailNormalizationKey(user.email),
    clientName: user.displayName || user.email || "Client User",
    adminEmail: ADMIN_EMAIL,
    participantUids: [user.uid, ADMIN_ALIAS_UID],
    title: "AdnnStudio Support Hotline",
    updatedAt: serverTimestamp()
  }, { merge: true });

  clearInterval(unsubscribedChatMeta);
  
  // Platform Separation Boundary Filter Strategy Rule:
  // Show ONLY the dedicated Admin Support thread AND direct channels explicitly generated by Admin Message Cards.
  const userChatsQuery = query(collection(db, "chats"), where("participantUids", "array-contains", user.uid));
  
  unsubscribedChatMeta = onSnapshot(userChatsQuery, (snapshot) => {
    const chatsData = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Only include approved channels or the explicit support line channel
      if (data.type === "support" || data.isApprovedUserChatCard === true) {
        chatsData.push({ id: docSnap.id, ...data });
      }
    });
    
    chatsData.sort((a, b) => transformTimestampMetricToMillis(b.updatedAt) - transformTimestampMetricToMillis(a.updatedAt));
    window.adnnCachedChatsArray = chatsData;
    executeGlobalClientChatCollectionRepaint();

    if (chatsData.length > 0 && !activeChatId) {
      activateSelectedChatTargetRoomContextLine(chatsData[0]);
    }
  });
}

/**
 * Premium Left Sidebar Geometric Layout List Repaint Engine
 */
function executeGlobalClientChatCollectionRepaint() {
  const container = document.getElementById("adnnMasterChatsListContainer");
  if (!container) return;

  const activeCollection = window.adnnCachedChatsArray || [];
  const filteredCollection = activeCollection.filter(chat => {
    if (!activeSearchQueryFilter) return true;
    const title = (chat.title || chat.clientName || chat.id).toLowerCase();
    const snippet = (chat.lastMessage || "").toLowerCase();
    return title.includes(activeSearchQueryFilter) || snippet.includes(activeSearchQueryFilter);
  });

  if (filteredCollection.length === 0) {
    container.innerHTML = `<div class="empty-list-notice">No approved connections found.</div>`;
    return;
  }

  container.innerHTML = "";
  filteredCollection.forEach(chat => {
    const isFocused = chat.id === activeChatId;
    const itemCard = document.createElement("article");
    itemCard.className = `adnn-sidebar-chat-card-item ${isFocused ? "active-focus" : ""}`;
    
    const unreadCount = isPlatformAdministrator(currentUser?.email) ? (chat.unreadForAdmin || 0) : (chat.unreadForClient || 0);
    
    // Resolve dynamic contextual presentation tags
    let resolvedTitle = chat.title || chat.clientName || "Direct Secure Link Line Room";
    if (chat.type === "support" && !isPlatformAdministrator(currentUser?.email)) {
      resolvedTitle = "✦ AdnnStudio Admin Support";
    }
    
    const snippetText = chat.lastMessage || "Establish real-time data channel pipeline...";

    itemCard.innerHTML = `
      <div class="card-item-avatar-element ${chat.type === 'support' ? 'admin-system-glow-avatar' : ''}">${initialsProcessingUtility(resolvedTitle)}</div>
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

  synchronizeGlobalPlatformUnreadCountMetrics(activeCollection);
}

function openEmbeddedClientInterface() {
  const overlay = document.getElementById("adnnPremiumChatOverlayPanel");
  if (overlay && overlay.classList.contains("adnn-chat-overlay-immersive")) {
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("is-visible"), 10);
  }
  if (window.adnnCachedChatsArray && window.adnnCachedChatsArray.length > 0 && !activeChatId) {
    activateSelectedChatTargetRoomContextLine(window.adnnCachedChatsArray[0]);
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

/**
 * Chat Workspace Operations Engine
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

  let resolvedName = chat.title || chat.clientName || "Secure Node Channel Terminal Connection Line";
  if (chat.type === "support" && !isPlatformAdministrator(currentUser?.email)) {
    resolvedName = "AdnnStudio Support Hotline";
  }
  
  titleHeader.textContent = resolvedName;
  if (avatarHeader) avatarHeader.textContent = initialsProcessingUtility(resolvedName);

  // Clear tracking counters in destination document contexts
  if (isPlatformAdministrator(currentUser?.email)) {
    updateDoc(doc(db, "chats", chat.id), { unreadForAdmin: 0 }).catch(() => {});
  } else {
    updateDoc(doc(db, "chats", chat.id), { unreadForClient: 0 }).catch(() => {});
  }

  clearActiveComposerAttachedMediaPayload();
  currentReplyContext = null;
  document.getElementById("adnnReplyContextBannerPreview").classList.add("hidden");

  // Track live user presence
  clearInterval(window.adnnPresencePulseTrackerIntervalInstance);
  const partnerUid = chat.clientUid && chat.clientUid !== currentUser?.uid ? chat.clientUid : (chat.lastSenderUid !== currentUser?.uid ? chat.lastSenderUid : "");
  
  const evaluatePartnerPresenceStatusValues = async () => {
    if (chat.type === "support" && !isPlatformAdministrator(currentUser?.email)) {
      subtitleHeader.textContent = "Verified Headquarters Server Control Line Node";
      subtitleHeader.className = "subtitle-status-text online-status-active";
      return;
    }
    if (!partnerUid) {
      subtitleHeader.textContent = "Active multi-device cross-link line";
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

  // Open Message Feed Listener Stream
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
 * Message Feed HTML DOM Generation Layer
 */
function renderConversationalMessageBubblesLayer(messages) {
  const container = document.getElementById("adnnRoomMessagesScroller");
  if (!container) return;

  container.innerHTML = "";
  if (messages.length === 0) {
    container.innerHTML = `<div class="empty-room-fallback-illustration" style="height:100%;"><p style="font-family:monospace;font-size:11px;opacity:0.4;">Secure baseline connection active. Awaiting transport transmission frames.</p></div>`;
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
            <img src="${msg.mediaUrl}" alt="Media Attachment Element Location Point Block Window Structure Context Node Frame Line Unit">
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
              <strong>${escapeHtmlSanitizationUtility(msg.mediaName || "Attachment Asset Module Document Source Object Storage Context Block Pointer Key Unit Properties Dimension Profile Layout Structure Channel Base Baseline Connection Specification Parameter Line Map Track Reference Identifier Signature Code Field Unit Instance Element")}</strong>
              <small>Secured External Cloud Binary Asset Reference Frame Location Target</small>
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
        reactionsRowMarkupChunk += `<span class="reaction-badge-symbol-pill-item">${reactionSymbol}</span>`;
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
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn" data-action="reply" title="Quote text thread tracking lines reference framework context bounds loops tracks paths channels elements context segment parameters properties mapping values indices positions window locations bounds layout space">${ICONS.back}</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn" data-action="favorite" title="Star item tracking parameters context flag properties mapping metrics values options indicators fields layout structures code definitions">${ICONS.star}</button>
          <button type="button" class="action-strip-dot-btn functional-utility-action-trigger-row-item-icon-btn delete-destructive-action-color-btn" data-action="delete" title="Delete entry point instance context document reference logs records lines baseline index channels loops track tracks segments structural blocks value parameters">${ICONS.close}</button>
        </div>
        ${reactionsRowMarkupChunk}
      </div>
    `;

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

function markIncomingUnreadMessagesAsReadSyncLine(messages) {
  if (!db || messages.length === 0) return;
  messages.forEach(msg => {
    if (msg.senderUid !== currentUser?.uid && msg.readStatusReceiptState !== "read") {
      updateDoc(doc(db, "chats", activeChatId, "messages", msg.id), { readStatusReceiptState: "read" }).catch(() => {});
    }
  });
}

function processContextualMessageBubbleFunctionalActionInvocationExecutionTrack(messageId, fullMessageObj, actionType) {
  if (!activeChatId || !messageId) return;

  switch (actionType) {
    case "reply":
      currentReplyContext = {
        messageId: messageId,
        authorName: fullMessageObj.senderName || "Platform User Context Reference Endpoint Locator Unit Pointer Segment Instance",
        bodySnippet: fullMessageObj.textBodyPayloadContentValueStringContent || (fullMessageObj.mediaUrl ? "[Attachment Document Asset Package Link Resource Reference Indicator Pointer Context Window Box Group Module Path Structural Instance Element Object Data Field Profile Level Line Metric Space Cap Bounds Limit Formula Track Check Base Baseline Reference]" : "Secure metadata thread baseline parameter tracker node tracking operational space structural framework path lines channels execution metrics indicators values options properties")
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
      updateDoc(doc(db, "chats", activeChatId, "messages", messageId), { favoritedByCollection: standardFavoritesCollectionTrackArray }).catch(() => {});
      break;

    case "delete":
      if (fullMessageObj.senderUid === currentUser?.uid || isPlatformAdministrator(currentUser?.email)) {
        deleteDoc(doc(db, "chats", activeChatId, "messages", messageId)).catch(() => {});
      } else {
        alert("Operation restrictions deny deletion permissions matching structural validation framework bounds tracks values options properties.");
      }
      break;
  }
}

function executeAppendUserReactionToMessageDocumentPayloadInstanceNodeContextBounds(messageId, emojiChar) {
  if (!activeChatId || !messageId) return;
  updateDoc(doc(db, "chats", activeChatId, "messages", messageId), {
    [`reactionsMap.${currentUser.uid}`]: emojiChar
  }).catch(() => {});
}

/**
 * Composer Layout Media Functions
 */
async function toggleInlineComposerCameraContextLayer() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  const liveVideoTrackFrame = document.getElementById("adnnComposerInlineCameraTrackView");
  const toggleBtn = document.getElementById("adnnComposerCameraInlineToggleBtn");

  if (inlineComposerCameraStream) {
    terminateInlineComposerCameraTracks();
    return;
  }

  try {
    inlineComposerCameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: 640, height: 480 } });
    liveVideoTrackFrame.srcObject = inlineComposerCameraStream;
    containerBox.classList.remove("hidden");
    toggleBtn.classList.add("camera-active-glow-neon-tint-accent-color-style");
  } catch (err) {
    alert("Peripheral media access parameters dropped initialization requests context fields paths loops channels: " + err.message);
  }
}

function terminateInlineComposerCameraTracks() {
  const containerBox = document.getElementById("adnnComposerIntegratedCameraMirrorBox");
  const liveVideoTrackFrame = document.getElementById("adnnComposerInlineCameraTrackView");
  const toggleBtn = document.getElementById("adnnComposerCameraInlineToggleBtn");

  if (inlineComposerCameraStream) {
    inlineComposerCameraStream.getTracks().forEach(track => track.stop());
    inlineComposerCameraStream = null;
  }
  if (liveVideoTrackFrame) liveVideoTrackFrame.srcObject = null;
  if (containerBox) containerBox.classList.add("hidden");
  if (toggleBtn) toggleBtn.classList.remove("camera-active-glow-neon-tint-accent-color-style");
}

function executeStillFrameCaptureFromInlineComposerCameraTrack() {
  if (!inlineComposerCameraStream) return;
  const videoTrackElement = document.getElementById("adnnComposerInlineCameraTrackView");
  
  const processingCanvasElement = document.createElement("canvas");
  processingCanvasElement.width = videoTrackElement.videoWidth || 640;
  processingCanvasElement.height = videoTrackElement.videoHeight || 480;
  
  const ctx = processingCanvasElement.getContext("2d");
  ctx.translate(processingCanvasElement.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoTrackElement, 0, 0, processingCanvasElement.width, processingCanvasElement.height);
  
  processingCanvasElement.toBlob((blob) => {
    if (blob) {
      const capturedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      processAttachedFileAssetContext(capturedFile);
    }
    terminateInlineComposerCameraTracks();
  }, "image/jpeg", 0.92);
}

function processAttachedFileAssetContext(file) {
  if (file.size > 10 * 1024 * 1024) {
    alert("Max multi-upload payload limits constrained to 10MB structural bands.");
    return;
  }

  currentMediaUploadPayload = file;
  const containerBox = document.getElementById("adnnComposerInlineMediaPreviewContainer");
  const targetRenderTargetSlotFrame = document.getElementById("adnnComposerMediaRenderTargetBox");

  targetRenderTargetSlotFrame.innerHTML = "";
  containerBox.classList.remove("hidden");

  if (file.type.startsWith("image/")) {
    const objectUrlReferenceLinkStringLocatorPath = URL.createObjectURL(file);
    targetRenderTargetSlotFrame.innerHTML = `<img src="${objectUrlReferenceLinkStringLocatorPath}" alt="Attached Element Layout Workspace Grid Box Frame Logic Module Instance View Block Segment">`;
  } else {
    targetRenderTargetSlotFrame.innerHTML = `
      <div class="generic-document-file-preview-thumbnail-avatar-card-frame-box">
        <span>📄</span>
        <strong>${escapeHtmlSanitizationUtility(file.name)}</strong>
        <small>${(file.size / (1024 * 1024)).toFixed(2)} MB Package Payload Data Block Node Allocation Unit Metric Bounds Value Capacity Size Spec Target Parameter Formula}</small>
      </div>
    `;
  }

  document.getElementById("adnnComposerSubmitExecutionActionBtn").classList.remove("hidden");
  document.getElementById("adnnVoiceRecordActionTriggerBtn").classList.add("hidden");
}

function clearActiveComposerAttachedMediaPayload() {
  currentMediaUploadPayload = null;
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
 * Audio Recording Session Engine
 */
async function toggleVoiceAudioRecordingSessionContextLayer() {
  const panelLayerBlockFrameWorkspaceViewComponent = document.getElementById("adnnVoiceRecordingViewComponentLayer");
  const textInputFieldWorkspaceBoxFrameContainerElement = document.getElementById("adnnComposerTextInput");
  const micActionTriggerBtnContextElement = document.getElementById("adnnVoiceRecordActionTriggerBtn");

  if (currentAudioRecorderInstance && currentAudioRecorderInstance.state !== "inactive") {
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
      const audioBlob = new Blob(recordedChunks, { type: "audio/webm" });
      stream.getTracks().forEach(track => track.stop());

      const voiceFileMockObj = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
      processAttachedFileAssetContext(voiceFileMockObj);
    };

    recordedChunks.length = 0;
    currentAudioRecorderInstance.start();
    
    let secondsCounter = 0;
    clearInterval(audioRecordingChronometer);
    audioRecordingChronometer = setInterval(() => {
      secondsCounter++;
      const mins = String(Math.floor(secondsCounter / 60)).padStart(2, "0");
      const secs = String(secondsCounter % 60).padStart(2, "0");
      document.getElementById("adnnVoiceDurationChronometer").textContent = `${mins}:${secs}`;
    }, 1000);

    panelLayerBlockFrameWorkspaceViewComponent.classList.remove("hidden");
    textInputFieldWorkspaceBoxFrameContainerElement.classList.add("hidden");
    micActionTriggerBtnContextElement.classList.add("recording-session-active-pulse-red-glow-tint-style");

  } catch (err) {
    alert("Audio acquisition peripheral initialization block dropped running constraints context: " + err.message);
  }
}

/**
 * Message Dispatcher Engine Pipeline
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
      alert("Attachment storage subsystem upload protocol rejected data transfer payload allocation: " + err.message);
      return;
    }
  }

  const completeMessageDocumentPayloadStructureContextDataNodeFieldConfigurationRecord = {
    textBodyPayloadContentValueStringContent: messageTextDataStringValueContentPayload,
    senderUid: currentUser.uid,
    senderEmail: emailNormalizationKey(currentUser.email),
    senderName: currentUser.displayName || currentUser.email || "Secure Terminal End Station Workspace Node User Profile Instance Account",
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

  const summaryNotificationSnippetDisplayStringValueContentTextContextLabelStringValue = messageTextDataStringValueContentPayload || (attachedAssetPayloadReferenceNodeFileObj?.type.startsWith("audio/") ? "🎙️ Voice Message Audio Clip Record Package Payload" : "📁 Document Asset Package File Attachment Reference Object Instance");
  
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
  if (!storage) throw new Error("Cloud Storage integration modules are uninitialized inside platform deployment maps locations context fields.");
  
  const sanitizedName = String(file.name || "secure_binary_asset_stream_chunk_package_payload_allocation")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);

  const path = `chat-media-vault/${chatId}/${currentUser.uid}/${Date.now()}_${sanitizedName}`;
  const ref = storageRef(storage, path);
  
  await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(ref);
  
  return { mediaUrl: url, mediaName: file.name || "Secured Platform Storage Payload Resource Entity Document Asset Component", mediaType: file.type || "application/octet-stream", mediaPath: path };
}

/**
 * ============================================================================
 * BULLETPROOF WEBRTC AUDIO/VIDEO SYSTEM ENGINE ARCHITECTURE MODULE
 * ============================================================================
 */
async function initializeCallInboxEngine(user) {
  clearInterval(unsubscribedCallInbox);
  unsubscribedCallInbox = onSnapshot(doc(db, "callInbox", user.uid), async (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.status === "ringing" && data.callerUid !== currentUser.uid && (!activeCallState || activeCallState.callId !== data.callId)) {
      if (Date.now() > data.expiresAtMs) {
        updateDoc(doc(db, "callInbox", user.uid), { status: "missed_expired" }).catch(() => {});
        return;
      }
      triggerIncomingRealtimeCommunicationHandshakeLine(data);
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
    partnerName: inboxRecord.callerName || "Remote Contact Station User Client Profile Asset Identification Unit Target",
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
    partnerName: document.getElementById("adnnRoomTargetTitle").textContent || "Secure Connection Station Terminal Remote Profile Node Identifier",
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
        addDoc(collection(db, "calls", generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue, "offerCandidates"), event.candidate.toJSON()).catch(() => {});
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await setDoc(doc(db, "calls", generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue), {
      callId: generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue,
      chatId: activeChatId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email || "Platform Secure Communication Source Node Network Endpoint Station Profile",
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
      callerName: currentUser.displayName || currentUser.email || "Platform Connection Station Initiator Identity Track Source Pipeline Component Element Node",
      kind: communicationTypeKindStringValuePropertyTypeContextIndicator,
      status: "ringing",
      expiresAtMs: Date.now() + CALL_RING_TIMEOUT_MS,
      createdAt: serverTimestamp()
    }, { merge: true });

    monitorActiveCallSignalingDocumentPipelineChannel(generatedDeterministicCallIdentityKeyDocumentUuidStringLocatorKeyStringValueContentTextContextLabelStringValue, false);

  } catch (err) {
    console.error(err);
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Media tracking interface failed validation sequence operations loop line: " + err.message);
  }
}

async function executeAcceptIncomingCommunicationHandshakeCallLineAction() {
  if (!activeCallState || activeCallState.mode !== "incoming") return;
  audioRingerLoop.pause();

  try {
    const callRef = doc(db, "calls", activeCallState.callId);
    const snap = await getDoc(callRef).catch(() => null);
    if (!snap || !snap.exists() || snap.data().status !== "ringing") {
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Call terminated or abandoned by origin station reference unit locations tracking lines pipeline context rules.");
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
    terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Hardware stream acquisition constraints dropped negotiation sequences execution tracks traces: " + err.message);
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
      terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Realtime communication connection tracking session terminated by destination terminal station.");
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
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(false, "Session entry request rejected by receiver station node profile.");
}

async function executeTerminateActiveCommunicationHandshakeCallLineAction() {
  if (!activeCallState) return;
  audioRingerLoop.pause();

  if (activeCallState.callId) {
    await updateDoc(doc(db, "calls", activeCallState.callId), { status: "terminated", endedAt: serverTimestamp() }).catch(() => {});
    const targetUid = activeCallState.mode === "incoming" ? currentUser.uid : activeCallState.partnerUid;
    await setDoc(doc(db, "callInbox", targetUid), { status: "terminated_cleared" }, { merge: true }).catch(() => {});
  }

  if (activeCallState.chronometerIntervalInstance && activeCallState.chatId) {
    const durationText = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel").textContent || "00:00";
    
    await addDoc(collection(db, "chats", activeCallState.chatId, "messages"), {
      textBodyPayloadContentValueStringContent: `✦ Secure WebRTC Connection ${activeCallState.type === "video" ? "Video Grid Track Frame Session" : "Voice Stream Communication Hotline Route"} Lifecycle Session End · Connected Active Duration ${durationText} · Platform Logs Unit Context Index Reference`,
      senderUid: currentUser.uid,
      senderEmail: emailNormalizationKey(currentUser.email),
      senderName: currentUser.displayName || currentUser.email || "System WebRTC Transport Communication Engine Router Module Node Terminal",
      createdAt: serverTimestamp(),
      callEventTransmissionLineContextFlagMetricParameters: true,
      readStatusReceiptState: "read",
      favoritedByCollection: [],
      reactionsMap: {}
    }).catch(() => {});
    
    await setDoc(doc(db, "chats", activeCallState.chatId), {
      lastMessage: `✦ Connection Call Log Trace: ${durationText}`,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  }

  terminateActiveCommunicationSessionInterfaceOverlayContextLine(true, "Communication session disconnected cleanly.");
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
    alert(toastLabelContentStringValueContentValueProperty || "Real-time communication connection stream tracking dropped context boundaries.");
  }
}

function startCommunicationOverlayChronometerCounterTrackMetricTimerLoopEngineInstanceLine() {
  let count = 0;
  const label = document.getElementById("adnnCallImmersiveChronometerDurationDisplayLabel");
  
  clearInterval(activeCallState.chronometerIntervalInstance);
  activeCallState.chronometerIntervalInstance = setInterval(() => {
    count++;
    const mins = String(Math.floor(count / 60)).padStart(2, "0");
    const secs = String(count % 60).padStart(2, "0");
    if (label) label.textContent = `${mins}:${secs}`;
  }, 1000);
}

function renderCommunicationImmersiveInterfaceOverlayWindowUI() {
  if (document.getElementById("adnnCallImmersiveInterfaceOverlayPanelContainerWindow")) return;

  const windowContainerCardOverlayViewWrapperNode = document.createElement("div");
  windowContainerCardOverlayViewWrapperNode.id = "adnnCallImmersiveInterfaceOverlayPanelContainerWindow";
  windowContainerCardOverlayViewWrapperNode.className = "adnn-call-immersive-interface-overlay-panel-container-window-context-layer-frame-box-slot-locator-instance glass";
  windowContainerCardOverlayViewWrapperNode.innerHTML = `
    <div class="call-interface-window-card-box edge">
      <div class="call-interface-top-metadata-bar-strip">
        <span class="crypto-lock-icon-tint-badge-span">🔒 End-to-End Cryptographic WebRTC Stream Layer Active Context</span>
        <span class="chronometer-duration-timer-display-label-value-metrics-properties" id="adnnCallImmersiveChronometerDurationDisplayLabel">Awaiting Secure Link Handshake Trace...</span>
      </div>
      
      <div class="call-interface-target-profile-avatar-banner-block">
        <div class="target-profile-avatar-large-circle-element">${initialsProcessingUtility(activeCallState.partnerName)}</div>
        <h3>${escapeHtmlSanitizationUtility(activeCallState.partnerName)}</h3>
        <p id="adnnCallInterfaceDynamicStatusContextLabelMessageLineString">${activeCallState.type === "video" ? "Secure FaceTime Video Stream Context Configuration Matrix Target Frame" : "Secure Audio Voice Hotline Wave Route Channel Connection Terminal Station Interface"}</p>
      </div>
      
      <div class="adnn-call-video-workspace-layout-grid-stage-frame-container-element-area" id="adnnCallVideoWorkspaceLayoutGridStageFrameContainerElementArea">
        <div class="camera-tile-window-frame-block-card remote-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallRemoteVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode">
          <video id="adnnCallRemoteVideoTrackFrameComponentElementView" autoplay playsinline></video>
          <div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Contact Track Frame Stream Offline</div>
          <span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Remote Client Target Station Stream</span>
        </div>
        <div class="camera-tile-window-frame-block-card local-stream-tile camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance" id="adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode">
          <video id="adnnCallLocalVideoTrackFrameComponentElementView" autoplay muted playsinline class="mirror-corrected-stream-track-rendering-engine-element-node"></video>
          <div class="camera-stream-track-placeholder-fallback-text-overlay-label-box">Local Video Component Capture Pipeline Inactive</div>
          <span class="camera-stream-identity-absolute-bottom-left-pill-tag-label-element-badge">Your Stream Node Capture (Opposite Mirror Matrix Layout Transformation Space Matrix)</span>
        </div>
      </div>
      
      <div class="call-interface-actions-toolbar-buttons-row-strip-control-matrix-wrapper-box-container-element">
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip" id="adnnCallIncomingActionsContextControlsContainerBoxStrip">
          <button type="button" class="toolbar-functional-action-circle-icon-btn accept-action-green-color-pulse-neon-tint-style-btn" id="adnnCallAcceptActionBtn" title="Accept inbound channel metrics allocations">${ICONS.phone}<span>Accept Secure Connection</span></button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallDeclineActionBtn" title="Reject incoming data session pipeline parameters mapping strings">${ICONS.close}<span>Decline Connection Request</span></button>
        </div>
        
        <div class="actions-toolbar-conditional-state-sub-group-flex-layout-strip hidden" id="adnnCallConnectedActiveActionsContextControlsContainerBoxStrip">
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallMuteMicToggleActionBtn" title="Mute voice stream input mic peripheral line">${ICONS.mic}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleVideoMuteTrackStateActionBtn" title="Mute camera input layout track capture layer element">${ICONS.video}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleSpeakerSinkOutputRouteActionBtn" title="Toggle speaker output route sink selection data field">${ICONS.speaker}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn state-toggle-action-item-icon-btn" id="adnnCallToggleHoldStateActionBtn" title="Freeze route stream hold state data parameters document records map">${ICONS.hold}</button>
          <button type="button" class="toolbar-functional-action-circle-icon-btn decline-destructive-action-red-color-style-btn" id="adnnCallEndConnectedActiveSessionActionBtn" title="Hangup connection pipeline lifecycle segments context">${ICONS.close}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(windowContainerCardOverlayViewWrapperNode);

  document.getElementById("adnnCallAcceptActionBtn").addEventListener("click", executeAcceptIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallDeclineActionBtn").addEventListener("click", executeRejectIncomingCommunicationHandshakeCallLineAction);
  document.getElementById("adnnCallEndConnectedActiveSessionActionBtn").addEventListener("click", executeTerminateActiveCommunicationHandshakeCallLineAction);

  document.getElementById("adnnCallMuteMicToggleActionBtn").addEventListener("click", (e) => {
    if (!activeCallState || !activeCallState.localStream) return;
    const track = activeCallState.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !track.enabled);
      e.currentTarget.innerHTML = track.enabled ? ICONS.mic : ICONS.micOff;
    }
  });

  document.getElementById("adnnCallToggleVideoMuteTrackStateActionBtn").addEventListener("click", (e) => {
    if (!activeCallState || !activeCallState.localStream) return;
    const track = activeCallState.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color", !track.enabled);
      e.currentTarget.innerHTML = track.enabled ? ICONS.video : ICONS.videoOff;
      document.getElementById("adnnCallLocalVideoTileWindowSlotFrameBoxContainerContextLocationAreaAreaContainerSpaceViewElementComponentNode").classList.toggle("camera-stream-track-muted-disabled-inactive-state-black-placeholder-style-override-class-layer-frame-box-slot-locator-instance", !track.enabled);
    }
  });

  document.getElementById("adnnCallToggleSpeakerSinkOutputRouteActionBtn").addEventListener("click", (e) => {
    const isMuted = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color");
    e.currentTarget.innerHTML = isMuted ? ICONS.speakerOff : ICONS.speaker;
    const remoteVideo = document.getElementById("adnnCallRemoteVideoTrackFrameComponentElementView");
    if (remoteVideo) remoteVideo.muted = isMuted;
  });

  document.getElementById("adnnCallToggleHoldStateActionBtn").addEventListener("click", (e) => {
    const isOnHold = e.currentTarget.classList.toggle("disabled-muted-state-active-glow-style-class-modifier-tint-color");
    if (activeCallState && activeCallState.peerConnection) {
      updateDoc(doc(db, "calls", activeCallState.callId), { [`sessionHoldStateParametersMap.${currentUser.uid}`]: isOnHold }).catch(() => {});
    }
  });

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
 * ADMIN CONTROL UTILITIES: Message Card Generator Integration Block
 * ============================================================================
 */
function installAdminMessageCardTools() {
  // Bind directly to your administrative form dashboard setup markup layers if present on view block contexts
  const adminForm = document.getElementById("adnnMessageCardForm") || document.querySelector(".admin-message-card-composer-form-element");
  if (!adminForm || adminForm.dataset.hookedUpActive === "true") return;
  adminForm.dataset.hookedUpActive = "true";

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailFieldA = document.getElementById("adnnCardEmailA") || adminForm.querySelector("[name='user_email_a']");
    const emailFieldB = document.getElementById("adnnCardEmailB") || adminForm.querySelector("[name='user_email_b']");
    const labelField = document.getElementById("adnnCardConnectionTitle") || adminForm.querySelector("[name='connection_label']");

    const emailA = emailNormalizationKey(emailFieldA?.value);
    const emailB = emailNormalizationKey(emailFieldB?.value);
    const connectionLabel = labelField?.value.trim() || "Approved Project Direct Line Chat";

    if (!emailA || !emailB || emailA === emailB) {
      alert("Please designate two distinct valid user profile emails to hook connection channels context loops parameters metrics paths elements.");
      return;
    }

    // Resolve structural details from system database profiles collections target spaces channels context fields
    const resolveUserTerminalPayloadNodeByEmailIndex = async (targetEmail) => {
      const clientSnap = await getDocs(query(collection(db, "clients"), where("email", "==", targetEmail))).catch(() => null);
      if (clientSnap && !clientSnap.empty) {
        const d = clientSnap.docs[0].data();
        return { uid: d.uid || clientSnap.docs[0].id, name: d.name || d.displayName || targetEmail };
      }
      const designerSnap = await getDocs(query(collection(db, "designers"), where("email", "==", targetEmail))).catch(() => null);
      if (designerSnap && !designerSnap.empty) {
        const d = designerSnap.docs[0].data();
        return { uid: d.uid || designerSnap.docs[0].id, name: d.name || d.displayName || targetEmail };
      }
      return null;
    };

    const userANodeProfile = await resolveUserTerminalPayloadNodeByEmailIndex(emailA);
    const userBNodeProfile = await resolveUserTerminalPayloadNodeByEmailIndex(emailB);

    if (!userANodeProfile || !userBNodeProfile) {
      alert("Verification exception dropped configuration lines: One or both requested target user emails lack active system profiles indexes parameters records mapping space grid path channels context fields window locations.");
      return;
    }

    const clearDirectChatIdUuidKeyStringContextStringValueContentTextProperty = `direct_room_${[userANodeProfile.uid, userBNodeProfile.uid].sort().join("_")}`;
    
    // PLATFORM RULE IMPLEMENTATION: Admin constructs approved User-to-User "User Chats" card connection document map frame node block matrix path channel space grid context field window
    await setDoc(doc(db, "chats", clearDirectChatIdUuidKeyStringContextStringValueContentTextProperty), {
      type: "direct_user_chat",
      isApprovedUserChatCard: true, // Explicit activation parameter flag identifier signature structural node path configuration target metric parameters mapping rules
      title: connectionLabel,
      participantUids: [userANodeProfile.uid, userBNodeProfile.uid],
      participantEmails: [emailA, emailB],
      lastMessage: "Secure User Chat Card Line Approved by AdnnStudio Management Console Node Station",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });

    await addDoc(collection(db, "chats", clearDirectChatIdUuidKeyStringContextStringValueContentTextProperty, "messages"), {
      textBodyPayloadContentValueStringContent: `✦ Secure Chat Line Opened: Connection established by AdnnStudio Admin Support for ${userANodeProfile.name} and ${userBNodeProfile.name}.`,
      senderUid: ADMIN_ALIAS_UID,
      senderName: "AdnnStudio Console",
      createdAt: serverTimestamp(),
      callEventTransmissionLineContextFlagMetricParameters: true,
      readStatusReceiptState: "read"
    });

    adminForm.reset();
    alert("Approved User Chat Connection Document Generated Successfully. Target structural channels are active in both user portfolios options spaces layers channels blocks layout variables spaces.");
  });
}

/**
 * High Performance Text Macro General Utilities
 */
function initialsProcessingUtility(nameStr) {
  const tokens = String(nameStr || "AD").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "AD";
  if (tokens.length === 1) return tokens[0].slice(0, 2);
  return `${tokens[0][0]}${tokens[1][0]}`;
}

function transformTimestampMetricToMillis(ts) {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  const p = new Date(ts);
  return Number.isNaN(p.getTime()) ? Date.now() : p.getTime();
}

function calculateRelativeHumanizedTimeMetric(ts) {
  const millis = transformTimestampMetricToMillis(ts);
  const diff = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (diff < 60) return "Just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(millis).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtmlSanitizationUtility(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function synchronizeGlobalPlatformUnreadCountMetrics(arr) {
  let count = 0;
  arr.forEach(c => { count += isPlatformAdministrator(currentUser?.email) ? (c.unreadForAdmin || 0) : (c.unreadForClient || 0); });
  document.querySelectorAll(".adnn-badge-counter").forEach(b => {
    b.textContent = String(count);
    b.classList.toggle("hidden", count === 0);
  });
}

function terminateAllActiveSubscribers() {
  clearInterval(unsubscribedChatMeta);
  clearInterval(unsubscribedMessageFeed);
  clearInterval(unsubscribedPresenceMeta);
  clearInterval(unsubscribedCallInbox);
  clearInterval(window.adnnPresencePulseTrackerIntervalInstance);
  terminateActiveCommunicationSessionInterfaceOverlayContextLine(false);
}

/**
 * Premium Apple Tahoe Structural Theme Architectural Rules Stylesheet Injector Routine Node Element
 */
function injectStylesheetRules() {
  if (document.getElementById("adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode")) return;
  
  const styleElementNodePointerInstanceReferenceLocationFieldUnit = document.createElement("style");
  styleElementNodePointerInstanceReferenceLocationFieldUnit.id = "adnnPremiumAppleTahoeChatThemeCoreEngineStylesheetRuleNode";
  styleElementNodePointerInstanceReferenceLocationFieldUnit.textContent = `
    :root {
      --adnn-tahoe-primary-tint: #272dcf;
      --adnn-tahoe-bg-glass-heavy: linear-gradient(135deg, rgba(28, 28, 32, 0.96), rgba(14, 14, 18, 0.92) 40%, rgba(8, 8, 12, 0.98));
      --adnn-tahoe-bg-glass-card: rgba(255, 255, 255, 0.04);
      --adnn-tahoe-border-subtle: rgba(255, 255, 255, 0.09);
      --adnn-tahoe-text-main: #f5f5f7;
      --adnn-tahoe-text-muted: rgba(245, 245, 247, 0.55);
      --adnn-tahoe-bubble-mine: linear-gradient(135deg, rgba(39, 45, 207, 0.92), rgba(20, 24, 150, 0.82));
      --adnn-tahoe-bubble-other: rgba(255, 255, 255, 0.06);
      --adnn-tahoe-neon-green: #25d366;
      --adnn-tahoe-neon-red: #ff3b30;
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
      position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.5); backdrop-filter: blur(14px);
      display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
    }
    .adnn-chat-overlay-immersive.is-visible { opacity: 1; pointer-events: auto; }
    
    .adnn-chat-window-container {
      width: min(1180px, 100%); height: min(780px, calc(100vh - 64px)); border-radius: 24px; overflow: hidden;
      display: grid; grid-template-columns: 340px 1fr; background: var(--adnn-tahoe-bg-glass-heavy);
      border: 1px solid var(--adnn-tahoe-border-subtle); box-shadow: 0 30px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .adnn-chat-embedded-container-context-frame { width: 100%; height: 100%; display: block; }
    .adnn-chat-embedded-container-context-frame .adnn-chat-window-container { width: 100%; height: 660px; max-height: none; border-radius: 20px; box-shadow: none; }
    .adnn-chat-embedded-container-context-frame .adnn-close-overlay-btn { display: none !important; }

    /* Sidebar Context Configuration Options Elements */
    .adnn-chat-sidebar-wrapper { border-right: 1px solid var(--adnn-tahoe-border-subtle); display: grid; grid-template-rows: 76px 54px 1fr; min-height: 0; background: rgba(0,0,0,0.18); }
    .adnn-sidebar-identity-header { padding: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--adnn-tahoe-border-subtle); }
    .adnn-identity-profile-info { display: flex; align-items: center; gap: 12px; color: var(--adnn-tahoe-text-main); }
    .adnn-identity-avatar-placeholder { width: 40px; height: 40px; border-radius: 12px; background: var(--adnn-tahoe-primary-tint); display: grid; place-items: center; font-weight: 600; font-size: 15px; }
    .adnn-identity-profile-info h4 { font-size: 14.5px; font-weight: 500; margin: 0; letter-spacing: -0.01em; }
    .online-pill-indicator { font-size: 10px; margin: 2px 0 0; color: var(--adnn-tahoe-neon-green); font-family: monospace; }
    .adnn-close-overlay-btn { background: transparent; border: 0; color: #fff; cursor: pointer; width: 32px; height: 32px; display: grid; place-items: center; opacity: 0.6; }
    .adnn-close-overlay-btn:hover { opacity: 1; }
    
    .adnn-sidebar-search-container { padding: 8px 12px; }
    .adnn-search-input-group { background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; padding: 0 10px; height: 36px; }
    .adnn-search-input-group input { background: transparent; border: 0; outline: 0; color: #fff; font-size: 13px; width: 100%; margin-left: 8px; }
    .search-icon-span { color: var(--adnn-tahoe-text-muted); display: flex; }

    .adnn-sidebar-conversations-list { min-height: 0; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
    .empty-list-notice { padding: 40px 16px; text-align: center; color: var(--adnn-tahoe-text-muted); font-size: 12px; font-family: monospace; }
    
    .adnn-sidebar-chat-card-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; cursor: pointer; transition: background 0.15s ease; border: 1px solid transparent; }
    .adnn-sidebar-chat-card-item:hover { background: rgba(255,255,255,0.03); }
    .adnn-sidebar-chat-card-item.active-focus { background: rgba(39, 45, 207, 0.16); border-color: rgba(39, 45, 207, 0.3); }
    .card-item-avatar-element { width: 42px; height: 42px; border-radius: 50%; background: var(--adnn-tahoe-bg-glass-card); border: 1px solid var(--adnn-tahoe-border-subtle); display: grid; place-items: center; font-weight: 500; font-size: 14px; color: #fff; flex-shrink: 0; }
    .admin-system-glow-avatar { background: rgba(39, 45, 207, 0.3) !important; border-color: var(--adnn-tahoe-primary-tint) !important; color: #fff !important; }
    .card-item-body-content-block { flex: 1; min-width: 0; }
    .card-item-header-row { display: flex; justify-content: space-between; align-items: baseline; }
    .card-item-header-row h5 { margin: 0; font-size: 14px; font-weight: 500; color: var(--adnn-tahoe-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timestamp-metric-label { font-size: 10px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    .card-item-footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .message-snippet-paragraph { margin: 0; font-size: 12.5px; color: var(--adnn-tahoe-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread-count-badge-element { background: var(--adnn-tahoe-primary-tint); color: #fff; font-size: 9px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; display: grid; place-items: center; font-family: monospace; }

    /* Core Layout Workspace Component Fields Style Rules Layers */
    .adnn-chat-main-room-view { min-width: 0; min-height: 0; background: rgba(0,0,0,0.03); position: relative; }
    .empty-room-fallback-illustration { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--adnn-tahoe-text-muted); padding: 32px; }
    .illustration-art-logo { font-size: 44px; color: var(--adnn-tahoe-primary-tint); margin-bottom: 16px; animation: pulseGlow 2.5s infinite alternate; }
    .empty-room-fallback-illustration h3 { font-size: 17px; font-weight: 400; color: var(--adnn-tahoe-text-main); margin: 0 0 8px; }
    .empty-room-fallback-illustration p { font-size: 13px; max-width: 360px; margin: 0; line-height: 1.5; }
    
    .adnn-active-room-layout { display: grid; grid-template-rows: 76px 1fr auto; height: 100%; min-height: 0; position: relative; overflow: hidden; }
    .adnn-room-appbar-header { padding: 16px; border-bottom: 1px solid var(--adnn-tahoe-border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.1); }
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
    .adnn-call-trigger-btn svg { width: 15px; height: 15px; }

    /* Feed Messages View Area Scroll Structure Content Box */
    .adnn-chat-messages-scroll-area { min-height: 0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
    .adnn-message-bubble-wrapper { display: flex; width: 100%; position: relative; clear: both; }
    .adnn-message-bubble-wrapper.align-mine { justify-content: flex-end; }
    .adnn-message-bubble-wrapper.align-other { justify-content: flex-start; }
    
    .adnn-message-bubble-body-card-frame { max-width: 72%; padding: 10px 14px; border-radius: 18px; position: relative; word-wrap: break-word; }
    .align-mine .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-mine); color: #fff; border-bottom-right-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
    .align-other .adnn-message-bubble-body-card-frame { background: var(--adnn-tahoe-bubble-other); color: var(--adnn-tahoe-text-main); border: 1px solid var(--adnn-tahoe-border-subtle); border-bottom-left-radius: 4px; }
    
    .bubble-text-content-paragraph-layout-row p { margin: 0; font-size: 14.5px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; }
    .bubble-metadata-metrics-row-strip { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 5px; font-size: 9.5px; color: rgba(255,255,255,0.5); font-family: monospace; }
    .align-other .metric-timestamp-clock-label { color: var(--adnn-tahoe-text-muted); }
    .receipt-double-check-blue-active-color { color: #34b7f1 !important; }
    
    /* WhatsApp Dropdowns Fast Speed Overlays Toolbar Trigger System layout Box Style Component Rules Context Elements Layer */
    .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip {
      position: absolute; bottom: 100%; right: 0; background: rgba(22,22,26,0.96); border: 1px solid var(--adnn-tahoe-border-subtle);
      border-radius: 12px; padding: 4px; display: flex; gap: 2px; opacity: 0; pointer-events: none; transform: translateY(6px); transition: all 0.2s ease; z-index: 10; backdrop-filter: blur(10px);
    }
    .adnn-message-bubble-body-card-frame:hover .adnn-bubble-contextual-actions-absolute-dropdown-trigger-menu-strip { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .action-strip-dot-btn { background: transparent; border: 0; color: #fff; font-size: 13px; padding: 4px 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
    .action-strip-dot-btn:hover { background: rgba(255,255,255,0.1); opacity: 1; }
    .action-strip-dot-btn svg { width: 12px; height: 12px; }
    .delete-destructive-action-color-btn:hover { background: var(--adnn-tahoe-neon-red) !important; color: #fff; }

    .bubble-attached-media-frame-box { margin-bottom: 6px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 1px solid rgba(0,0,0,0.15); max-height: 240px; }
    .bubble-attached-media-frame-box img { width: 100%; height: auto; display: block; object-fit: cover; max-height: 240px; }
    
    .bubble-reply-context-reference-quote-box { background: rgba(0,0,0,0.15); border-left: 3px solid var(--adnn-tahoe-primary-tint); padding: 6px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
    .bubble-reply-context-reference-quote-box strong { display: block; color: rgba(255,255,255,0.85); font-size: 11px; }
    .bubble-reply-context-reference-quote-box p { margin: 2px 0 0; color: rgba(255,255,255,0.65); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .bubble-generic-file-attachment-download-anchor-link { display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(0,0,0,0.12); border-radius: 10px; text-decoration: none; color: inherit; margin-bottom: 6px; border: 1px solid var(--adnn-tahoe-border-subtle); }
    .generic-file-icon-avatar-badge { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.08); display: grid; place-items: center; }
    .generic-file-info-metadata-stack-column { min-width: 0; display: flex; flex-direction: column; }
    .generic-file-info-metadata-stack-column strong { font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .generic-file-info-metadata-stack-column small { font-size: 10px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }

    .bubble-reactions-row-strip-wrapper { position: absolute; top: calc(100% - 6px); left: 12px; display: flex; gap: 2px; background: #1c1c1f; border: 1px solid var(--adnn-tahoe-border-subtle); padding: 1px 4px; border-radius: 8px; font-size: 10px; z-index: 2; }

    /* Drag Drop Files Box Panel */
    .adnn-drag-drop-full-box-overlay { position: absolute; inset: 12px; z-index: 100; background: rgba(39, 45, 207, 0.15); backdrop-filter: blur(8px); border-radius: 20px; padding: 24px; pointer-events: none; }
    .drag-drop-card-view { border: 2px dashed var(--adnn-tahoe-primary-tint); border-radius: 16px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #fff; background: rgba(0,0,0,0.65); }
    .drag-icon-announcement { font-size: 32px; margin-bottom: 8px; }
    
    /* Composer Architecture Core Inputs Layout Style rules */
    .adnn-chat-footer-composer-wrapper { padding: 12px 16px; border-top: 1px solid var(--adnn-tahoe-border-subtle); background: rgba(14,14,18,0.45); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
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

    /* Opposite Mirror Camera Component Styles Rules Context */
    .adnn-composer-integrated-camera-mirror-box { position: relative; width: 100%; max-width: 240px; aspect-ratio: 4/3; border-radius: 14px; overflow: hidden; border: 1px solid var(--adnn-tahoe-primary-tint); box-shadow: 0 12px 30px rgba(0,0,0,0.4); margin-bottom: 4px; }
    .mirror-corrected-stream { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); background: #000; }
    .camera-mirror-controls-bar { position: absolute; bottom: 0; inset-inline: 0; background: linear-gradient(transparent, rgba(0,0,0,0.85)); padding: 8px; display: flex; justify-content: center; align-items: center; gap: 24px; }
    .camera-action-circle-btn { width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid #000; cursor: pointer; box-shadow: 0 0 10px rgba(255,255,255,0.4); }
    .camera-action-close-btn { background: rgba(0,0,0,0.6); border: 0; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }

    /* Advanced Audio Record Pulse Simulation */
    .adnn-voice-recording-view-component-layer { display: flex; align-items: center; gap: 10px; width: 100%; padding-left: 6px; }
    .live-blink-pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--adnn-tahoe-neon-red); animation: liveBlinkPulse 1s infinite alternate; }
    .voice-duration-chronometer { font-size: 13px; color: #fff; font-family: monospace; }
    .voice-wave-canvas-visualization-simulation { display: flex; align-items: center; gap: 2px; height: 20px; }
    .voice-wave-canvas-visualization-simulation span { width: 2px; height: 60%; background: var(--adnn-tahoe-primary-tint); border-radius: 1px; animation: soundWaveSim 0.6s infinite ease-in-out alternate; }
    .voice-wave-canvas-visualization-simulation span:nth-child(2n) { animation-delay: 0.15s; height: 40%; }
    .voice-wave-canvas-visualization-simulation span:nth-child(3n) { animation-delay: 0.3s; height: 90%; }
    .recording-session-active-pulse-red-glow-tint-style { background: var(--adnn-tahoe-neon-red) !important; color: #fff !important; animation: liveBlinkPulse 1.2s infinite alternate; }

    /* Connected Call Dynamic Interfaces Multi-Surface Window Stage */
    .call-summary-bubble-card-style { background: rgba(255,255,255,0.02) !important; border: 1px dashed var(--adnn-tahoe-border-subtle) !important; border-radius: 12px !important; text-align: center !important; width: 90% !important; max-width: 440px !important; margin: 4px auto !important; float: none !important; clear: both !important; }
    .call-summary-bubble-card-style p { font-family: monospace !important; font-size: 11.5px !important; color: var(--adnn-tahoe-text-muted) !important; }

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
    .call-interface-target-profile-avatar-banner-block h3 { margin: 0; font-size: 17px; font-weight: 500; }
    .call-interface-target-profile-avatar-banner-block p { margin: 4px 0 0; font-size: 11px; color: var(--adnn-tahoe-text-muted); font-family: monospace; }
    
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
    
    .decline-destructive-action-red-color-style-btn { background: var(--adnn-tahoe-neon-red) !important; border-color: transparent !important; border-radius: 50% !important; }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn { width: auto !important; padding: 0 20px !important; flex-direction: row !important; gap: 8px !important; border-radius: 20px !important; font-weight: 500; font-size: 14px; }
    #adnnCallIncomingActionsContextControlsContainerBoxStrip .decline-destructive-action-red-color-style-btn span { color: #fff !important; font-size: 13px !important; font-family: inherit !important; }

    .disabled-muted-state-active-glow-style-class-modifier-tint-color { background: rgba(255,255,255,0.2) !important; color: var(--adnn-tahoe-neon-red) !important; border-color: rgba(255,59,48,0.3) !important; }

    /* Completely Fluid Screen Bounds Rule Strategy (Zero Layout Cropping Overrides) */
    @media (max-width: 768px) {
      .adnn-chat-window-container { grid-template-columns: 1fr; height: 100dvh; border-radius: 0; border: 0; }
      .adnn-chat-sidebar-wrapper { display: grid !important; }
      .adnn-chat-main-room-view { display: none; }
      
      body.adnn-mobile-room-active-focus-view .adnn-chat-sidebar-wrapper { display: none !important; }
      body.adnn-mobile-room-active-focus-view .adnn-chat-main-room-view { display: block !important; position: fixed; inset: 0; z-index: 999999; }
      body.adnn-mobile-room-active-focus-view .adnn-active-room-layout { display: grid !important; }
      body.adnn-mobile-room-active-focus-view .adnn-back-arrow-mobile-btn { display: grid !important; }
      
      .adnn-chat-messages-scroll-area { padding: 12px; }
      .adnn-message-bubble-body-card-frame { max-width: 86%; }
      .adnn-chat-overlay-immersive { padding: 0; }
      
      .adnn-call-video-workspace-layout-grid-stage-frame-container-element-area.dual-active-camera-grid-layout-activated-style-override-class-layer-frame-box-slot-locator-instance { grid-template-columns: 1fr !important; grid-template-rows: 1fr 1fr; }
      .call-interface-window-card-box { height: 100%; border-radius: 0; justify-content: space-between; padding: 24px 16px; }
    }

    @keyframes pulseGlow { from { opacity: 0.6; transform: scale(0.98); } to { opacity: 1; transform: scale(1.02); } }
    @keyframes liveBlinkPulse { from { opacity: 0.3; } to { opacity: 1; } }
    @keyframes soundWaveSim { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
    
    .hidden { display: none !important; }
  `;
  document.head.appendChild(styleElementNodePointerInstanceReferenceLocationFieldUnit);
}
