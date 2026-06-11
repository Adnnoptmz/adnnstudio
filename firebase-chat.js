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
  end:`<svg viewBox="0 0 24 24"><path d="M6.5 14.5c3.5-3.1 7.5-3.1 11 0l1.7-1.7c.7-.7.7-1.8 0-2.5-4.5-4.2-9.9-4.2-14.4 0-.7.7-.7 1.8 0 2.5l1.7 1.7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`
};

let user = null;
let unsubs = [];
let activeChatId = "";
let activeChat = null;
let recorder = null;
let chunks = [];
let recorderState = null;
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
  #chat.view,#chats_view,#clientChatMount,#directChatMount{min-height:0!important;display:block!important;opacity:1!important;visibility:visible!important;overflow:visible!important}.adnn-chat-shell{height:min(78vh,760px);min-height:620px;width:100%;display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);border:1px solid var(--adnn-chat-line);border-radius:30px;overflow:hidden;background:var(--adnn-chat-panel);box-shadow:var(--glass-shadow,0 24px 70px rgba(0,0,0,.35));backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);color:var(--adnn-chat-text);font-family:var(--adnn-chat-font);position:relative;z-index:5}.adnn-chat-sidebar{border-right:1px solid var(--adnn-chat-line);min-width:0;display:flex;flex-direction:column;background:rgba(255,255,255,.025)}.adnn-chat-top{padding:18px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--adnn-chat-line)}.adnn-chat-logo{width:44px;height:44px;border-radius:16px;background:linear-gradient(135deg,var(--adnn-chat-accent),#6970ff);display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 12px 36px rgba(39,45,207,.35)}.adnn-chat-top h3{margin:0;font-size:17px;letter-spacing:-.03em}.adnn-chat-top p{margin:3px 0 0;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:11px}.adnn-chat-search{margin:14px 16px;display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid var(--adnn-chat-line);border-radius:16px;background:var(--adnn-chat-input)}.adnn-chat-search svg,.adnn-icon{width:18px;height:18px;display:block}.adnn-chat-search input{border:0;outline:0;background:transparent;color:var(--adnn-chat-text);width:100%;font-size:13px}.adnn-chat-list{overflow:auto;padding:0 10px 14px;display:grid;gap:8px}.adnn-chat-item{width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:12px;border-radius:20px;display:grid;grid-template-columns:44px 1fr auto;gap:11px;align-items:center;cursor:pointer;transition:.2s}.adnn-chat-item:hover,.adnn-chat-item.active{background:rgba(255,255,255,.08)}:root.light-theme .adnn-chat-item:hover,:root.light-theme .adnn-chat-item.active{background:rgba(0,0,0,.045)}.adnn-avatar{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:rgba(39,45,207,.14);color:var(--adnn-chat-accent);font-weight:700;position:relative}.adnn-presence-dot{position:absolute;right:1px;bottom:2px;width:10px;height:10px;border-radius:99px;background:#32d74b;border:2px solid var(--adnn-chat-bg)}.adnn-chat-item strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-chat-item small{display:block;margin-top:3px;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-unread{min-width:20px;height:20px;border-radius:999px;background:var(--adnn-chat-accent);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700}.adnn-room{min-width:0;display:flex;flex-direction:column;position:relative;background:radial-gradient(circle at 90% 4%,rgba(39,45,207,.16),transparent 26%)}.adnn-room-head{height:82px;padding:16px 20px;border-bottom:1px solid var(--adnn-chat-line);display:flex;align-items:center;gap:12px}.adnn-room-head .adnn-title{min-width:0;flex:1}.adnn-room-head strong{display:block;font-size:17px;letter-spacing:-.03em}.adnn-room-head small{display:block;margin-top:3px;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:11px}.adnn-room-actions{display:flex;gap:8px}.adnn-action{width:42px;height:42px;border-radius:16px;border:1px solid var(--adnn-chat-line);background:rgba(255,255,255,.06);color:var(--adnn-chat-text);display:grid;place-items:center;cursor:pointer;transition:.2s}.adnn-action:hover{transform:translateY(-1px);background:rgba(39,45,207,.16);color:#fff}.adnn-action.primary{background:var(--adnn-chat-accent);border-color:transparent;color:#fff}.adnn-action.danger{background:var(--adnn-chat-red);border-color:transparent;color:#fff}.adnn-action:disabled{opacity:.38;cursor:not-allowed}.adnn-back{display:none}.adnn-messages{flex:1;overflow:auto;padding:22px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}.adnn-empty{margin:auto;max-width:420px;text-align:center;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:12px;line-height:1.6}.adnn-bubble-row{display:flex;gap:8px;align-items:flex-end;max-width:82%}.adnn-bubble-row.mine{align-self:flex-end;flex-direction:row-reverse}.adnn-bubble{position:relative;padding:10px 12px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid var(--adnn-chat-line);box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:14px;line-height:1.45;word-break:break-word}.mine .adnn-bubble{background:linear-gradient(135deg,var(--adnn-chat-accent),#4651ff);color:#fff;border-color:transparent;border-bottom-right-radius:7px}.theirs .adnn-bubble{border-bottom-left-radius:7px}.adnn-bubble-meta{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:10px;font-family:var(--adnn-chat-mono);opacity:.68}.adnn-media-preview{display:block;max-width:min(320px,58vw);max-height:260px;border-radius:16px;margin:4px 0 8px;object-fit:cover}.adnn-file-card{display:flex;gap:10px;align-items:center;padding:10px;border-radius:16px;background:rgba(0,0,0,.08);text-decoration:none;color:inherit;margin-bottom:8px}.adnn-file-card span{font-family:var(--adnn-chat-mono);font-size:11px}.adnn-msg-tools{position:absolute;top:-18px;right:8px;display:none;gap:4px}.adnn-bubble:hover .adnn-msg-tools{display:flex}.adnn-mini{width:28px;height:28px;border:1px solid var(--adnn-chat-line);border-radius:12px;background:rgba(20,20,24,.86);color:#fff;display:grid;place-items:center;cursor:pointer}.adnn-reactions{display:flex;gap:4px;margin-top:6px}.adnn-reactions button{border:0;border-radius:999px;background:rgba(255,255,255,.13);padding:3px 7px;cursor:pointer}.adnn-composer{padding:14px 18px;border-top:1px solid var(--adnn-chat-line);display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:end;background:rgba(0,0,0,.05)}.adnn-composer textarea{resize:none;max-height:130px;min-height:46px;border:1px solid var(--adnn-chat-line);outline:0;border-radius:18px;padding:13px 14px;background:var(--adnn-chat-input);color:var(--adnn-chat-text);font-size:14px}.adnn-hidden-file{display:none}.adnn-attach-preview{position:absolute;left:20px;right:20px;bottom:82px;padding:10px 12px;border:1px solid var(--adnn-chat-line);border-radius:18px;background:var(--adnn-chat-panel);display:none;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 20px 50px rgba(0,0,0,.25)}.adnn-attach-preview.show{display:flex}.adnn-toast{position:fixed;right:22px;bottom:22px;z-index:99999;background:rgba(20,20,24,.9);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:12px 14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font-size:13px;max-width:330px}.adnn-call-layer{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.72);backdrop-filter:blur(18px) saturate(160%);display:none;align-items:center;justify-content:center;padding:22px}.adnn-call-layer.show{display:flex}.adnn-call-window{width:min(1120px,96vw);height:min(760px,92vh);border-radius:34px;overflow:hidden;border:1px solid rgba(255,255,255,.14);background:#08080a;box-shadow:0 30px 100px rgba(0,0,0,.55);position:relative;color:#fff}.adnn-call-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:radial-gradient(circle at 50% 30%,#20203a,#050506 62%)}.adnn-call-local{position:absolute;right:20px;top:20px;width:min(230px,28vw);aspect-ratio:9/13;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,.18);box-shadow:0 16px 50px rgba(0,0,0,.45);transform:scaleX(-1);object-fit:cover;background:#111}.adnn-call-info{position:absolute;left:24px;top:24px}.adnn-call-info h3{margin:0;font-size:22px}.adnn-call-info p{margin:6px 0 0;color:rgba(255,255,255,.7);font-family:var(--adnn-chat-mono);font-size:12px}.adnn-call-controls{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:12px;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:rgba(20,20,24,.62);backdrop-filter:blur(18px)}.adnn-call-btn{width:56px;height:56px;border-radius:20px;border:0;background:rgba(255,255,255,.13);color:#fff;display:grid;place-items:center;cursor:pointer}.adnn-call-btn svg{width:23px;height:23px}.adnn-call-btn.off{background:rgba(255,255,255,.28)}.adnn-call-btn.end{background:var(--adnn-chat-red)}.adnn-incoming{position:fixed;right:22px;top:22px;z-index:99999;width:min(360px,calc(100vw - 44px));padding:16px;border-radius:24px;background:rgba(20,20,24,.92);border:1px solid rgba(255,255,255,.12);box-shadow:0 22px 80px rgba(0,0,0,.4);color:#fff;display:none}.adnn-incoming.show{display:block}.adnn-incoming h4{margin:0 0 5px}.adnn-incoming p{margin:0 0 14px;color:rgba(255,255,255,.68);font-family:var(--adnn-chat-mono);font-size:12px}.adnn-incoming-actions{display:flex;gap:10px}.adnn-chip{border:1px solid var(--adnn-chat-line);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:7px 10px;font-size:11px;font-family:var(--adnn-chat-mono)}.adnn-room-actions{position:relative;z-index:3;display:flex!important;opacity:1!important;visibility:visible!important}.adnn-room-action button,.adnn-room-actions button{display:grid!important}.adnn-action svg{width:19px;height:19px}.adnn-attach-preview{z-index:6}.adnn-attach-card{display:flex;align-items:center;gap:12px;min-width:0}.adnn-attach-thumb{width:58px;height:58px;border-radius:16px;background:rgba(255,255,255,.08);display:grid;place-items:center;overflow:hidden;flex:0 0 auto}.adnn-attach-thumb img,.adnn-attach-thumb video{width:100%;height:100%;object-fit:cover}.adnn-attach-meta{min-width:0}.adnn-attach-meta strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adnn-attach-meta small{display:block;margin-top:3px;color:var(--adnn-chat-muted);font-family:var(--adnn-chat-mono);font-size:11px}.adnn-voice-panel{position:absolute;left:18px;right:18px;bottom:14px;z-index:8;min-height:58px;border:1px solid var(--adnn-chat-line);border-radius:22px;background:rgba(20,20,24,.9);color:#fff;display:none;align-items:center;gap:12px;padding:10px 12px;box-shadow:0 20px 70px rgba(0,0,0,.38);backdrop-filter:blur(18px)}.adnn-voice-panel.show{display:flex}.adnn-voice-dot{width:10px;height:10px;border-radius:99px;background:var(--adnn-chat-red);box-shadow:0 0 0 0 rgba(255,38,2,.65);animation:adnnPulse 1.1s infinite}.adnn-voice-wave{flex:1;height:26px;display:flex;align-items:center;gap:3px}.adnn-voice-wave i{width:3px;border-radius:99px;background:rgba(255,255,255,.76);animation:adnnWave .8s infinite alternate}.adnn-voice-wave i:nth-child(2n){animation-delay:.12s}.adnn-voice-wave i:nth-child(3n){animation-delay:.24s}.adnn-voice-time{font-family:var(--adnn-chat-mono);font-size:12px;min-width:48px}.adnn-composer.recording textarea,.adnn-composer.recording [data-pick],.adnn-composer.recording [data-send]{opacity:.18;pointer-events:none}.adnn-composer.recording{padding-bottom:86px}@keyframes adnnPulse{70%{box-shadow:0 0 0 11px rgba(255,38,2,0)}}@keyframes adnnWave{from{height:7px}to{height:24px}}@media(max-width:820px){.adnn-chat-shell{height:calc(100vh - 24px);min-height:560px;grid-template-columns:1fr;border-radius:24px}.adnn-chat-sidebar{border-right:0}.adnn-room{display:none}.adnn-chat-shell.room-open .adnn-chat-sidebar{display:none}.adnn-chat-shell.room-open .adnn-room{display:flex}.adnn-back{display:grid}.adnn-composer{grid-template-columns:auto 1fr auto}.adnn-composer .adnn-mic{display:grid}.adnn-bubble-row{max-width:94%}.adnn-call-local{width:118px;border-radius:18px}.adnn-call-controls{gap:8px}.adnn-call-btn{width:50px;height:50px;border-radius:18px}}`;
  document.head.appendChild(style);
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
      <div class="adnn-attach-preview" data-attach-preview><div class="adnn-attach-card"><div class="adnn-attach-thumb" data-attach-thumb>+</div><div class="adnn-attach-meta"><strong data-attach-name></strong><small data-attach-size></small></div></div><button class="adnn-mini" data-attach-clear>${I.close}</button></div>
      <div class="adnn-voice-panel" data-voice-panel><span class="adnn-voice-dot"></span><span class="adnn-voice-time" data-voice-time>00:00</span><span class="adnn-voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><button class="adnn-action danger" type="button" data-voice-cancel>${I.close}</button><button class="adnn-action primary" type="button" data-voice-send>${I.send}</button></div>
      <form class="adnn-composer" data-composer>
        <input class="adnn-hidden-file" type="file" data-file accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.zip,.ai,.psd,.fig,.sketch">
        <button class="adnn-action" type="button" data-pick>${I.plus}</button>
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
  if (!activeChatId && filtered.length) setTimeout(() => openChat(shell, filtered[0], mode), 0);
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
  if (window.__adnnMsgUnsub) window.__adnnMsgUnsub();
  window.__adnnMsgUnsub = onSnapshot(query(collection(db, "chats", chat.id, "messages"), orderBy("createdAt", "asc"), limit(LIMIT_MESSAGES)), snap => {
    const messages = snap.docs.map(d => ({ id:d.id, ...d.data() })); window.__adnnLastMessages = messages; renderMessages(shell, messages);
  }, () => shell.querySelector("[data-messages]").innerHTML = `<div class="adnn-empty">Messages could not load for this chat.</div>`);
}

function renderMessages(shell, messages) {
  const wrap = shell.querySelector("[data-messages]");
  if (!messages.length) { wrap.innerHTML = `<div class="adnn-empty">No messages yet. Send files, voice notes, reactions or start a call.</div>`; return; }
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
    bubble.innerHTML = `<div class="adnn-msg-tools"><button class="adnn-mini" data-react="❤️">❤️</button><button class="adnn-mini" data-fav>${fav}</button>${canDelete ? `<button class="adnn-mini" data-del>${I.trash}</button>` : `<button class="adnn-mini" data-hide>${I.close}</button>`}</div>${media}${m.text ? `<div>${esc(m.text)}</div>` : ""}<div class="adnn-bubble-meta"><span>${esc(m.senderName || "")}</span><span>${fmtTime(m.createdAt)}</span>${m.edited ? "<span>edited</span>" : ""}</div>${reactionHtml(m)}`;
    bubble.querySelector("[data-react]")?.addEventListener("click", () => reactMessage(m, "❤️"));
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
  if (m.mediaType?.startsWith("audio/")) return `<audio src="${esc(m.mediaUrl)}" controls></audio>`;
  return `<a class="adnn-file-card" href="${esc(m.mediaUrl)}" target="_blank" rel="noopener"><b>${esc(fileIcon(m.mediaType))}</b><span>${esc(m.mediaName || "Download file")}</span></a>`;
}
function localReactionFor(messageId) { try { return JSON.parse(localStorage.getItem(`adnnReactions_${user.uid}_${activeChatId}`) || "{}")[messageId]; } catch { return null; } }
function saveLocalReaction(messageId, emoji) { const key = `adnnReactions_${user.uid}_${activeChatId}`; let all = {}; try { all = JSON.parse(localStorage.getItem(key) || "{}"); } catch {} all[messageId] = emoji; localStorage.setItem(key, JSON.stringify(all)); }
function reactionHtml(m) { const r = { ...(m.reactions || {}) }; const local = localReactionFor(m.id); if (local && !r[user.uid]) r[user.uid] = local; const vals = Object.values(r); return vals.length ? `<div class="adnn-reactions">${vals.map(v => `<button>${esc(v)}</button>`).join("")}</div>` : ""; }
function toggleLocalSet(key, id) { const s = new Set(JSON.parse(localStorage.getItem(key) || "[]")); s.has(id) ? s.delete(id) : s.add(id); localStorage.setItem(key, JSON.stringify([...s])); if (activeChat) openChat($(".adnn-chat-shell"), activeChat, isAdminPage()?"admin":"user"); }
async function reactMessage(m, emoji) { try { await updateDoc(doc(db, "chats", activeChatId, "messages", m.id), { [`reactions.${user.uid}`]: emoji, edited:true }); } catch { saveLocalReaction(m.id, emoji); const shell = $(".adnn-chat-shell"); if (shell && window.__adnnLastMessages) renderMessages(shell, window.__adnnLastMessages); } }
async function deleteMessage(m) { try { await deleteDoc(doc(db, "chats", activeChatId, "messages", m.id)); toast("Message deleted."); } catch { toggleLocalSet(`adnnHidden_${user.uid}`, m.id); toast("Hidden for you. Firestore rules allow full delete for sender/admin only."); } }

function bindComposer(shell, chat) {
  const form = shell.querySelector("[data-composer]");
  const text = shell.querySelector("[data-text]");
  const file = shell.querySelector("[data-file]");
  const pick = shell.querySelector("[data-pick]");
  const rec = shell.querySelector("[data-record]");
  const prev = shell.querySelector("[data-attach-preview]");
  const voicePanel = shell.querySelector("[data-voice-panel]");
  const voiceSend = shell.querySelector("[data-voice-send]");
  const voiceCancel = shell.querySelector("[data-voice-cancel]");
  pick.onclick = () => file.click();
  file.onchange = () => renderAttachmentPreview(shell, file.files[0]);
  shell.querySelector("[data-attach-clear]").onclick = () => { file.value = ""; prev.classList.remove("show"); shell.querySelector("[data-attach-thumb]").innerHTML = "+"; };
  text.oninput = () => { text.style.height = "auto"; text.style.height = Math.min(text.scrollHeight, 130) + "px"; };
  text.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async e => { e.preventDefault(); if (recorderState?.recording) return; await sendMessage(chat, text.value.trim(), file.files[0]); text.value=""; text.style.height=""; file.value=""; prev.classList.remove("show"); };
  rec.onclick = () => startVoiceRecording(chat, shell);
  voiceCancel.onclick = () => stopVoiceRecording(false, chat, shell);
  voiceSend.onclick = () => stopVoiceRecording(true, chat, shell);
}

function renderAttachmentPreview(shell, file) {
  const prev = shell.querySelector("[data-attach-preview]");
  const thumb = shell.querySelector("[data-attach-thumb]");
  const name = shell.querySelector("[data-attach-name]");
  const size = shell.querySelector("[data-attach-size]");
  if (!file) { prev.classList.remove("show"); return; }
  name.textContent = file.name; size.textContent = `${file.type || "file"} • ${Math.max(1, Math.round(file.size/1024))} KB`;
  thumb.innerHTML = file.type.startsWith("image/") ? `<img alt="Preview">` : file.type.startsWith("video/") ? `<video muted playsinline></video>` : file.type.startsWith("audio/") ? `🎙️` : `📎`;
  const media = thumb.querySelector("img,video");
  if (media) { const url = URL.createObjectURL(file); media.src = url; media.onload = media.onloadeddata = () => setTimeout(() => URL.revokeObjectURL(url), 1200); }
  prev.classList.add("show");
}

function fmtDuration(ms) { const s = Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
async function startVoiceRecording(chat, shell) {
  if (recorderState?.recording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true }); chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    recorderState = { recording:true, send:false, stream, startedAt:Date.now(), timer:null };
    shell.querySelector("[data-composer]").classList.add("recording");
    shell.querySelector("[data-voice-panel]").classList.add("show");
    shell.querySelector("[data-record]").classList.add("danger");
    const tick = () => shell.querySelector("[data-voice-time]").textContent = fmtDuration(Date.now() - recorderState.startedAt);
    tick(); recorderState.timer = setInterval(tick, 350);
    recorder.onstop = async () => {
      const state = recorderState;
      clearInterval(state?.timer); state?.stream?.getTracks().forEach(t => t.stop());
      shell.querySelector("[data-composer]").classList.remove("recording");
      shell.querySelector("[data-voice-panel]").classList.remove("show");
      shell.querySelector("[data-record]").classList.remove("danger");
      recorderState = null;
      if (state?.send && chunks.length) {
        const blob = new Blob(chunks, { type:"audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type:"audio/webm" });
        await sendMessage(chat, "", file);
      }
      chunks = [];
    };
    recorder.start(250);
  } catch { toast("Microphone permission was blocked."); }
}
function stopVoiceRecording(send, chat, shell) {
  if (!recorderState || !recorder) return;
  recorderState.send = !!send;
  try { recorder.stop(); } catch {}
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
    if (mode !== "admin") { await ensureSupportChat(u).catch(()=>{}); if (isDesignerPage() && await isDesigner(u.uid)) await ensureDesignerRoom(u).catch(()=>{}); }
    subscribeChats(shell, mode); listenIncoming();
  });
}

boot();
