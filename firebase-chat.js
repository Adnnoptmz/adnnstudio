
const drawer = document.createElement("aside");
drawer.id = "adnnChatDrawer";
  drawer.className = "adnn-chat-drawer";
  drawer.className = "adnn-chat-drawer adnn-user-chat-panel";
drawer.setAttribute("aria-hidden", "true");
drawer.innerHTML = `
    <div class="adnn-chat-head">
    <div class="adnn-admin-chat-appbar adnn-user-chat-appbar">
     <div>
        <span>Private chat</span>
        <strong>AdnnStudio</strong>
        <p class="kicker">Studio chat</p>
        <strong>Messages</strong>
     </div>
      <span>Account Console</span>
     <button type="button" class="adnn-chat-close" aria-label="Close chat">×</button>
   </div>
    <div class="adnn-peer-search-wrap">
      <input id="adnnClientPeerSearch" class="adnn-peer-search" type="search" autocomplete="off" placeholder="Search users by name">
    </div>
    <div class="adnn-peer-list" id="adnnClientPeerList"></div>
    <div class="adnn-chat-messages" id="adnnChatMessages">
      <div class="adnn-chat-empty">No messages yet.</div>
    <div class="adnn-admin-chat-grid adnn-user-chat-grid">
      <div class="adnn-admin-chat-list adnn-user-chat-list-shell">
        <div class="adnn-user-search-wrap">
          <input id="adnnClientPeerSearch" class="adnn-user-search" type="search" autocomplete="off" placeholder="Search users by name">
        </div>
        <div class="adnn-user-chat-list" id="adnnClientPeerList"></div>
      </div>
      <div class="adnn-admin-chat-room adnn-user-chat-room">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnClientChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnClientChatAvatar">AS</span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnClientChatTitle">AdnnStudio</strong>
            <small id="adnnClientChatSubtitle">Admin support</small>
          </span>
        </div>
        <div class="adnn-chat-messages" id="adnnChatMessages">
          <div class="adnn-chat-empty">No messages yet.</div>
        </div>
        <form class="adnn-chat-form" id="adnnChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="adnn-chat-file-name" id="adnnChatFileName" hidden></span>
          </label>
          <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Message">
          <button type="submit" aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
   </div>
    <form class="adnn-chat-form" id="adnnChatForm">
      <label class="adnn-chat-media" title="Add media" aria-label="Add media">
        <input id="adnnChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="adnn-chat-file-name" id="adnnChatFileName" hidden></span>
      </label>
      <input id="adnnChatInput" autocomplete="off" maxlength="1800" placeholder="Type a message">
      <button type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; display: block;">
  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
</svg>
      </button>
    </form>
 `;

const embeddedClientMount = document.getElementById("clientChatMount");
@@ -200,12 +213,14 @@ function installClientChatShell() {
openClientChat();
});
drawer.querySelector(".adnn-chat-close")?.addEventListener("click", closeClientChat);
  drawer.querySelector("#adnnClientChatBack")?.addEventListener("click", () => document.body.classList.remove("adnn-user-chat-open"));
drawer.querySelector("#adnnChatForm")?.addEventListener("submit", sendClientMessage);
drawer.querySelector("#adnnClientPeerSearch")?.addEventListener("input", (event) => {
clientPeerSearchTerm = String(event.target.value || "").trim().toLowerCase();
renderClientPeerSelection();
});
wireFilePreview("adnnChatFile", "adnnChatFileName");
  updateClientChatHeader();
window.addEventListener("hashchange", maybeOpenClientChatFromHash);
}

@@ -254,6 +269,7 @@ function startClientChat(user) {
subscribeClientMessages(user);
startUserDirectory(user, "client");
renderClientPeerSelection();
  updateClientChatHeader();
maybeOpenClientChatFromHash();
}

@@ -493,34 +509,57 @@ function installDesignerChatPanel() {
if (!view) return;
const panel = document.createElement("div");
panel.id = "adnnDesignerChatPanel";
  panel.className = "adnn-designer-chat-panel";
  panel.className = "adnn-designer-chat-panel adnn-user-chat-panel";
panel.innerHTML = `
    <div class="adnn-peer-search-wrap">
      <input id="adnnDesignerPeerSearch" class="adnn-peer-search" type="search" autocomplete="off" placeholder="Search users by name">
    <div class="adnn-admin-chat-appbar adnn-user-chat-appbar">
      <div>
        <p class="kicker">Studio chat</p>
        <strong>Messages</strong>
      </div>
      <span>Designer Console</span>
   </div>
    <div class="adnn-peer-list" id="adnnDesignerPeerList"></div>
    <div class="adnn-chat-messages" id="adnnDesignerMessages">
      <div class="adnn-chat-empty">Sign in to open designer chat.</div>
    <div class="adnn-admin-chat-grid adnn-user-chat-grid">
      <div class="adnn-admin-chat-list adnn-user-chat-list-shell">
        <div class="adnn-user-search-wrap">
          <input id="adnnDesignerPeerSearch" class="adnn-user-search" type="search" autocomplete="off" placeholder="Search users by name">
        </div>
        <div class="adnn-user-chat-list" id="adnnDesignerPeerList"></div>
      </div>
      <div class="adnn-admin-chat-room adnn-user-chat-room">
        <div class="adnn-admin-chat-title">
          <button type="button" class="adnn-admin-chat-back" id="adnnDesignerChatBack" aria-label="Back to chats">‹</button>
          <span class="adnn-admin-chat-avatar" id="adnnDesignerChatAvatar">DL</span>
          <span class="adnn-admin-chat-title-text">
            <strong id="adnnDesignerChatTitle">Designer Lounge</strong>
            <small id="adnnDesignerChatSubtitle">Designer group chat</small>
          </span>
        </div>
        <div class="adnn-chat-messages" id="adnnDesignerMessages">
          <div class="adnn-chat-empty">Sign in to open designer chat.</div>
        </div>
        <form class="adnn-chat-form" id="adnnDesignerChatForm">
          <label class="adnn-chat-media" title="Add media" aria-label="Add media">
            <input id="adnnDesignerChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span class="adnn-chat-file-name" id="adnnDesignerChatFileName" hidden></span>
          </label>
          <input id="adnnDesignerChatInput" autocomplete="off" maxlength="1800" placeholder="Message">
          <button type="submit" aria-label="Send designer message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
        </form>
      </div>
   </div>
    <form class="adnn-chat-form" id="adnnDesignerChatForm">
      <label class="adnn-chat-media" title="Add media" aria-label="Add media">
        <input id="adnnDesignerChatFile" type="file" accept="image/*,.pdf,.doc,.docx,.zip">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="adnn-chat-file-name" id="adnnDesignerChatFileName" hidden></span>
      </label>
      <input id="adnnDesignerChatInput" autocomplete="off" maxlength="1800" placeholder="Message designers">
      <button type="submit" aria-label="Send designer message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 5l-5.8 14-3-5.9L4 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
      </button>
    </form>
 `;
view.appendChild(panel);
document.getElementById("adnnDesignerChatForm")?.addEventListener("submit", sendDesignerMessage);
  document.getElementById("adnnDesignerChatBack")?.addEventListener("click", () => document.body.classList.remove("adnn-user-chat-open"));
document.getElementById("adnnDesignerPeerSearch")?.addEventListener("input", (event) => {
designerPeerSearchTerm = String(event.target.value || "").trim().toLowerCase();
renderDesignerPeerSelection();
});
wireFilePreview("adnnDesignerChatFile", "adnnDesignerChatFileName");
  updateDesignerChatHeader();
}

async function getDesignerProfile(user) {
@@ -553,6 +592,7 @@ function startDesignerChat(user, designer) {
designerChatId = "designer_lounge";
startUserDirectory(user, "designer");
renderDesignerPeerSelection();
  updateDesignerChatHeader();
subscribeDesignerMessages(user);
}

@@ -1107,6 +1147,105 @@ function installChatStyles() {
   .adnn-peer-chip.is-active small { color:rgba(255,255,255,.72); }
   .adnn-peer-empty { align-self:center; color:var(--adnn-muted); font-family:var(--font-mono, ui-monospace, monospace); font-size:11px; padding:8px 4px; }


    /* Account + Designer chat now uses the same admin-style two-column messaging layout. */
    #clientChatMount.adnn-designer-chat-panel {
      display:block !important;
      height:auto !important;
      min-height:0 !important;
      border:0 !important;
      border-radius:0 !important;
      overflow:visible !important;
      background:transparent !important;
      box-shadow:none !important;
    }
    .adnn-user-chat-panel {
      margin-top:22px !important;
      border:1px solid var(--adnn-line) !important;
      border-radius:28px !important;
      overflow:hidden !important;
      background:transparent !important;
      box-shadow:none !important;
      display:grid !important;
      grid-template-rows:auto minmax(0,1fr) !important;
      min-height:640px !important;
    }
    .adnn-chat-drawer.adnn-user-chat-panel.is-embedded {
      position:relative !important;
      right:auto !important;
      bottom:auto !important;
      width:100% !important;
      height:640px !important;
      min-height:640px !important;
      opacity:1 !important;
      transform:none !important;
      pointer-events:auto !important;
      backdrop-filter:none !important;
      -webkit-backdrop-filter:none !important;
    }
    .adnn-user-chat-appbar .adnn-chat-close {
      width:36px;
      height:36px;
      display:grid;
      place-items:center;
      margin-left:12px;
    }
    .adnn-chat-drawer.is-embedded .adnn-user-chat-appbar .adnn-chat-close { display:none !important; }
    .adnn-user-chat-grid {
      height:568px !important;
      min-height:0 !important;
      grid-template-columns:minmax(280px,.35fr) minmax(0,1fr) !important;
    }
    .adnn-user-chat-list-shell {
      display:grid !important;
      grid-template-rows:auto minmax(0,1fr) !important;
      padding:0 !important;
    }
    .adnn-user-search-wrap {
      padding:12px !important;
      border-bottom:1px solid var(--adnn-line) !important;
      background:rgba(255,255,255,.015) !important;
    }
    .adnn-user-search {
      width:100% !important;
      height:42px !important;
      border:1px solid var(--adnn-line) !important;
      border-radius:16px !important;
      padding:0 14px !important;
      background:rgba(255,255,255,.045) !important;
      color:var(--adnn-text) !important;
      outline:0 !important;
      font-family:var(--font-body, ui-sans-serif, system-ui) !important;
      font-size:13px !important;
    }
    .adnn-user-search::placeholder { color:var(--adnn-muted) !important; }
    .adnn-user-search:focus { border-color:rgba(83,96,255,.55) !important; box-shadow:0 0 0 3px rgba(39,45,207,.15) !important; }
    .adnn-user-chat-list {
      overflow:auto !important;
      padding:8px !important;
    }
    .adnn-user-list-empty {
      margin:14px 10px !important;
      min-height:42px !important;
      display:grid !important;
      place-items:center !important;
      border:0 !important;
      background:transparent !important;
    }
    .adnn-user-chat-room .adnn-chat-messages {
      border:0 !important;
      border-radius:0 !important;
      background:transparent !important;
    }
    @media (max-width:820px) {
      .adnn-user-chat-panel { min-height:620px !important; }
      .adnn-user-chat-grid { grid-template-columns:1fr !important; height:548px !important; }
      .adnn-user-chat-room { display:none !important; }
      body.adnn-user-chat-open .adnn-user-chat-list-shell { display:none !important; }
      body.adnn-user-chat-open .adnn-user-chat-room { display:grid !important; }
      .adnn-user-chat-room .adnn-admin-chat-back { display:grid !important; }
    }

   :root.light-theme {
     --adnn-muted: rgba(11, 11, 13, 0.62);
     --adnn-line: rgba(0, 0, 0, 0.08);
@@ -1230,33 +1369,76 @@ function renderPeerButtons(wrap, mode) {
if (!term) return true;
return [peer.name, peer.email, peer.role].some((value) => String(value || "").toLowerCase().includes(term));
});
  const defaultLabel = mode === "designer" ? "Designer Lounge" : "Admin Support";
  const defaultLabel = mode === "designer" ? "Designer Lounge" : "AdnnStudio";
  const defaultPreview = mode === "designer" ? "Designer group chat" : "Admin support";
const activeDefault = mode === "designer" ? designerChatMode === "lounge" : clientChatMode === "support";
wrap.innerHTML = "";
  const defaultButton = document.createElement("button");
  defaultButton.type = "button";
  defaultButton.className = `adnn-peer-chip${activeDefault ? " is-active" : ""}`;
  defaultButton.textContent = defaultLabel;
  defaultButton.addEventListener("click", () => mode === "designer" ? openDesignerLounge() : openClientSupport());
  wrap.appendChild(defaultButton);

  wrap.appendChild(createPeerListItem({
    label: defaultLabel,
    preview: defaultPreview,
    role: mode === "designer" ? "lounge" : "support",
    active: activeDefault,
    onClick: () => mode === "designer" ? openDesignerLounge() : openClientSupport()
  }));

if (!users.length && term) {
    const empty = document.createElement("span");
    empty.className = "adnn-peer-empty";
    const empty = document.createElement("div");
    empty.className = "adnn-chat-empty adnn-user-list-empty";
empty.textContent = "No matching users";
wrap.appendChild(empty);
return;
}

users.forEach((peer) => {
const active = mode === "designer" ? selectedDesignerPeer?.uid === peer.uid : selectedClientPeer?.uid === peer.uid;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `adnn-peer-chip${active ? " is-active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(peer.name || peer.email || "User")}</strong><small>${escapeHtml(peer.role)}</small>`;
    button.addEventListener("click", () => mode === "designer" ? openDesignerDirectChat(peer) : openClientDirectChat(peer));
    wrap.appendChild(button);
    wrap.appendChild(createPeerListItem({
      label: peer.name || peer.email || "User",
      preview: peer.role || peer.email || "user",
      role: peer.role || "user",
      active,
      onClick: () => mode === "designer" ? openDesignerDirectChat(peer) : openClientDirectChat(peer)
    }));
});
}

function createPeerListItem({ label, preview, role, active, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `adnn-admin-chat-item adnn-user-chat-item${active ? " is-active" : ""}`;
  button.innerHTML = `
    <span>
      <strong>${escapeHtml(label || "User")}</strong>
      <small>${escapeHtml(preview || role || "online")}</small>
    </span>
  `;
  button.addEventListener("click", () => {
    if (typeof onClick === "function") onClick();
    document.body.classList.add("adnn-user-chat-open");
  });
  return button;
}

function updateClientChatHeader() {
  const title = document.getElementById("adnnClientChatTitle");
  const subtitle = document.getElementById("adnnClientChatSubtitle");
  const avatar = document.getElementById("adnnClientChatAvatar");
  const label = clientChatMode === "direct" && selectedClientPeer ? (selectedClientPeer.name || selectedClientPeer.email || "User") : "AdnnStudio";
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = clientChatMode === "direct" && selectedClientPeer ? `${selectedClientPeer.role || "user"} • direct message` : "Admin support";
  if (avatar) avatar.textContent = initialsFromName(label);
}

function updateDesignerChatHeader() {
  const title = document.getElementById("adnnDesignerChatTitle");
  const subtitle = document.getElementById("adnnDesignerChatSubtitle");
  const avatar = document.getElementById("adnnDesignerChatAvatar");
  const label = designerChatMode === "direct" && selectedDesignerPeer ? (selectedDesignerPeer.name || selectedDesignerPeer.email || "User") : "Designer Lounge";
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = designerChatMode === "direct" && selectedDesignerPeer ? `${selectedDesignerPeer.role || "user"} • direct message` : "Designer group chat";
  if (avatar) avatar.textContent = initialsFromName(label);
}

async function openClientSupport() {
if (!activeUser) return;
clientChatMode = "support";
@@ -1265,6 +1447,7 @@ async function openClientSupport() {
await ensureClientChat(activeUser).catch(() => {});
subscribeClientMessages(activeUser);
renderClientPeerSelection();
  updateClientChatHeader();
}

async function openClientDirectChat(peer) {
@@ -1275,6 +1458,7 @@ async function openClientDirectChat(peer) {
await ensureDirectChat(activeUser, peer, "client").catch(() => {});
subscribeClientMessages(activeUser);
renderClientPeerSelection();
  updateClientChatHeader();
}

async function openDesignerLounge() {
@@ -1285,6 +1469,7 @@ async function openDesignerLounge() {
await ensureDesignerRoom(activeUser, activeDesignerProfile || {}).catch(() => {});
subscribeDesignerMessages(activeUser);
renderDesignerPeerSelection();
  updateDesignerChatHeader();
}

async function openDesignerDirectChat(peer) {
@@ -1295,6 +1480,7 @@ async function openDesignerDirectChat(peer) {
await ensureDirectChat(activeUser, peer, "designer").catch(() => {});
subscribeDesignerMessages(activeUser);
renderDesignerPeerSelection();
  updateDesignerChatHeader();
}

async function ensureDirectChat(user, peer, senderRole) {
