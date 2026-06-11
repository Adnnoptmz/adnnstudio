import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/*
  ADNN Studio Firestore Chat
  New Apple/Tahoe inspired chat + call layer for account.html, designer-account.html and admin.html.
  Uses the existing Firestore rules/collections: chats, chats/{id}/messages, presence, calls, callInbox and chat-media storage.
*/

const ADMIN_EMAIL = "getavcollab@gmail.com";
const ADMIN_ALIAS_UID = "adnn-admin";
const DESIGNER_ROOM_ID = "designer_lounge";
const LIMIT_MESSAGES = 120;
const RING_TIMEOUT_MS = 60000;
const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const page = () => location.pathname.split("/").pop().toLowerCase() || "index.html";
const isAdminPage = () => page().includes("admin.html");
const isDesignerPage = () => page().includes("designer-account.html");
const isAccountPage = () => page().includes("account.html") && !isDesignerPage();
const isAdminEmail = (email = "") => String(email).toLowerCase() === ADMIN_EMAIL;
const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
const uidSafe = (v = "") => String(v).replace(/[^a-zA-Z0-9_-]/g, "_");
const now = () => Date.now();
const millis = v => v?.toMillis ? v.toMillis() : (typeof v === "number" ? v : 0);
const displayName = user => user?.displayName || user?.email?.split("@")[0] || "Studio user";
const initials = name => String(name || "?").trim().split(/\s+/).slice(0,2).map(p => p[0]).join("").toUpperCase() || "?";
const fmtTime = v => { const d = new Date(millis(v) || now()); return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); };
const fileIcon = type => type?.startsWith("image/") ? "image" : type?.startsWith("audio/") ? "audio" : "file";

const I = {
  search:`<svg viewBox="0 0 24 24"><path d="m21 21-4.2-4.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  send:`<svg viewBox="0 0 24 24"><path d="M4 12 20 5l-7 16-2-7-7-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m11 14 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  mic:`<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  phone:`<svg viewBox="0 0 24 24"><path d="M7.5 4.8 10 7.2c.6.6.7 1.5.2 2.2l-1 1.5a11.8 11.8 0 0 0 4.9 4.9l1.5-1c.7-.5 1.6-.4 2.2.2l2.4 2.5c.5.5.6 1.3.2 1.9-.8 1.3-2.4 2-4 1.5C9.6 18.8 5.2 14.4 3.1 7.6c-.5-1.6.2-3.2 1.5-4 .6-.4 1.4-.3 1.9.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  video:`<svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v9A2.5 2.5 0 0 1 13.5 19h-7A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 10 4-2.4v8.8L16 14v-4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  close:`<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  back:`<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star:`<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  trash:`<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cameraOff:`<svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h7A2.5 2.5 0 0 1 16 7.5v5M14 19H6.5A2.5 2.5 0 0 1 4 16.5v-9M16 10l4-2.4v7M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  end:`<svg viewBox="0 0 24 24"><path d="M6.5 14.5c3.5-3.1 7.5-3.1 11 0l1.7-1.7c.7-.7.7-1.8 0-2.5-4.5-4.2-9.9-4.2-14.4 0-.7.7-.7 1.8 0 2.5l1.7 1.7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  reply:`<svg viewBox="0 0 24 24"><path d="M10 7 5 12l5 5M6 12h7a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check:`<svg viewBox="0 0 24 24"><path d="m4 12 4 4 8-9M12 16l8-9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

let user = null;
let unsubs = [];
let activeChatId = "";
let activeChat = null;
let selectedReply = null;
let activeChatReadBy = {};
let activeTyping = {};
let typingTimer = null;
let recorder = null;
let chunks = [];
let call = null;
let ringAudio = null;
let localStream = null;
let remoteStream = null;
let pc = null;
let cameraFacingMode = "user";

function css() {
  if ($("#adnnFirestoreChatStyles")) return;
  const style = document.createElement("style");
  style.id = "adnnFirestoreChatStyles";
  style.textContent = `
  :root{--adnn-chat-accent:var(--accent,#272dcf);--adnn-chat-red:var(--red,#ff2602);--adnn-chat-bg:var(--bg,#050506);--adnn-chat-panel:var(--panel-bg,linear-gradient(135deg,rgba(34,34,38,.72),rgba(22,22,26,.58)));--adnn-chat-text:var(--text,var(--ink,#f5f5f7));--adnn-chat-muted:var(--muted,rgba(245,245,247,.62));--adnn-chat-line:var(--line,rgba(255,255,255,.08));--adnn-chat-input:var(--input-bg,rgba(255,255,255,.08));--adnn-chat-font:var(--font-body,ui-sans-serif,system-ui);--adnn-chat-mono:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
  #chat.view,#chats_view,#clientChatMount,#directChatMount{min-height:0!important;display:block!important;opacity:1!important;visibility:visible!important;overflow:visible!important}.adnn-chat-shell{height:min(78vh,760px);min-height:620px;width:100%;display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);border:1px solid var(--adnn-chat-line);border-radius:30px;overflow:hidden;background:var(--adnn-chat-panel);box-shadow:var(--glass-shadow,0 24px 70px rgba(0,0,0,.35));backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);color:var(--adnn-chat-text);font-family:var(--adnn-chat-font);position:relative;z-index:5}.adnn-chat-sidebar{border-right:1px solid var(--adnn-chat-line);min-width:0;display:flex;flex-direction:column;background:rgba(255,255,255,.025)}.adnn-chat-top{padding:18px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--adnn-chat-line)}.adnn-chat-logo{width:44px;height:44px;border-radius:16px;background:linear-gradient(135deg,var(--adnn-chat-accent),#6970ff);display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 12px 36px rgba(39,45,207,.35)}.adnn-chat-top h3{margin:0;font-size:17px;letter-spacing:-.03em}.adnn-chat-top p{margin:3px 0 0;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:11px}.adnn-chat-search{margin:14px 16px;display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid var(--adnn-chat-line);border-radius:16px;background:var(--adnn-chat-input)}.adnn-chat-search svg,.adnn-icon{width:18px;height:18px;display:block}.adnn-chat-search input{border:0;outline:0;background:transparent;color:var(--adnn-chat-text);width:100%;font-size:13px}.adnn-chat-list{overflow:auto;padding:0 10px 14px;display:grid;gap:8px}.adnn-chat-item{width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:12px;border-radius:20px;display:grid;grid-template-columns:44px 1fr auto;gap:11px;align-items:center;cursor:pointer;transition:.2s}.adnn-chat-item:hover,.adnn-chat-item.active{background:rgba(255,255,255,.08)}:root.light-theme .adnn-chat-item:hover,:root.light-theme .adnn-chat-item.active{background:rgba(0,0,0,.045)}.adnn-avatar{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:rgba(39,45,207,.14);color:var(--adnn-chat-accent);font-weight:700;position:relative}.adnn-presence-dot{position:absolute;right:1px;bottom:2px;width:10px;height:10px;border-radius:99px;background:#32d74b;border:2px solid var(--adnn-chat-bg)}.adnn-chat-item strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-chat-item small{display:block;margin-top:3px;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-unread{min-width:20px;height:20px;border-radius:999px;background:var(--adnn-chat-accent);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700}.adnn-room{min-width:0;display:flex;flex-direction:column;position:relative;background:radial-gradient(circle at 90% 4%,rgba(39,45,207,.16),transparent 26%)}.adnn-room-head{height:82px;padding:16px 20px;border-bottom:1px solid var(--adnn-chat-line);display:flex;align-items:center;gap:12px}.adnn-room-head .adnn-title{min-width:0;flex:1}.adnn-room-head strong{display:block;font-size:17px;letter-spacing:-.03em}.adnn-room-head small{display:block;margin-top:3px;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:11px}.adnn-room-actions{display:flex;gap:8px}.adnn-action{width:42px;height:42px;border-radius:16px;border:1px solid var(--adnn-chat-line);background:rgba(255,255,255,.06);color:var(--adnn-chat-text);display:grid;place-items:center;cursor:pointer;transition:.2s}.adnn-action:hover{transform:translateY(-1px);background:rgba(39,45,207,.16);color:#fff}.adnn-action.primary{background:var(--adnn-chat-accent);border-color:transparent;color:#fff}.adnn-action.danger{background:var(--adnn-chat-red);border-color:transparent;color:#fff}.adnn-action:disabled{opacity:.38;cursor:not-allowed}.adnn-back{display:none}.adnn-messages{flex:1;overflow:auto;padding:22px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}.adnn-empty{margin:auto;max-width:420px;text-align:center;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:12px;line-height:1.6}.adnn-bubble-row{display:flex;gap:8px;align-items:flex-end;max-width:82%}.adnn-bubble-row.mine{align-self:flex-end;flex-direction:row-reverse}.adnn-bubble{position:relative;padding:10px 12px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid var(--adnn-chat-line);box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:14px;line-height:1.45;word-break:break-word}.mine .adnn-bubble{background:linear-gradient(135deg,var(--adnn-chat-accent),#4651ff);color:#fff;border-color:transparent;border-bottom-right-radius:7px}.theirs .adnn-bubble{border-bottom-left-radius:7px}.adnn-bubble-meta{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:10px;font-family:var(--adnn-chat-mono);opacity:.68}.adnn-media-preview{display:block;max-width:min(320px,58vw);max-height:260px;border-radius:16px;margin:4px 0 8px;object-fit:cover}.adnn-file-card{display:flex;gap:10px;align-items:center;padding:10px;border-radius:16px;background:rgba(0,0,0,.08);text-decoration:none;color:inherit;margin-bottom:8px}.adnn-file-card span{font-family:var(--adnn-chat-mono);font-size:11px}.adnn-msg-tools{position:absolute;top:-18px;right:8px;display:none;gap:4px}.adnn-bubble:hover .adnn-msg-tools{display:flex}.adnn-mini{width:28px;height:28px;border:1px solid var(--adnn-chat-line);border-radius:12px;background:rgba(20,20,24,.86);color:#fff;display:grid;place-items:center;cursor:pointer}.adnn-reactions{display:flex;gap:4px;margin-top:6px}.adnn-reactions button{border:0;border-radius:999px;background:rgba(255,255,255,.13);padding:3px 7px;cursor:pointer}.adnn-composer{padding:14px 18px;border-top:1px solid var(--adnn-chat-line);display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:end;background:rgba(0,0,0,.05)}.adnn-composer textarea{resize:none;max-height:130px;min-height:46px;border:1px solid var(--adnn-chat-line);outline:0;border-radius:18px;padding:13px 14px;background:var(--adnn-chat-input);color:var(--adnn-chat-text);font-size:14px}.adnn-hidden-file{display:none}.adnn-attach-preview{position:absolute;left:20px;right:20px;bottom:82px;padding:10px 12px;border:1px solid var(--adnn-chat-line);border-radius:18px;background:var(--adnn-chat-panel);display:none;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 20px 50px rgba(0,0,0,.25)}.adnn-attach-preview.show{display:flex}.adnn-toast{position:fixed;right:22px;bottom:22px;z-index:99999;background:rgba(20,20,24,.9);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:12px 14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font-size:13px;max-width:330px}.adnn-call-layer{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.72);backdrop-filter:blur(18px) saturate(160%);display:none;align-items:center;justify-content:center;padding:22px}.adnn-call-layer.show{display:flex}.adnn-call-window{width:min(1120px,96vw);height:min(760px,92vh);border-radius:34px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#08080a;box-shadow:0 30px 100px rgba(0,0,0,.55);position:relative;color:#fff}.adnn-call-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:radial-gradient(circle at 50% 30%,#20203a,#050506 62%)}.adnn-call-local{position:absolute;right:20px;top:20px;width:min(230px,28vw);aspect-ratio:9/13;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,.18);box-shadow:0 16px 50px rgba(0,0,0,.45);transform:scaleX(-1);object-fit:cover;background:#111}.adnn-call-info{position:absolute;left:24px;top:24px}.adnn-call-info h3{margin:0;font-size:22px}.adnn-call-info p{margin:6px 0 0;color:rgba(255,255,255,.7);font-family:var(--adnn-chat-mono);font-size:12px}.adnn-call-controls{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:12px;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(20,20,24,.62);backdrop-filter:blur(18px)}.adnn-call-btn{width:56px;height:56px;border-radius:20px;border:0;background:rgba(255,255,255,.13);color:#fff;display:grid;place-items:center;cursor:pointer}.adnn-call-btn svg{width:23px;height:23px}.adnn-call-btn.off{background:rgba(255,255,255,.28)}.adnn-call-btn.end{background:var(--adnn-chat-red)}.adnn-incoming{position:fixed;right:22px;top:22px;z-index:99999;width:min(360px,calc(100vw - 44px));padding:16px;border-radius:24px;background:rgba(20,20,24,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 22px 80px rgba(0,0,0,.4);color:#fff;display:none}.adnn-incoming.show{display:block}.adnn-incoming h4{margin:0 0 5px}.adnn-incoming p{margin:0 0 14px;color:rgba(255,255,255,.68);font-family:var(--adnn-chat-mono);font-size:12px}.adnn-incoming-actions{display:flex;gap:10px}.adnn-chip{border:1px solid var(--adnn-chat-line);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:7px 10px;font-size:11px;font-family:var(--adnn-chat-mono)}@media(max-width:820px){.adnn-chat-shell{height:calc(100vh - 24px);min-height:560px;grid-template-columns:1fr;border-radius:24px}.adnn-chat-sidebar{border-right:0}.adnn-room{display:none}.adnn-chat-shell.room-open .adnn-chat-sidebar{display:none}.adnn-chat-shell.room-open .adnn-room{display:flex}.adnn-back{display:grid}.adnn-composer{grid-template-columns:auto 1fr auto}.adnn-composer .adnn-mic{display:none}.adnn-bubble-row{max-width:94%}.adnn-call-local{width:118px;border-radius:18px}.adnn-call-controls{gap:8px}.adnn-call-btn{width:50px;height:50px;border-radius:18px}}`;
  document.head.appendChild(style);
  style.textContent += `
  .adnn-composer .primary{display:none}.adnn-composer.has-send .primary{display:grid}.adnn-composer.has-send [data-record]{display:none}.adnn-voice-panel{display:none;align-items:center;gap:10px;margin:0 14px 12px;padding:10px 12px;border:1px solid var(--adnn-chat-line);border-radius:18px;background:rgba(255,255,255,.08);color:var(--adnn-chat-text)}.adnn-voice-panel.show{display:flex}.adnn-voice-dot{width:10px;height:10px;border-radius:999px;background:var(--adnn-chat-red);box-shadow:0 0 0 6px rgba(255,38,2,.14);animation:adnnPulse 1s infinite}.adnn-voice-time{font-family:var(--adnn-chat-mono);font-size:12px;color:var(--adnn-chat-muted);min-width:54px}.adnn-voice-panel audio{height:34px;flex:1;min-width:120px}.adnn-voice-panel .primary{display:grid!important}.adnn-attach-card{display:flex;align-items:center;gap:12px}.adnn-attach-thumb{width:48px;height:48px;border-radius:14px;object-fit:cover;background:rgba(255,255,255,.08)}.adnn-room-action,.adnn-action{pointer-events:auto}.adnn-room-actions .adnn-action:disabled{opacity:.45;filter:grayscale(1)}@keyframes adnnPulse{50%{opacity:.35;transform:scale(.8)}}

  .adnn-reply-preview{display:none;margin:0 16px 8px;padding:10px 12px;border-left:3px solid var(--adnn-chat-accent);border-radius:14px;background:rgba(255,255,255,.08);align-items:center;gap:10px}.adnn-reply-preview.show{display:flex}.adnn-reply-preview span{flex:1;min-width:0;color:var(--adnn-chat-muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-quote{border-left:3px solid var(--adnn-chat-accent);padding:7px 10px;margin-bottom:8px;border-radius:10px;background:rgba(255,255,255,.08);font-size:12px;color:var(--adnn-chat-muted)}.adnn-quote b{display:block;color:var(--adnn-chat-text);font-size:11px;margin-bottom:2px}.adnn-read-receipt{color:var(--adnn-chat-accent);display:inline-flex}.adnn-typing{display:inline-flex;align-items:center;gap:3px}.adnn-typing i{width:4px;height:4px;border-radius:50%;background:currentColor;animation:adnnPulse 1s infinite}.adnn-typing i:nth-child(2){animation-delay:.15s}.adnn-typing i:nth-child(3){animation-delay:.3s}.adnn-full-preview,.adnn-camera-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:none;color:#fff;font-family:var(--adnn-chat-font);backdrop-filter:blur(18px)}.adnn-full-preview.show,.adnn-camera-modal.show{display:grid;grid-template-rows:72px 1fr 96px}.adnn-preview-top,.adnn-camera-top{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.12)}.adnn-preview-title,.adnn-camera-title{font-weight:700;letter-spacing:-.02em;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-preview-body,.adnn-camera-body{display:grid;place-items:center;min-height:0;padding:22px}.adnn-preview-body img,.adnn-preview-body video,.adnn-camera-body video,.adnn-camera-body canvas{max-width:100%;max-height:100%;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.45)}.adnn-preview-file{width:min(520px,92vw);border:1px solid rgba(255,255,255,.15);border-radius:26px;padding:28px;background:rgba(255,255,255,.09);text-align:center}.adnn-preview-bottom,.adnn-camera-bottom{display:flex;align-items:center;gap:12px;padding:16px 18px;border-top:1px solid rgba(255,255,255,.12)}.adnn-preview-bottom input{flex:1;height:48px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.1);color:#fff;padding:0 16px;outline:0}.adnn-camera-shot{width:64px;height:64px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.25)}.adnn-dragging .adnn-room:after{content:'Drop to upload';position:absolute;inset:18px;border:2px dashed rgba(255,255,255,.45);border-radius:28px;background:rgba(39,45,207,.22);display:grid;place-items:center;font-weight:800;font-size:22px;z-index:30}.adnn-camera-btn{display:grid!important}

  `;
}

function toast(text) {
  const t = document.createElement("div"); t.className = "adnn-toast"; t.textContent = text; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function makeShell({ mode }) {
  const mount = isAdminPage() ? $("#chats_view") : ($("#directChatMount") || $("#clientChatMount") || $("#chat"));
  if (!mount) return null;
  mount.innerHTML = "";
  const shell = document.createElement("section");
  shell.className = "adnn-chat-shell";
  shell.innerHTML = `
    <aside class="adnn-chat-sidebar">
      <div class="adnn-chat-top"><div class="adnn-chat-logo">A</div><div><h3>${mode === "admin" ? "Studio chat" : "Private chat"}</h3><p>${mode === "admin" ? "Admin support matrix" : "ADNN live workspace"}</p></div></div>
      <label class="adnn-chat-search">${I.search}<input data-chat-search placeholder="Search chats, files, messages"></label>
      <div class="adnn-chat-list" data-chat-list><div class="adnn-empty">Loading secure chat...</div></div>
    </aside>
    <main class="adnn-room" data-room>
      <header class="adnn-room-head">
        <button class="adnn-action adnn-back" data-back>${I.back}</button>
        <div class="adnn-avatar" data-room-avatar>A</div><div class="adnn-title"><strong data-room-title>Select a chat</strong><small data-room-status>Messages, files, calls and voice notes appear here.</small></div>
        <div class="adnn-room-actions"><button class="adnn-action" data-audio disabled>${I.phone}</button><button class="adnn-action" data-video disabled>${I.video}</button></div>
      </header>
      <div class="adnn-messages" data-messages><div class="adnn-empty">Select a conversation to start.</div></div>
      <div class="adnn-attach-preview" data-attach-preview><span data-attach-name></span><button class="adnn-mini" data-attach-clear>${I.close}</button></div>
      <div class="adnn-reply-preview" data-reply-preview><span data-reply-text></span><button class="adnn-mini" type="button" data-reply-clear>${I.close}</button></div>
      <div class="adnn-voice-panel" data-voice-panel><span class="adnn-voice-dot"></span><span class="adnn-voice-time" data-voice-time>00:00</span><audio data-voice-playback controls></audio><button class="adnn-mini" type="button" data-voice-cancel>${I.close}</button><button class="adnn-action primary" type="button" data-voice-send>${I.send}</button></div>
      <form class="adnn-composer" data-composer>
        <input class="adnn-hidden-file" type="file" data-file accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.zip,.ai,.psd,.fig,.sketch">
        <button class="adnn-action" type="button" data-pick>${I.plus}</button>
        <button class="adnn-action adnn-camera-btn" type="button" data-camera-compose>${I.video}</button>
        <textarea data-text placeholder="Message..." rows="1"></textarea>
        <button class="adnn-action adnn-mic" type="button" data-record>${I.mic}</button>
        <button class="adnn-action primary" type="submit" data-send>${I.send}</button>
      </form>
    </main>`;
  mount.appendChild(shell);
  shell.querySelector("[data-back]").onclick = () => shell.classList.remove("room-open");
  return shell;
}

function updateBadge(key, count) {
  $$(`[data-account-badge="${key}"], [data-account-badge="${key}s"]`).forEach(b => { b.textContent = count > 99 ? "99+" : String(count); b.hidden = !count; });
}

async function isDesigner(uid) { try { return (await getDoc(doc(db, "designers", uid))).exists(); } catch { return false; } }
async function isAdminUser(u) { if (!u) return false; if (isAdminEmail(u.email)) return true; try { return (await getDoc(doc(db, "admins", u.uid))).exists(); } catch { return false; } }
function chatIdForSupport(u) { return `client_${uidSafe(u.uid)}`; }
function directChatId(a, b) { return `direct_${[uidSafe(a), uidSafe(b)].sort().join("_")}`; }

async function ensureSupportChat(u) {
  const id = chatIdForSupport(u);
  await setDoc(doc(db, "chats", id), {
    type:"support", clientUid:u.uid, clientEmail:u.email || "", clientName:displayName(u),
    participantUids:[u.uid, ADMIN_ALIAS_UID], participantEmails:[u.email || ADMIN_EMAIL, ADMIN_EMAIL],
    participantNames:{ [u.uid]:displayName(u), [ADMIN_ALIAS_UID]:"ADNN Studio Support" },
    lastMessage:"Chat opened", updatedAt:serverTimestamp(), createdAt:serverTimestamp()
  }, { merge:true });
  return id;
}

async function ensureDesignerRoom(u) {
  await setDoc(doc(db, "chats", DESIGNER_ROOM_ID), {
    type:"designer-room", roomKey:"designer_lounge", participantUids:[u.uid], participantEmails:[u.email || ""], participantNames:{ [u.uid]:displayName(u) },
    lastMessage:"Designer lounge", updatedAt:serverTimestamp(), createdAt:serverTimestamp()
  }, { merge:true }).catch(()=>{});
  return DESIGNER_ROOM_ID;
}

function otherFromChat(c) {
  const names = c.participantNames || {}; const emails = c.participantEmailMap || {};
  const uids = Array.isArray(c.participantUids) ? c.participantUids : [];
  let other = uids.find(x => x !== user?.uid && x !== ADMIN_ALIAS_UID) || (c.clientUid && c.clientUid !== user?.uid ? c.clientUid : ADMIN_ALIAS_UID);
  if (c.type === "support" && !isAdminPage()) other = ADMIN_ALIAS_UID;
  return { uid: other, name: names[other] || (other === ADMIN_ALIAS_UID ? "ADNN Studio Support" : c.clientName || "Studio user"), email: emails[other] || c.clientEmail || "" };
}

function subscribeChats(shell, mode) {
  unsubs.forEach(fn => fn()); unsubs = [];
  const list = shell.querySelector("[data-chat-list]");
  let q;
  if (mode === "admin") q = collection(db, "chats");
  else q = query(collection(db, "chats"), where("participantUids", "array-contains", user.uid));
  const unsub = onSnapshot(q, snap => {
    let chats = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const hasRealActivity = c => !!c.lastSenderUid || (c.lastMessage && !["Chat opened", "Designer lounge"].includes(c.lastMessage));
    chats = chats.filter(hasRealActivity);
    if (mode !== "admin") chats = chats.filter(c => c.type !== "designer-room" || isDesignerPage());
    chats.sort((a,b) => millis(b.updatedAt || b.createdAt) - millis(a.updatedAt || a.createdAt));
    renderChatList(shell, chats, mode);
    updateBadge("chat", chats.length);
  }, () => list.innerHTML = `<div class="adnn-empty">Chat access is not ready. Check sign-in and Firestore rules.</div>`);
  unsubs.push(unsub);
}

function renderChatList(shell, chats, mode) {
  const list = shell.querySelector("[data-chat-list]");
  const term = shell.querySelector("[data-chat-search]")?.value?.toLowerCase() || "";
  let filtered = chats.filter(c => JSON.stringify(c).toLowerCase().includes(term));
  if (!filtered.length) { list.innerHTML = `<div class="adnn-empty">No chats found. Your new chat UI is visible and ready.</div>`; return; }
  list.innerHTML = "";
  filtered.forEach(c => {
    const other = otherFromChat(c);
    const title = mode === "admin" ? (c.clientName || c.clientEmail || c.roomKey || other.name) : (c.type === "designer-room" ? "Designer Lounge" : other.name);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = `adnn-chat-item ${c.id === activeChatId ? "active" : ""}`;
    btn.innerHTML = `<div class="adnn-avatar">${esc(initials(title))}</div><span><strong>${esc(title)}</strong><small>${esc(c.lastMessage || c.clientEmail || other.email || "Tap to open")}</small></span><time class="adnn-chip">${c.updatedAt ? fmtTime(c.updatedAt) : "now"}</time>`;
    btn.onclick = () => openChat(shell, c, mode);
    list.appendChild(btn);
  });
}

function openChat(shell, chat, mode) {
  activeChatId = chat.id; activeChat = chat; shell.classList.add("room-open");
  const other = otherFromChat(chat); const title = mode === "admin" ? (chat.clientName || chat.clientEmail || other.name) : (chat.type === "designer-room" ? "Designer Lounge" : other.name);
  shell.querySelector("[data-room-title]").textContent = title;
  shell.querySelector("[data-room-avatar]").textContent = initials(title);
  shell.querySelector("[data-room-status]").textContent = chat.type === "designer-room" ? "Shared designer workspace" : (other.email || "Online status updates live");
  shell.querySelector("[data-audio]").disabled = false; shell.querySelector("[data-video]").disabled = false;
  shell.querySelector("[data-audio]").onclick = () => startCall("audio", chat, other, title);
  shell.querySelector("[data-video]").onclick = () => startCall("video", chat, other, title);
  bindComposer(shell, chat);
  if (window.__adnnActiveChatUnsub) window.__adnnActiveChatUnsub();
  window.__adnnActiveChatUnsub = onSnapshot(doc(db, "chats", chat.id), s => {
    const d = s.data() || {}; activeChatReadBy = d.readBy || {}; activeTyping = d.typing || {};
    const othersTyping = Object.entries(activeTyping).filter(([uid,t]) => uid !== user.uid && Date.now() - Number(t || 0) < 7000);
    shell.querySelector("[data-room-status]").innerHTML = othersTyping.length ? typingHtml() : (chat.type === "designer-room" ? "Shared designer workspace" : (other.email || "Online status updates live"));
  });
  markChatRead(chat.id);
  if (window.__adnnMsgUnsub) window.__adnnMsgUnsub();
  window.__adnnMsgUnsub = onSnapshot(query(collection(db, "chats", chat.id, "messages"), orderBy("createdAt", "asc"), limit(LIMIT_MESSAGES)), snap => {
    const messages = snap.docs.map(d => ({ id:d.id, ...d.data() })); renderMessages(shell, messages); markChatRead(chat.id);
  }, () => shell.querySelector("[data-messages]").innerHTML = `<div class="adnn-empty">Messages could not load for this chat.</div>`);
}


function messagePreview(m) {
  if (!m) return "";
  if (m.text) return m.text;
  if (m.mediaType?.startsWith("image/")) return "Photo";
  if (m.mediaType?.startsWith("video/")) return "Video";
  if (m.mediaType?.startsWith("audio/")) return "Voice message";
  return m.mediaName || "Attachment";
}
function setReply(shell, m) {
  selectedReply = { id:m.id, senderName:m.senderName || "Studio user", text:messagePreview(m).slice(0,180) };
  const box = shell.querySelector("[data-reply-preview]");
  box?.classList.add("show");
  shell.querySelector("[data-reply-text]").textContent = `Reply to ${selectedReply.senderName}: ${selectedReply.text}`;
  shell.querySelector("[data-text]")?.focus();
}
function clearReply(shell) {
  selectedReply = null;
  shell?.querySelector("[data-reply-preview]")?.classList.remove("show");
}
function otherUidForReceipt() {
  const other = activeChat ? otherFromChat(activeChat) : null;
  return other?.uid || ADMIN_ALIAS_UID;
}
function receiptHtml(m, mine) {
  if (!mine) return "";
  const other = otherUidForReceipt();
  const readAt = activeChatReadBy?.[other];
  const isRead = readAt && Number(readAt) >= millis(m.createdAt);
  return `<span class="adnn-read-receipt" title="${isRead ? "Read" : "Sent"}">${I.check}</span>`;
}
async function markChatRead(chatId) {
  if (!chatId || !user) return;
  try { await setDoc(doc(db, "chats", chatId), { readBy:{ [user.uid]: Date.now() } }, { merge:true }); } catch {}
}
function typingHtml() { return `<span class="adnn-typing">typing <i></i><i></i><i></i></span>`; }
async function setTyping(chatId, on=true) {
  if (!chatId || !user) return;
  try { await setDoc(doc(db, "chats", chatId), { typing:{ [user.uid]: on ? Date.now() : 0 } }, { merge:true }); } catch {}
}

function renderMessages(shell, messages) {
  const wrap = shell.querySelector("[data-messages]");
  if (!messages.length) { wrap.innerHTML = `<div class="adnn-empty">No messages yet. Send text, files, voice notes, or start a call.</div>`; return; }
  wrap.innerHTML = "";
  const favs = new Set(JSON.parse(localStorage.getItem(`adnnFavs_${user.uid}`) || "[]"));
  const hidden = new Set(JSON.parse(localStorage.getItem(`adnnHidden_${user.uid}`) || "[]"));
  messages.filter(m => !hidden.has(m.id)).forEach(m => {
    const mine = m.senderUid === user.uid;
    const row = document.createElement("div"); row.className = `adnn-bubble-row ${mine ? "mine" : "theirs"}`;
    const bubble = document.createElement("div"); bubble.className = "adnn-bubble";
    const canDelete = mine || isAdminEmail(user.email);
    const media = m.mediaUrl ? mediaHtml(m) : "";
    const fav = favs.has(m.id) ? "★" : "☆";
    bubble.innerHTML = `<div class="adnn-msg-tools"><button class="adnn-mini" data-reply>${I.reply}</button><button class="adnn-mini" data-fav>${fav}</button>${canDelete ? `<button class="adnn-mini" data-del>${I.trash}</button>` : `<button class="adnn-mini" data-hide>${I.close}</button>`}</div>${m.replyTo ? `<div class="adnn-quote"><b>${esc(m.replyTo.senderName || "Reply")}</b>${esc(m.replyTo.text || "")}</div>` : ""}${media}${m.text ? `<div>${esc(m.text)}</div>` : ""}<div class="adnn-bubble-meta"><span>${esc(m.senderName || "")}</span><span>${fmtTime(m.createdAt)}</span>${m.edited ? "<span>edited</span>" : ""}${receiptHtml(m, mine)}</div>`;
    bubble.querySelector("[data-reply]")?.addEventListener("click", () => setReply(shell, m));
    bubble.querySelector("[data-fav]")?.addEventListener("click", () => toggleLocalSet(`adnnFavs_${user.uid}`, m.id));
    bubble.querySelector("[data-hide]")?.addEventListener("click", () => toggleLocalSet(`adnnHidden_${user.uid}`, m.id));
    bubble.querySelector("[data-del]")?.addEventListener("click", () => deleteMessage(m));
    row.appendChild(bubble); wrap.appendChild(row);
  });
  wrap.scrollTop = wrap.scrollHeight;
}

function mediaHtml(m) {
  if (m.mediaType?.startsWith("image/")) return `<img class="adnn-media-preview" src="${esc(m.mediaUrl)}" alt="Attachment">`;
  if (m.mediaType?.startsWith("video/")) return `<video class="adnn-media-preview" src="${esc(m.mediaUrl)}" controls playsinline></video>`;
  if (m.mediaType?.startsWith("audio/")) return `<div class="adnn-file-card"><b>voice</b><audio src="${esc(m.mediaUrl)}" controls></audio></div>`;
  return `<a class="adnn-file-card" href="${esc(m.mediaUrl)}" target="_blank" rel="noopener"><b>${esc(fileIcon(m.mediaType))}</b><span>${esc(m.mediaName || "Download file")}</span></a>`;
}
function reactionHtml(m) { const r = m.reactions || {}; const vals = Object.values(r); return vals.length ? `<div class="adnn-reactions">${vals.map(v => `<button>${esc(v)}</button>`).join("")}</div>` : ""; }
function toggleLocalSet(key, id) { const s = new Set(JSON.parse(localStorage.getItem(key) || "[]")); s.has(id) ? s.delete(id) : s.add(id); localStorage.setItem(key, JSON.stringify([...s])); if (activeChat) openChat($(".adnn-chat-shell"), activeChat, isAdminPage()?"admin":"user"); }
async function reactMessage(m, emoji) { try { await updateDoc(doc(db, "chats", activeChatId, "messages", m.id), { [`reactions.${user.uid}`]: emoji, edited:true }); } catch { toast("Reaction saved only when rules allow message updates. Current rules allow sender/admin updates."); } }
async function deleteMessage(m) { try { await deleteDoc(doc(db, "chats", activeChatId, "messages", m.id)); toast("Message deleted."); } catch { toggleLocalSet(`adnnHidden_${user.uid}`, m.id); toast("Hidden for you. Firestore rules allow full delete for sender/admin only."); } }


async function sendMessage(chat, text = "", file = null) {
  if (!chat?.id || !user) return;
  let mediaUrl = "", mediaType = "", mediaName = "";
  try {
    if (file) {
      mediaType = file.type || "application/octet-stream";
      mediaName = file.name || `attachment-${Date.now()}`;
      const path = `chat-media/${chat.id}/${Date.now()}-${uidSafe(mediaName)}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: mediaType });
      mediaUrl = await getDownloadURL(r);
    }
    const payload = {
      senderUid: user.uid,
      senderName: displayName(user),
      senderEmail: user.email || "",
      text: text || "",
      mediaUrl,
      mediaType,
      mediaName,
      replyTo: selectedReply || null,
      createdAt: serverTimestamp(),
      status: "sent"
    };
    await addDoc(collection(db, "chats", chat.id, "messages"), payload);
    const lastMessage = text || (mediaType.startsWith("image/") ? "Photo" : mediaType.startsWith("video/") ? "Video" : mediaType.startsWith("audio/") ? "Voice message" : (mediaName || "Attachment"));
    await setDoc(doc(db, "chats", chat.id), {
      lastMessage,
      lastSenderUid: user.uid,
      updatedAt: serverTimestamp(),
      typing: { [user.uid]: 0 }
    }, { merge:true });
  } catch (e) {
    console.error(e);
    toast("Message could not be sent. Check Firebase Storage / Firestore rules.");
  }
}

function bindComposer(shell, chat) {
  const form = shell.querySelector("[data-composer]");
  const text = shell.querySelector("[data-text]");
  const file = shell.querySelector("[data-file]");
  const pick = shell.querySelector("[data-pick]");
  const rec = shell.querySelector("[data-record]");
  const camBtn = shell.querySelector("[data-camera-compose]");
  const prev = shell.querySelector("[data-attach-preview]");
  const voicePanel = shell.querySelector("[data-voice-panel]");
  const voiceTime = shell.querySelector("[data-voice-time]");
  const voiceAudio = shell.querySelector("[data-voice-playback]");
  const voiceCancel = shell.querySelector("[data-voice-cancel]");
  const voiceSend = shell.querySelector("[data-voice-send]");
  let voiceBlob = null, voiceUrl = "", voiceStarted = 0, voiceTimer = null;
  let stagedFile = null;

  shell.querySelector("[data-reply-clear]").onclick = () => clearReply(shell);
  const refreshComposer = () => {
    const hasText = !!text.value.trim();
    const hasFile = !!stagedFile;
    form.classList.toggle("has-send", hasText || hasFile);
    rec.hidden = hasText || hasFile;
  };
  const setStage = f => { stagedFile = f || null; refreshComposer(); };
  const clearVoice = () => {
    if (recorder && recorder.state === "recording") recorder.stop();
    recorder = null; chunks = []; voiceBlob = null;
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    voiceUrl = ""; voiceAudio.removeAttribute("src");
    voicePanel.classList.remove("show"); clearInterval(voiceTimer); voiceTimer = null; voiceTime.textContent = "00:00";
  };
  const ensureFullPreview = () => {
    let m = document.getElementById("adnnFullUploadPreview");
    if (m) return m;
    m = document.createElement("div"); m.id = "adnnFullUploadPreview"; m.className = "adnn-full-preview";
    m.innerHTML = `<div class="adnn-preview-top"><button class="adnn-action" data-prev-close>${I.close}</button><div class="adnn-preview-title" data-prev-title>Preview</div></div><div class="adnn-preview-body" data-prev-body></div><div class="adnn-preview-bottom"><input data-prev-caption placeholder="Add a caption"><button class="adnn-action primary" data-prev-send>${I.send}</button></div>`;
    document.body.appendChild(m); return m;
  };
  const openFullPreview = f => {
    if (!f) return; setStage(f);
    const m = ensureFullPreview(); const body = m.querySelector("[data-prev-body]"); const title = m.querySelector("[data-prev-title]");
    const url = URL.createObjectURL(f); title.textContent = f.name;
    if (f.type.startsWith("image/")) body.innerHTML = `<img src="${url}" alt="Preview">`;
    else if (f.type.startsWith("video/")) body.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
    else if (f.type.startsWith("audio/")) body.innerHTML = `<div class="adnn-preview-file"><h2>Voice / audio file</h2><audio src="${url}" controls></audio><p>${esc(f.name)}</p></div>`;
    else body.innerHTML = `<div class="adnn-preview-file"><h2>Attachment</h2><p>${esc(f.name)}</p><small>${Math.round(f.size/1024)} KB</small></div>`;
    m.classList.add("show");
    m.querySelector("[data-prev-close]").onclick = () => { m.classList.remove("show"); setStage(null); file.value=""; URL.revokeObjectURL(url); };
    m.querySelector("[data-prev-send]").onclick = async () => {
      const caption = m.querySelector("[data-prev-caption]").value.trim();
      await sendMessage(chat, caption, stagedFile); m.classList.remove("show"); file.value=""; setStage(null); m.querySelector("[data-prev-caption]").value=""; clearReply(shell); URL.revokeObjectURL(url);
    };
  };
  const ensureCamera = () => {
    let m = document.getElementById("adnnCameraComposer"); if (m) return m;
    m = document.createElement("div"); m.id = "adnnCameraComposer"; m.className = "adnn-camera-modal";
    m.innerHTML = `<div class="adnn-camera-top"><button class="adnn-action" data-cam-close>${I.close}</button><div class="adnn-camera-title">Camera</div><button class="adnn-action" data-cam-switch>↺</button></div><div class="adnn-camera-body"><video data-cam-video autoplay muted playsinline></video><canvas data-cam-canvas hidden></canvas></div><div class="adnn-camera-bottom"><button class="adnn-camera-shot" data-cam-shot></button><input data-cam-caption placeholder="Add a caption" style="flex:1;height:48px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.1);color:#fff;padding:0 16px;outline:0"><button class="adnn-action primary" data-cam-send>${I.send}</button></div>`;
    document.body.appendChild(m); return m;
  };
  const openCamera = async () => {
    const m = ensureCamera(); const video = m.querySelector("[data-cam-video]"); const canvas = m.querySelector("[data-cam-canvas]"); let stream = null; let photoFile = null;
    const start = async () => { stream?.getTracks().forEach(t=>t.stop()); stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:cameraFacingMode }, audio:false }); video.srcObject = stream; video.hidden=false; canvas.hidden=true; photoFile=null; };
    try { await start(); m.classList.add("show"); } catch { return toast("Camera permission was blocked."); }
    m.querySelector("[data-cam-close]").onclick = () => { stream?.getTracks().forEach(t=>t.stop()); m.classList.remove("show"); };
    m.querySelector("[data-cam-switch]").onclick = async () => { cameraFacingMode = cameraFacingMode === "user" ? "environment" : "user"; await start(); };
    m.querySelector("[data-cam-shot]").onclick = async () => { canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height); video.hidden=true; canvas.hidden=false; const blob = await new Promise(r=>canvas.toBlob(r,"image/jpeg",.92)); photoFile = new File([blob], `camera-${Date.now()}.jpg`, { type:"image/jpeg" }); };
    m.querySelector("[data-cam-send]").onclick = async () => { if (!photoFile) m.querySelector("[data-cam-shot]").click(); setTimeout(async()=>{ if (!photoFile) return; await sendMessage(chat, m.querySelector("[data-cam-caption]").value.trim(), photoFile); stream?.getTracks().forEach(t=>t.stop()); m.classList.remove("show"); m.querySelector("[data-cam-caption]").value=""; clearReply(shell); }, 120); };
  };

  pick.onclick = () => file.click();
  camBtn.onclick = openCamera;
  file.onchange = () => openFullPreview(file.files[0]);
  shell.querySelector("[data-attach-clear]").onclick = () => { file.value = ""; prev.classList.remove("show"); setStage(null); };
  text.oninput = () => { text.style.height = "auto"; text.style.height = Math.min(text.scrollHeight, 130) + "px"; refreshComposer(); setTyping(chat.id, !!text.value.trim()); clearTimeout(typingTimer); typingTimer = setTimeout(()=>setTyping(chat.id,false),2500); };
  text.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && text.value.trim()) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async e => { e.preventDefault(); if (!text.value.trim() && !stagedFile) return; await sendMessage(chat, text.value.trim(), stagedFile); text.value=""; text.style.height=""; file.value=""; setStage(null); clearReply(shell); setTyping(chat.id,false); };
  [shell.querySelector("[data-messages]"), shell].forEach(zone => {
    zone.ondragover = e => { e.preventDefault(); shell.classList.add("adnn-dragging"); };
    zone.ondragleave = e => { if (!shell.contains(e.relatedTarget)) shell.classList.remove("adnn-dragging"); };
    zone.ondrop = e => { e.preventDefault(); shell.classList.remove("adnn-dragging"); const f = e.dataTransfer?.files?.[0]; if (f) openFullPreview(f); };
  });
  rec.onclick = async () => {
    if (form.classList.contains("has-send")) return;
    if (recorder && recorder.state === "recording") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true }); chunks = []; voiceBlob = null; voicePanel.classList.add("show"); voiceAudio.removeAttribute("src");
      voiceStarted = Date.now(); voiceTimer = setInterval(() => { const s = Math.floor((Date.now() - voiceStarted) / 1000); voiceTime.textContent = `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }, 250);
      recorder = new MediaRecorder(stream); recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.onstop = () => { stream.getTracks().forEach(t=>t.stop()); clearInterval(voiceTimer); voiceTimer = null; voiceBlob = new Blob(chunks, { type:"audio/webm" }); voiceUrl = URL.createObjectURL(voiceBlob); voiceAudio.src = voiceUrl; };
      recorder.start();
    } catch { toast("Microphone permission was blocked."); }
  };
  voiceCancel.onclick = clearVoice;
  voiceSend.onclick = async () => { if (recorder && recorder.state === "recording") { recorder.stop(); await new Promise(resolve => setTimeout(resolve, 350)); } if (!voiceBlob) return toast("Record a voice note first."); const vf = new File([voiceBlob], `voice-${Date.now()}.webm`, { type:"audio/webm" }); await sendMessage(chat, "", vf); clearVoice(); clearReply(shell); };
  refreshComposer();
}

function callLayer() {
  let layer = $("#adnnCallLayer"); if (layer) return layer;
  layer = document.createElement("div"); layer.id = "adnnCallLayer"; layer.className = "adnn-call-layer";
  layer.innerHTML = `<div class="adnn-call-window"><video class="adnn-call-remote" data-remote autoplay playsinline></video><video class="adnn-call-local" data-local autoplay muted playsinline></video><div class="adnn-call-info"><h3 data-call-title>Calling...</h3><p data-call-status>Preparing secure connection</p></div><div class="adnn-call-controls"><button class="adnn-call-btn" data-mute>${I.mic}</button><button class="adnn-call-btn" data-camera>${I.video}</button><button class="adnn-call-btn" data-switch>↺</button><button class="adnn-call-btn end" data-end>${I.end}</button></div></div>`;
  document.body.appendChild(layer); layer.querySelector("[data-end]").onclick = () => endCall(true); layer.querySelector("[data-mute]").onclick = toggleMute; layer.querySelector("[data-camera]").onclick = toggleCamera; layer.querySelector("[data-switch]").onclick = switchCamera; return layer;
}
async function startLocal(kind) { localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:kind === "video" ? { facingMode:cameraFacingMode } : false }); const v = callLayer().querySelector("[data-local]"); v.srcObject = localStream; }
function targetUid(chat, other) { return isAdminPage() ? (chat.clientUid || other.uid) : other.uid; }
async function startCall(kind, chat, other, label) {
  const receiverUid = targetUid(chat, other); if (!receiverUid || receiverUid === user.uid) return toast("Select another user before calling.");
  try {
    await startLocal(kind); setupPeer(kind); callLayer().classList.add("show"); $("[data-call-title]", callLayer()).textContent = label; $("[data-call-status]", callLayer()).textContent = `${kind} call ringing...`;
    const callId = `call_${uidSafe(chat.id)}_${Date.now()}`; call = { id:callId, chatId:chat.id, kind, receiverUid, callerUid:isAdminPage()?ADMIN_ALIAS_UID:user.uid, label };
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.onicecandidate = e => e.candidate && addDoc(collection(db,"calls",callId,"offerCandidates"), e.candidate.toJSON());
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const data = { chatId:chat.id, kind, callerUid:call.callerUid, callerRealUid:user.uid, callerName:displayName(user), receiverUid, participants:[call.callerUid, receiverUid], status:"ringing", offer:{ type:offer.type, sdp:offer.sdp }, createdAt:serverTimestamp(), expiresAtMs:Date.now()+RING_TIMEOUT_MS };
    await setDoc(doc(db,"calls",callId), data); await setDoc(doc(db,"callInbox",receiverUid,"items",callId), { ...data, callId }, { merge:true });
    listenCall(callId, "caller"); setTimeout(() => { if (call?.id === callId) endCall(true, "missed"); }, RING_TIMEOUT_MS);
  } catch(e) { console.error(e); toast("Camera/microphone permission or call setup failed."); endCall(false); }
}
function setupPeer(kind) { pc = new RTCPeerConnection({ iceServers:ICE_SERVERS }); remoteStream = new MediaStream(); callLayer().querySelector("[data-remote]").srcObject = remoteStream; pc.ontrack = e => e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t)); pc.onconnectionstatechange = () => { if (pc?.connectionState === "connected") $("[data-call-status]", callLayer()).textContent = "Connected"; if (["failed","disconnected","closed"].includes(pc?.connectionState)) $("[data-call-status]", callLayer()).textContent = pc.connectionState; }; }
function listenCall(callId, role) { if (window.__adnnCallUnsub) window.__adnnCallUnsub(); window.__adnnCallUnsub = onSnapshot(doc(db,"calls",callId), async s => { const c=s.data(); if(!c) return; if(c.status === "ended" || c.status === "rejected" || c.status === "missed") endCall(false); if(role === "caller" && c.answer && !pc.currentRemoteDescription) await pc.setRemoteDescription(new RTCSessionDescription(c.answer)); }); const col = role === "caller" ? "answerCandidates" : "offerCandidates"; if (window.__adnnIceUnsub) window.__adnnIceUnsub(); window.__adnnIceUnsub = onSnapshot(collection(db,"calls",callId,col), snap => snap.docChanges().forEach(ch => { if (ch.type === "added") pc?.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(()=>{}); })); }
function incomingBox() { let b=$("#adnnIncomingCall"); if(b) return b; b=document.createElement("div"); b.id="adnnIncomingCall"; b.className="adnn-incoming"; b.innerHTML=`<h4 data-in-title>Incoming call</h4><p data-in-sub>Someone is calling you</p><div class="adnn-incoming-actions"><button class="adnn-action primary" data-accept>Accept</button><button class="adnn-action danger" data-reject>Reject</button></div>`; document.body.appendChild(b); return b; }
function listenIncoming() { const ids = [user.uid]; if (isAdminEmail(user.email)) ids.push(ADMIN_ALIAS_UID); ids.forEach(id => unsubs.push(onSnapshot(collection(db,"callInbox",id,"items"), snap => snap.docChanges().forEach(ch => { const c={ id:ch.doc.id, ...ch.doc.data() }; if(ch.type === "added" && c.status === "ringing" && c.callerRealUid !== user.uid) showIncoming(c, id); })))); }
function showIncoming(c, inboxUid) { const b=incomingBox(); b.classList.add("show"); b.querySelector("[data-in-title]").textContent = `${c.kind === "video" ? "Video" : "Audio"} call`; b.querySelector("[data-in-sub]").textContent = `${c.callerName || "Studio user"} is calling`; b.querySelector("[data-accept]").onclick = () => acceptCall(c, inboxUid); b.querySelector("[data-reject]").onclick = () => rejectCall(c, inboxUid); }
async function acceptCall(c, inboxUid) { incomingBox().classList.remove("show"); try { call = { id:c.callId || c.id, chatId:c.chatId, kind:c.kind, receiverUid:c.receiverUid, callerUid:c.callerUid, label:c.callerName }; await startLocal(c.kind); setupPeer(c.kind); callLayer().classList.add("show"); $("[data-call-title]", callLayer()).textContent = c.callerName || "Call"; const snap=await getDoc(doc(db,"calls",call.id)); const data=snap.data(); await pc.setRemoteDescription(new RTCSessionDescription(data.offer)); localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); pc.onicecandidate = e => e.candidate && addDoc(collection(db,"calls",call.id,"answerCandidates"), e.candidate.toJSON()); const answer=await pc.createAnswer(); await pc.setLocalDescription(answer); await updateDoc(doc(db,"calls",call.id), { status:"accepted", answer:{ type:answer.type, sdp:answer.sdp }, answeredAt:serverTimestamp() }); await deleteDoc(doc(db,"callInbox",inboxUid,"items",call.id)).catch(()=>{}); listenCall(call.id,"receiver"); } catch(e) { console.error(e); toast("Could not accept the call."); endCall(false); } }
async function rejectCall(c, inboxUid) { incomingBox().classList.remove("show"); await updateDoc(doc(db,"calls",c.callId || c.id), { status:"rejected", endedAt:serverTimestamp() }).catch(()=>{}); await deleteDoc(doc(db,"callInbox",inboxUid,"items",c.callId || c.id)).catch(()=>{}); }
async function endCall(write=true, status="ended") { if (write && call?.id) { await updateDoc(doc(db,"calls",call.id), { status, endedAt:serverTimestamp() }).catch(()=>{}); await addDoc(collection(db,"chats",call.chatId,"messages"), { senderUid:user?.uid || "system", senderName:displayName(user), senderEmail:user?.email || "", text:`${call.kind === "video" ? "Video" : "Audio"} call ${status}.`, createdAt:serverTimestamp(), status:"sent", system:true }).catch(()=>{}); } if(window.__adnnCallUnsub) window.__adnnCallUnsub(); if(window.__adnnIceUnsub) window.__adnnIceUnsub(); pc?.close(); pc=null; localStream?.getTracks().forEach(t=>t.stop()); localStream=null; remoteStream=null; call=null; callLayer().classList.remove("show"); }
function toggleMute(){ localStream?.getAudioTracks().forEach(t=>t.enabled=!t.enabled); }
function toggleCamera(){ localStream?.getVideoTracks().forEach(t=>t.enabled=!t.enabled); }
async function switchCamera(){ cameraFacingMode = cameraFacingMode === "user" ? "environment" : "user"; if (!call || call.kind !== "video") return; const old = localStream?.getVideoTracks()[0]; old?.stop(); const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:cameraFacingMode }, audio:false }); const track=s.getVideoTracks()[0]; const sender=pc?.getSenders().find(x=>x.track?.kind === "video"); await sender?.replaceTrack(track); localStream.removeTrack(old); localStream.addTrack(track); callLayer().querySelector("[data-local]").srcObject = localStream; }

function startPresence() { setDoc(doc(db,"presence",user.uid), { uid:user.uid, email:user.email||"", name:displayName(user), online:true, updatedAt:serverTimestamp() }, { merge:true }).catch(()=>{}); setInterval(() => user && setDoc(doc(db,"presence",user.uid), { uid:user.uid, online:true, updatedAt:serverTimestamp() }, { merge:true }).catch(()=>{}), 30000); }

async function boot() {
  if (!app || !auth || !db) { css(); toast("Firebase config missing: chat UI cannot connect."); return; }
  css();
  onAuthStateChanged(auth, async u => {
    user = u; if (!u) return;
    startPresence();
    let mode = isAdminPage() && await isAdminUser(u) ? "admin" : "user";
    const shell = makeShell({ mode }); if (!shell) return;
    shell.querySelector("[data-chat-search]").addEventListener("input", () => subscribeChats(shell, mode));
    // Do not auto-create empty chats here. The list now shows only chats with real activity/messages.
    subscribeChats(shell, mode); listenIncoming();
  });
}

boot();
