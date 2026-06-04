import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let accountItemsUnsubscribe = null;
let accountReadsUnsubscribe = null;
let accountDeletesUnsubscribe = null;
let navBadgeUnsubscribe = null;
let navBadgeEmail = "";
let lastAccountItems = [];
let lastReadIds = new Set();
let lastDeletedIds = new Set();
let activeAccountUser = null;
let knownLiveItemIds = new Set();
let hasSeenFirstItemsSnapshot = false;
let notificationAudio = null;
let notificationAudioPrimed = false;

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function userPayload(user) {
  return {
    name: user.displayName || "Account",
    email: user.email || "",
    picture: user.photoURL || "",
    role: "client",
    uid: user.uid
  };
}

function saveUser(user) {
  const payload = userPayload(user);
  localStorage.setItem("adhnanPortfolioUser", JSON.stringify(payload));
  return payload;
}

async function syncClientDoc(user) {
  if (!db || !user?.email) return;
  const ref = doc(db, "clients", user.uid);
  await setDoc(ref, {
    uid: user.uid,
    email: emailKey(user.email),
    displayEmail: user.email,
    name: user.displayName || "",
    picture: user.photoURL || "",
    lastActiveAt: serverTimestamp()
  }, { merge: true });
}

async function firebaseGoogleLogin() {
  if (!auth) {
    alert("Firebase is not connected yet. Upload firebase-config.js and enable Firebase Authentication.");
    return;
  }

  try {
    const result = await signInWithPopup(auth, provider);
    saveUser(result.user);
    await syncClientDoc(result.user).catch(() => {});
    if (typeof window.renderGoogleUser === "function") window.renderGoogleUser();
    if (typeof window.hydrateUser === "function") window.hydrateUser();
    if (typeof window.setView === "function") window.setView(location.hash.replace("#", "") || "notifications");
    if (location.pathname.endsWith("index.html") || location.pathname === "/" || location.pathname === "") {
      location.href = "account.html#notifications";
    }
  } catch (error) {
    const message = error?.code === "auth/unauthorized-domain"
      ? "Add this website domain in Firebase Authentication settings, then try again."
      : "Google login could not start. Check Firebase Authentication and try again.";
    const errorNode = document.getElementById("googleLoginError");
    if (errorNode) errorNode.textContent = message;
    else alert(message);
    console.warn("AdnnStudio Firebase login error", error);
  }
}

async function firebaseLogout(event) {
  if (event) event.preventDefault();
  localStorage.removeItem("adhnanPortfolioUser");
  sessionStorage.removeItem("adnnGoogleAccessToken");
  if (auth) await signOut(auth).catch(() => {});
  if (typeof window.renderGoogleUser === "function") window.renderGoogleUser();
  if (location.pathname.includes("account.html")) location.href = "index.html#home";
}

window.startGoogleLogin = firebaseGoogleLogin;
window.logoutGoogleAccount = firebaseLogout;
document.getElementById("headerLogoutButton")?.addEventListener("click", firebaseLogout);
document.getElementById("refreshAccountDataButton")?.addEventListener("click", async () => {
  await runRefreshAnimation(async () => {
    if (auth?.currentUser) {
      startAccountReadsListener(auth.currentUser);
      startAccountDeletesListener(auth.currentUser);
      startAccountItemsListener(auth.currentUser);
    } else {
      renderAccountItems(lastAccountItems);
    }
  });
});

if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      saveUser(user);
      syncClientDoc(user).catch(() => {});
      if (typeof window.renderGoogleUser === "function") window.renderGoogleUser();
      if (typeof window.hydrateUser === "function") window.hydrateUser();
      activeAccountUser = user;
      startAccountReadsListener(user);
      startAccountDeletesListener(user);
      startAccountItemsListener(user);
    } else {
      stopFirebaseListeners();
      updateBadges({});
    }
  });
}

function stopFirebaseListeners() {
  if (accountItemsUnsubscribe) accountItemsUnsubscribe();
  if (accountReadsUnsubscribe) accountReadsUnsubscribe();
  if (accountDeletesUnsubscribe) accountDeletesUnsubscribe();
  if (navBadgeUnsubscribe) navBadgeUnsubscribe();
  accountItemsUnsubscribe = null;
  accountReadsUnsubscribe = null;
  accountDeletesUnsubscribe = null;
  navBadgeUnsubscribe = null;
  navBadgeEmail = "";
  activeAccountUser = null;
  lastReadIds = new Set();
  lastDeletedIds = new Set();
  knownLiveItemIds = new Set();
  hasSeenFirstItemsSnapshot = false;
}

["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, primeNotificationAudio, { once: true, passive: true });
});

function startAccountReadsListener(user) {
  if (!db || !user?.uid) return;
  if (accountReadsUnsubscribe) accountReadsUnsubscribe();
  const readsQuery = query(
    collection(db, "accountReads"),
    where("uid", "==", user.uid)
  );
  accountReadsUnsubscribe = onSnapshot(readsQuery, (snapshot) => {
    lastReadIds = new Set(snapshot.docs.map((docSnap) => String(docSnap.data()?.itemId || "")));
    renderAccountItems(lastAccountItems);
    updateBadgeCounts();
  }, () => {
    lastReadIds = new Set();
    updateBadgeCounts();
  });
}

function startAccountDeletesListener(user) {
  if (!db || !user?.uid) return;
  if (accountDeletesUnsubscribe) accountDeletesUnsubscribe();
  const deletesQuery = query(
    collection(db, "accountDeletes"),
    where("uid", "==", user.uid)
  );
  accountDeletesUnsubscribe = onSnapshot(deletesQuery, (snapshot) => {
    lastDeletedIds = new Set(snapshot.docs.map((docSnap) => String(docSnap.data()?.itemId || "")));
    renderAccountItems(lastAccountItems);
    updateBadgeCounts();
  }, () => {
    lastDeletedIds = new Set();
    updateBadgeCounts();
  });
}

function startAccountItemsListener(user) {
  const key = emailKey(user?.email);
  if (!db || !key) return;
  if (navBadgeUnsubscribe && navBadgeEmail === key) return;
  if (navBadgeEmail && navBadgeEmail !== key) {
    knownLiveItemIds = new Set();
    hasSeenFirstItemsSnapshot = false;
  }
  if (navBadgeUnsubscribe) navBadgeUnsubscribe();
  navBadgeEmail = key;
  const itemsQuery = query(
    collection(db, "accountItems"),
    where("email", "==", key)
  );
  navBadgeUnsubscribe = onSnapshot(itemsQuery, (snapshot) => {
    const nextItems = snapshot.docs
      .map((docSnap) => normalizeItem(docSnap))
      .filter(isVisibleItem)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    const nextIds = new Set(nextItems.map((item) => item.id));
    if (hasSeenFirstItemsSnapshot) {
      nextItems
        .filter((item) => !knownLiveItemIds.has(item.id) && !isRead(item))
        .forEach(showLiveAlert);
    }
    knownLiveItemIds = nextIds;
    hasSeenFirstItemsSnapshot = true;
    lastAccountItems = nextItems;
    renderAccountItems(lastAccountItems);
    updateBadgeCounts();
  }, (error) => {
    setAccountStatus("");
    renderEmpty("notificationsList", "Private sync unavailable", "Check Firebase rules and admin setup, then refresh.");
    console.warn("AdnnStudio account data error", error);
    updateBadges({});
  });
}

function normalizeItem(docSnap) {
  const item = docSnap.data() || {};
  return {
    id: docSnap.id,
    type: item.type || "notification",
    email: item.email || "",
    title: item.title || "",
    message: item.message || item.details || "",
    status: item.status || "New",
    bannerImage: item.bannerImage || "",
    fileLink: item.fileLink || "",
    buttonLabel: item.buttonLabel || "",
    buttonLink: item.buttonLink || "",
    paymentLink: item.paymentLink || "",
    dueDate: item.dueDate || "",
    amount: item.amount || "",
    currency: item.currency || "",
    publishAt: item.publishAt || null,
    expiresAt: item.expiresAt || null,
    createdAt: item.createdAt || null
  };
}

function isVisibleItem(item) {
  const status = String(item.status || "").toLowerCase().trim();
  if (["hidden", "archived", "deleted", "draft", "off"].includes(status)) return false;
  const now = Date.now();
  const publishTime = toMillis(item.publishAt);
  const expiryTime = toMillis(item.expiresAt);
  if (publishTime && publishTime > now) return false;
  if (expiryTime && expiryTime <= now) return false;
  return true;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function renderAccountItems(items) {
  setAccountStatus("");
  updateBadgeCounts();
  const visibleItems = items.filter((item) => !isDeleted(item));
  renderFirebaseFeed(
    "notificationsList",
    visibleItems.filter((item) => item.type === "notification"),
    "No notifications yet",
    "Nothing has been shared with this account yet.",
    "notification"
  );
  renderFirebaseFeed(
    "tasksList",
    visibleItems.filter((item) => item.type === "task"),
    "No ongoing task",
    "Nothing has been assigned yet.",
    "task"
  );
  renderFirebaseFeed(
    "invoiceList",
    visibleItems.filter((item) => item.type === "invoice"),
    "Nothing here",
    "No invoice has been added yet.",
    "invoice"
  );
}

function renderFirebaseFeed(containerId, items, emptyTitle, emptyText, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  container.classList.toggle("is-empty", !items.length);

  if (!items.length) {
    renderEmpty(containerId, emptyTitle, emptyText);
    return;
  }

  items.forEach((item) => container.appendChild(createFirebaseItem(item, type)));
}

function renderEmpty(containerId, title, text) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  container.classList.add("is-empty");
  const empty = document.createElement("div");
  empty.className = "empty-card";
  const wrapper = document.createElement("span");
  const strong = document.createElement("strong");
  const sub = document.createElement("span");
  strong.textContent = title;
  sub.textContent = text;
  wrapper.append(strong, sub);
  empty.appendChild(wrapper);
  container.appendChild(empty);
}

function createFirebaseItem(item, type) {
  const article = document.createElement("article");
  article.className = "account-item firebase-account-item";
  const unread = !isRead(item);
  article.classList.toggle("is-unread", unread);

  if (isSafeUrl(item.bannerImage)) {
    const image = document.createElement("img");
    image.className = "account-banner-image";
    image.src = item.bannerImage;
    image.alt = "";
    image.loading = "lazy";
    article.appendChild(image);
  }

  if (type === "invoice" && isSafeUrl(item.fileLink)) {
    const preview = document.createElement("iframe");
    preview.className = "account-pdf-preview";
    preview.src = pdfPreviewUrl(item.fileLink);
    preview.title = item.title ? `${item.title} preview` : "Invoice preview";
    preview.loading = "lazy";
    article.appendChild(preview);
  }

  const top = document.createElement("div");
  top.className = "account-item-top";
  const title = document.createElement("h2");
  const status = document.createElement("span");
  status.className = "account-status";
  title.textContent = item.title || defaultTitle(type);
  status.textContent = unread ? "Unread" : "Read";
  top.append(title, status);

  const body = document.createElement("p");
  body.textContent = item.message || invoiceSummary(item) || "No details added yet.";

  const meta = document.createElement("div");
  meta.className = "account-meta";
  addMeta(meta, relativeTime(item.createdAt));
  addMeta(meta, item.dueDate ? `Due ${formatDate(item.dueDate)}` : "");
  addMeta(meta, item.amount ? `${item.currency || ""} ${item.amount}`.trim() : "");
  addLink(meta, item.paymentLink, "Payment link");
  addLink(meta, item.fileLink, "Open file");
  addLink(meta, item.buttonLink, item.buttonLabel || "Open");

  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.className = "mark-read-button";
  readButton.textContent = unread ? "Mark as read" : "Mark as unread";
  readButton.addEventListener("click", async () => {
    readButton.disabled = true;
    if (isRead(item)) {
      lastReadIds.delete(item.id);
      article.classList.add("is-unread");
      status.textContent = "Unread";
      readButton.textContent = "Mark as read";
      updateBadgeCounts();
      await markItemUnread(item).catch((error) => {
        lastReadIds.add(item.id);
        article.classList.remove("is-unread");
        status.textContent = "Read";
        readButton.textContent = "Mark as unread";
        updateBadgeCounts();
        console.warn("AdnnStudio mark unread error", error);
      });
    } else {
      lastReadIds.add(item.id);
      article.classList.remove("is-unread");
      status.textContent = "Read";
      readButton.textContent = "Mark as unread";
      updateBadgeCounts();
      await markItemRead(item).catch((error) => {
        lastReadIds.delete(item.id);
        article.classList.add("is-unread");
        status.textContent = "Unread";
        readButton.textContent = "Mark as read";
        updateBadgeCounts();
        console.warn("AdnnStudio mark read error", error);
      });
    }
    readButton.disabled = false;
  });
  meta.appendChild(readButton);

  if (type === "notification" || type === "task") {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-item-button";
    deleteButton.setAttribute("aria-label", `Delete ${defaultTitle(type).toLowerCase()}`);
    deleteButton.title = "Delete from this account";
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-8.5 4h11M9 8v10m6-10v10M7.5 8l.7 12h7.6l.7-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    deleteButton.addEventListener("click", async () => {
      deleteButton.disabled = true;
      lastDeletedIds.add(item.id);
      renderAccountItems(lastAccountItems);
      updateBadgeCounts();
      await hideAccountItem(item).catch((error) => {
        lastDeletedIds.delete(item.id);
        renderAccountItems(lastAccountItems);
        updateBadgeCounts();
        console.warn("AdnnStudio delete item error", error);
      });
    });
    meta.appendChild(deleteButton);
  }

  article.append(top, body);
  if (meta.childElementCount) article.appendChild(meta);
  return article;
}

async function hideAccountItem(item) {
  if (!db || !auth?.currentUser || !item?.id) return;
  const user = auth.currentUser;
  await setDoc(doc(db, "accountDeletes", `${user.uid}_${item.id}`), {
    uid: user.uid,
    email: emailKey(user.email),
    itemId: item.id,
    itemType: item.type || "notification",
    deletedAt: serverTimestamp()
  }, { merge: true });
}

async function markItemRead(item) {
  if (!db || !auth?.currentUser || !item?.id) return;
  const user = auth.currentUser;
  await setDoc(doc(db, "accountReads", `${user.uid}_${item.id}`), {
    uid: user.uid,
    email: emailKey(user.email),
    itemId: item.id,
    itemType: item.type || "notification",
    readAt: serverTimestamp()
  }, { merge: true });
}

async function markItemUnread(item) {
  if (!db || !auth?.currentUser || !item?.id) return;
  const user = auth.currentUser;
  await deleteDoc(doc(db, "accountReads", `${user.uid}_${item.id}`));
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

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatDate(value) {
  const millis = toMillis(value);
  if (!millis) return "";
  return new Date(millis).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function relativeTime(value) {
  const millis = toMillis(value);
  if (!millis) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function pdfPreviewUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("drive.google.com") && url.pathname.includes("/view")) {
      return value.replace(/\/view(?:\?.*)?$/, "/preview");
    }
    return value;
  } catch {
    return value;
  }
}

function invoiceSummary(item) {
  const amount = item.amount ? `${item.currency || ""} ${item.amount}`.trim() : "";
  return amount ? `Invoice amount: ${amount}` : item.message;
}

function defaultTitle(type) {
  if (type === "task") return "Task";
  if (type === "invoice") return "Invoice";
  return "Notification";
}

function setAccountStatus(message) {
  const status = document.getElementById("accountDataStatus");
  if (status) status.textContent = message || "";
}

function updateBadges(count) {
  const counts = typeof count === "object" && count
    ? count
    : { notification: Number(count) || 0, task: 0, invoice: 0 };
  document.querySelectorAll("[data-notification-badge]").forEach((badge) => {
    const value = counts.notification || 0;
    badge.textContent = String(value);
    badge.hidden = value <= 0;
  });
  document.querySelectorAll("[data-account-badge]").forEach((badge) => {
    const type = badge.dataset.accountBadge || "notification";
    const value = counts[type] || 0;
    badge.textContent = String(value);
    badge.hidden = value <= 0;
  });
}

function updateBadgeCounts() {
  const counts = { notification: 0, task: 0, invoice: 0 };
  lastAccountItems.forEach((item) => {
    if (isDeleted(item)) return;
    if (!isRead(item) && counts[item.type] !== undefined) counts[item.type] += 1;
  });
  updateBadges(counts);
}

function isRead(item) {
  if (!item?.id) return false;
  return lastReadIds.has(item.id);
}

function isDeleted(item) {
  if (!item?.id) return false;
  return lastDeletedIds.has(item.id);
}

async function runRefreshAnimation(callback) {
  const button = document.getElementById("refreshAccountDataButton");
  if (button) {
    button.classList.remove("is-spinning");
    void button.offsetWidth;
    button.classList.add("is-spinning");
    button.setAttribute("aria-busy", "true");
  }
  try {
    await callback();
  } finally {
    if (button) {
      window.setTimeout(() => {
        button.classList.remove("is-spinning");
        button.removeAttribute("aria-busy");
      }, 720);
    }
  }
}

function primeNotificationAudio() {
  const audio = getNotificationAudio();
  if (!audio || notificationAudioPrimed) return;
  notificationAudioPrimed = true;
  const previousVolume = audio.volume;
  audio.volume = 0;
  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = previousVolume;
    })
    .catch(() => {
      audio.volume = previousVolume;
    });
}

function getNotificationAudio() {
  if (notificationAudio) return notificationAudio;
  notificationAudio = new Audio("Message%20Notification.wav");
  notificationAudio.preload = "auto";
  notificationAudio.volume = 0.32;
  return notificationAudio;
}

function playNotificationSound() {
  const audio = getNotificationAudio();
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = 0.32;
  audio.play().catch(() => {});
}

function showLiveAlert(item) {
  ensureLiveAlertStyle();
  playNotificationSound();

  const alert = document.createElement("div");
  alert.className = "adnn-live-alert";
  const label = document.createElement("span");
  const title = document.createElement("strong");
  label.textContent = alertLabel(item.type);
  title.textContent = item.title || defaultTitle(item.type);
  alert.append(label, title);
  document.body.appendChild(alert);

  requestAnimationFrame(() => alert.classList.add("is-visible"));
  window.setTimeout(() => alert.classList.remove("is-visible"), 4200);
  window.setTimeout(() => alert.remove(), 5200);
}

function alertLabel(type) {
  if (type === "task") return "New task";
  if (type === "invoice") return "New invoice";
  return "New notification";
}

function ensureLiveAlertStyle() {
  if (document.getElementById("adnnLiveAlertStyle")) return;
  const style = document.createElement("style");
  style.id = "adnnLiveAlertStyle";
  style.textContent = `
    .adnn-live-alert {
      position: fixed;
      right: clamp(16px, 4vw, 34px);
      bottom: clamp(18px, 4vw, 34px);
      z-index: 9999;
      width: min(320px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 22px;
      padding: 14px 16px;
      color: #fff;
      background: linear-gradient(135deg, rgba(34,34,38,.78), rgba(14,14,18,.68));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 24px 70px rgba(0,0,0,.34), 0 0 34px rgba(39,45,207,.18);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      opacity: 0;
      transform: translateY(16px) scale(.98);
      pointer-events: none;
      transition: opacity .55s ease, transform .65s cubic-bezier(.16,1,.3,1);
    }
    .adnn-live-alert.is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .adnn-live-alert span,
    .adnn-live-alert strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .adnn-live-alert span {
      color: #8d96ff;
      font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .16em;
      margin-bottom: 6px;
    }
    .adnn-live-alert strong {
      font-family: var(--font-body, Inter, system-ui, sans-serif);
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -.02em;
    }
  `;
  document.head.appendChild(style);
}

window.ADNN_FIREBASE_ADMIN = {
  auth,
  db,
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp
};
