import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

let itemsUnsubscribe = null;
let deletesUnsubscribe = null;
let latestItems = [];
let deletedIds = new Set();

if (auth && db) {
  installDesignerItemStyles();
  onAuthStateChanged(auth, (user) => {
    stopDesignerItems();
    if (!user?.email) return;
    startDesignerDeletes(user);
    startDesignerItems(user);
  });
}

function startDesignerItems(user) {
  const itemsQuery = query(
    collection(db, "accountItems"),
    where("email", "==", emailKey(user.email))
  );
  itemsUnsubscribe = onSnapshot(itemsQuery, (snapshot) => {
    latestItems = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .filter(isVisibleItem)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    renderAll();
  }, () => {
    renderEmpty("designerNotificationsList", "Sync unavailable", "Check Firebase rules, then refresh.");
  });
}

function startDesignerDeletes(user) {
  const deletesQuery = query(
    collection(db, "accountDeletes"),
    where("uid", "==", user.uid)
  );
  deletesUnsubscribe = onSnapshot(deletesQuery, (snapshot) => {
    deletedIds = new Set(snapshot.docs.map((docSnap) => String(docSnap.data()?.itemId || "")));
    renderAll();
  });
}

function stopDesignerItems() {
  if (itemsUnsubscribe) itemsUnsubscribe();
  if (deletesUnsubscribe) deletesUnsubscribe();
  itemsUnsubscribe = null;
  deletesUnsubscribe = null;
  latestItems = [];
  deletedIds = new Set();
}

function renderAll() {
  const visible = latestItems.filter((item) => !deletedIds.has(item.id));
  renderFeed("designerNotificationsList", visible.filter((item) => item.type === "notification"), "No notifications yet", "Nothing has been shared with this designer account yet.");
  renderFeed("designerTasksList", visible.filter((item) => item.type === "task"), "No ongoing task", "Nothing has been assigned yet.");
  renderFeed("designerInvoiceList", visible.filter((item) => item.type === "invoice"), "Nothing here", "No invoice has been added yet.");
}

function renderFeed(containerId, items, emptyTitle, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    renderEmpty(containerId, emptyTitle, emptyText);
    return;
  }
  items.forEach((item) => container.appendChild(createItem(item)));
}

function createItem(item) {
  const article = document.createElement("article");
  article.className = "designer-item-card";

  if (isSafeUrl(item.bannerImage)) {
    const image = document.createElement("img");
    image.src = item.bannerImage;
    image.alt = "";
    image.loading = "lazy";
    article.appendChild(image);
  }

  const top = document.createElement("div");
  top.className = "designer-item-top";
  const title = document.createElement("h2");
  title.textContent = item.title || defaultTitle(item.type);
  const status = document.createElement("span");
  status.textContent = item.status || "New";
  top.append(title, status);

  const message = document.createElement("p");
  message.textContent = item.message || item.details || invoiceSummary(item) || "No details added yet.";

  const meta = document.createElement("div");
  meta.className = "designer-item-meta";
  addMeta(meta, relativeTime(item.createdAt));
  addMeta(meta, item.dueDate ? `Due ${formatDate(item.dueDate)}` : "");
  addMeta(meta, item.amount ? `${item.currency || ""} ${item.amount}`.trim() : "");
  addLink(meta, item.fileLink, "Open file");
  addLink(meta, item.paymentLink, "Payment link");
  addLink(meta, item.buttonLink, item.buttonLabel || "Open");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "designer-delete-button";
  deleteButton.title = "Delete from this account";
  deleteButton.setAttribute("aria-label", "Delete from this account");
  deleteButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-8.5 4h11M9 8v10m6-10v10M7.5 8l.7 12h7.6l.7-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  deleteButton.addEventListener("click", () => hideItem(item));
  meta.appendChild(deleteButton);

  article.append(top, message, meta);
  return article;
}

async function hideItem(item) {
  const user = auth.currentUser;
  if (!user || !item?.id) return;
  deletedIds.add(item.id);
  renderAll();
  await setDoc(doc(db, "accountDeletes", `${user.uid}_${item.id}`), {
    uid: user.uid,
    email: emailKey(user.email),
    itemId: item.id,
    itemType: item.type || "notification",
    deletedAt: serverTimestamp()
  }, { merge: true }).catch(() => {
    deletedIds.delete(item.id);
    renderAll();
  });
}

function renderEmpty(containerId, title, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-card";
  empty.innerHTML = `<span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></span>`;
  container.appendChild(empty);
}

function addMeta(container, text) {
  if (!text) return;
  const span = document.createElement("span");
  span.textContent = text;
  container.appendChild(span);
}

function addLink(container, href, label) {
  if (!isSafeUrl(href)) return;
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function isVisibleItem(item) {
  const status = String(item.status || "").toLowerCase().trim();
  if (["hidden", "archived", "deleted", "draft", "off"].includes(status)) return false;
  const now = Date.now();
  const publishAt = toMillis(item.publishAt);
  const expiresAt = toMillis(item.expiresAt);
  return (!publishAt || publishAt <= now) && (!expiresAt || expiresAt > now);
}

function invoiceSummary(item) {
  const amount = item.amount ? `${item.currency || ""} ${item.amount}`.trim() : "";
  return amount ? `Invoice amount: ${amount}` : "";
}

function defaultTitle(type) {
  if (type === "task") return "Task";
  if (type === "invoice") return "Invoice";
  return "Notification";
}

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return "";
  return new Date(millis).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function relativeTime(value) {
  const millis = toMillis(value);
  if (!millis) return "Just now";
  const minutes = Math.floor(Math.max(0, Date.now() - millis) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function installDesignerItemStyles() {
  if (document.getElementById("adnnDesignerItemStyles")) return;
  const style = document.createElement("style");
  style.id = "adnnDesignerItemStyles";
  style.textContent = `
    .designer-feed {
      margin-top: 38px;
      display: grid;
      gap: 14px;
    }
    .designer-item-card {
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 24px;
      padding: 20px;
      background: rgba(255,255,255,.62);
      box-shadow: 0 18px 52px rgba(0,0,0,.055);
    }
    .designer-item-card > img {
      width: 100%;
      max-height: 260px;
      object-fit: cover;
      border-radius: 18px;
      margin-bottom: 16px;
    }
    .designer-item-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 12px;
    }
    .designer-item-top h2 {
      margin: 0;
      font-size: clamp(20px,2vw,28px);
      line-height: 1.1;
      letter-spacing: -.035em;
      font-weight: 400;
      color: var(--accent);
    }
    .designer-item-top span,
    .designer-item-meta span,
    .designer-item-meta a,
    .designer-item-meta button {
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 999px;
      padding: 8px 10px;
      background: rgba(255,255,255,.54);
      color: rgba(11,11,13,.62);
      font-family: var(--font-mono);
      font-size: 10px;
      text-decoration: none;
    }
    .designer-item-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
      font-size: 15px;
    }
    .designer-item-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    .designer-item-meta a { color: var(--accent); border-color: rgba(39,45,207,.18); }
    .designer-item-meta .designer-delete-button {
      width: 34px;
      height: 34px;
      padding: 0;
      display: grid;
      place-items: center;
      color: #ff2602;
      border-color: rgba(255,38,2,.16);
      cursor: pointer;
    }
    .designer-delete-button svg {
      width: 15px;
      height: 15px;
      display: block;
    }
  `;
  document.head.appendChild(style);
}
