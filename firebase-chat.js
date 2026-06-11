        <div class="adnn-file-preview" data-file-preview hidden></div>
        <div class="adnn-voice-preview" data-voice-preview hidden></div>
        <form class="adnn-composer" data-composer>
          <label class="adnn-attach-btn" title="Attach files">
            ${ICON.clip}
            <input type="file" data-file-input multiple>
          </label>
          <textarea data-text rows="1" maxlength="1800" placeholder="Message"></textarea>
          <button type="button" class="adnn-voice-btn" data-voice>${ICON.mic}</button>
          <button type="submit" class="adnn-send-btn" data-send hidden>${ICON.send}</button>
        </form>
      </footer>
    </div>
  `;
}

function bindRoomControls(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const text = shell.querySelector("[data-text]");
  const form = shell.querySelector("[data-composer]");
  const fileInput = shell.querySelector("[data-file-input]");
  const voiceBtn = shell.querySelector("[data-voice]");

  shell.querySelector("[data-chat-back]")?.addEventListener("click", () => {
    document.querySelector(".adnn-chat-layout")?.classList.remove("is-room-open");
  });
  shell.querySelectorAll("[data-call]").forEach((btn) => {
    btn.addEventListener("click", () => startCall(btn.dataset.call, state.chatId, state.chatData));
  });
  text?.addEventListener("input", () => {
    autoSizeTextArea(text);
    if (!state.chatId.startsWith("passive_")) setTyping(state, text.value.trim().length > 0);
    refreshComposerMode(state);
  });
  text?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form?.requestSubmit();
    }
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.chatId.startsWith("passive_")) {
      showToast("Please select an active conversation thread first.");
      return;
    }
    sendCurrentMessage(state);
  });
  fileInput?.addEventListener("change", () => {
    addFilesToState(state, Array.from(fileInput.files || []));
    fileInput.value = "";
  });
  shell.querySelector("[data-clear-reply]")?.addEventListener("click", () => {
    state.replyTo = null;
    renderReplyBar(state);
  });
  voiceBtn?.addEventListener("click", () => toggleVoiceRecording(state));
  ["dragenter", "dragover"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      shell.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    shell.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === "drop") addFilesToState(state, Array.from(event.dataTransfer?.files || []));
      shell.classList.remove("is-dragging");
    });
  });
}

function watchRoomMeta(state) {
  const unsub = onSnapshot(doc(db, "chats", state.chatId), (snapshot) => {
    if (!snapshot.exists()) return;
    state.chatData = { id: state.chatId, ...snapshot.data() };
    const title = getChatTitle(state.chatData, isAdminEmail(activeUser.email) ? "admin" : "user");
    const shell = roomShell(state);
    if (!shell) return;
    const avatar = shell.querySelector("[data-chat-avatar]");
    const titleNode = shell.querySelector("[data-chat-title]");
    if (avatar) avatar.textContent = initials(title);
    if (titleNode) titleNode.textContent = title;
    watchPresence(state);
  });
  state.unsubs.push(unsub);
}

function watchPresence(state) {
  const uid = getRemoteUid(state.chatData);
  const shell = roomShell(state);
  if (!shell) return;
  const status = shell.querySelector("[data-chat-presence]");
  state.presenceUnsub?.();
  if (!uid || !status) {
    if (status) status.textContent = "Available";
    return;
  }
  state.presenceUnsub = onSnapshot(doc(db, "presence", uid), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    const seen = toMillis(data.lastSeen || data.updatedAt);
    const online = data.online !== false && seen && Date.now() - seen < 75000;
    status.textContent = online ? "Online" : seen ? `Last seen ${relativeTime(seen)}` : "Offline";
    status.classList.toggle("is-online", !!online);
  });
  state.unsubs.push(state.presenceUnsub);
}

function watchTyping(state) {
  const unsub = onSnapshot(collection(db, "chats", state.chatId, "typing"), (snapshot) => {
    const typing = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.id !== activeUser.uid && item.isTyping && Date.now() - Number(item.updatedAt || 0) < 5000);
    const shell = roomShell(state);
    if (!shell) return;
    const line = shell.querySelector("[data-typing-line]");
    const status = shell.querySelector("[data-chat-presence]");
    if (line) {
      line.hidden = typing.length === 0;
      line.innerHTML = typing.length ? `<span></span><span></span><span></span> ${escapeHtml(typing[0].name || "User")} is typing` : "";
    }
    if (status && typing.length) status.textContent = "Typing...";
  });
  state.unsubs.push(unsub);
}

function watchMessages(state) {
  const q = query(collection(db, "chats", state.chatId, "messages"), orderBy("createdAt", "asc"), limit(MSG_LIMIT));
  const unsub = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderMessages(state, messages);
    markMessagesRead(state, messages);
  }, () => {
    const shell = roomShell(state);
    if (shell) shell.querySelector("[data-message-scroll]").innerHTML = `<div class="adnn-chat-empty">Could not load messages.</div>`;
  });
  state.unsubs.push(unsub);
}

function renderMessages(state, messages) {
  const shell = roomShell(state);
  if (!shell) return;
  const scroller = shell.querySelector("[data-message-scroll]");
  if (!scroller) return;
  scroller.innerHTML = "";
  const visibleMessages = messages.filter((message) => !isHiddenSystemMessage(message));
  if (!visibleMessages.length) {
    scroller.innerHTML = `<div class="adnn-chat-empty">No messages yet.</div>`;
    return;
  }
  visibleMessages.forEach((message) => {
    const mine = message.senderUid === activeUser.uid || (isAdminEmail(activeUser.email) && message.senderUid === ADMIN_ALIAS_UID);
    const row = document.createElement("div");
    row.className = `adnn-message-row ${mine ? "is-mine" : "is-peer"}`;
    const bubble = document.createElement("article");
    bubble.className = "adnn-message";
    bubble.innerHTML = `
      ${!mine ? `<strong class="adnn-message-name">${escapeHtml(message.senderName || "User")}</strong>` : ""}
      ${renderReplyPreview(message)}
      ${renderAttachments(message)}
      ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}
      <div class="adnn-message-meta">
        <time>${formatTime(message.createdAt)}</time>
        ${mine ? `<span class="adnn-ticks ${Array.isArray(message.readBy) && message.readBy.length > 1 ? "is-read" : ""}">✓✓</span>` : ""}
      </div>
      ${renderReactions(message)}
      <div class="adnn-message-actions">
        <button type="button" data-action="reply">Reply</button>
        <button type="button" data-action="react" data-emoji="👍">👍</button>
        <button type="button" data-action="react" data-emoji="❤️">❤️</button>
        <button type="button" data-action="react" data-emoji="😂">😂</button>
        <button type="button" data-action="react" data-emoji="🔥">🔥</button>
        <button type="button" data-action="react" data-emoji="✅">✅</button>
        ${mine ? `<button type="button" data-action="delete" class="is-danger">Delete</button>` : ""}
      </div>
    `;
    bubble.addEventListener("click", (event) => handleMessageAction(event, state, message));
    row.appendChild(bubble);
    scroller.appendChild(row);
  });
  scroller.scrollTop = scroller.scrollHeight;
}

function handleMessageAction(event, state, message) {
  const btn = event.target.closest("[data-action]");
  if (!btn) {
    document.querySelectorAll(".adnn-message.is-menu-open").forEach((item) => {
      if (item !== event.currentTarget) item.classList.remove("is-menu-open");
    });
    event.currentTarget.classList.toggle("is-menu-open");
    return;
  }
  event.stopPropagation();
  const action = btn.dataset.action;
  if (action === "reply") {
    state.replyTo = {
      id: message.id,
      senderName: message.senderName || "User",
      text: message.text || firstAttachmentName(message) || "Attachment"
    };
    renderReplyBar(state);
    roomShell(state)?.querySelector("[data-text]")?.focus();
  }
  if (action === "react") toggleReaction(state.chatId, message, btn.dataset.emoji);
  if (action === "delete") deleteDoc(doc(db, "chats", state.chatId, "messages", message.id)).catch(() => {});
}

async function sendCurrentMessage(state) {
  const shell = roomShell(state);
  if (!shell) return;
  const textNode = shell.querySelector("[data-text]");
  const text = textNode.value.trim();
  if (!text && state.files.length === 0 && !state.voice) return;
  const stagedFiles = [...state.files];
  const stagedVoice = state.voice;
  state.files = [];
  state.voice = null;
  renderFilePreview(state);
  renderVoicePreview(state);
  refreshComposerMode(state);
  textNode.value = "";
  autoSizeTextArea(textNode);
  setTyping(state, false);

  try {
    const attachments = [];
    for (const item of stagedFiles) attachments.push(await uploadChatFile(item.file, state.chatId, false));
    if (stagedVoice) {
      const voiceAttachment = await uploadChatFile(stagedVoice.file, state.chatId, true);
      voiceAttachment.duration = stagedVoice.seconds;
      attachments.push(voiceAttachment);
    }
    const payload = {
      text,
      attachments,
      senderUid: activeUser.uid,
      senderAliasUid: ownCallUid(),
      senderRealUid: activeUser.uid,
      senderEmail: emailKey(activeUser.email),
      senderName: ownDisplayName(),
      createdAt: serverTimestamp(),
      readBy: [activeUser.uid]
    };
    if (state.replyTo) payload.replyTo = state.replyTo;
    if (attachments[0]) {
      payload.mediaUrl = attachments[0].url;
      payload.mediaName = attachments[0].name;
      payload.mediaType = attachments[0].type;
    }
