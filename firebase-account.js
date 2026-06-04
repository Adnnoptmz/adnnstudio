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
let navBadgeUnsubscribe = null;
let navBadgeEmail = "";
let lastAccountItems = [];

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
document.getElementById("refreshAccountDataButton")?.addEventListener("click", () => {
  if (auth?.currentUser) startAccountItemsListener(auth.currentUser);
  else renderAccountItems(lastAccountItems);
});

if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      saveUser(user);
      syncClientDoc(user).catch(() => {});
      if (typeof window.renderGoogleUser === "function") window.renderGoogleUser();
      if (typeof window.hydrateUser === "function") window.hydrateUser();
      startNavBadgeListener(user);
      startAccountItemsListener(user);
    } else {
      stopFirebaseListeners();
      updateBadges(0);
    }
  });
}

function stopFirebaseListeners() {
  if (accountItemsUnsubscribe) accountItemsUnsubscribe();
  if (navBadgeUnsubscribe) navBadgeUnsubscribe();
  accountItemsUnsubscribe = null;
  navBadgeUnsubscribe = null;
  navBadgeEmail = "";
}

function startNavBadgeListener(user) {
  const key = emailKey(user?.email);
  if (!db || !key) return;
  if (navBadgeUnsubscribe && navBadgeEmail === key) return;
  if (navBadgeUnsubscribe) navBadgeUnsubscribe();
  navBadgeEmail = key;
  const itemsQuery = query(
    collection(db, "accountItems"),
    where("email", "==", key),
    where("type", "==", "notification")
  );
  navBadgeUnsubscribe = onSnapshot(itemsQuery, (snapshot) => {
    const count = snapshot.docs
      .map((docSnap) => normalizeItem(docSnap))
      .filter(isVisibleItem)
      .length;
    updateBadges(count);
  }, () => updateBadges(0));
}

function startAccountItemsListener(user) {
  if (!db || !user?.email || !location.pathname.includes("account.html")) return;
  if (accountItemsUnsubscribe) accountItemsUnsubscribe();

  setAccountStatus("");
  const itemsQuery = query(
    collection(db, "accountItems"),
    where("email", "==", emailKey(user.email))
  );

  accountItemsUnsubscribe = onSnapshot(itemsQuery, (snapshot) => {
    lastAccountItems = snapshot.docs
      .map((docSnap) => normalizeItem(docSnap))
      .filter(isVisibleItem)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    renderAccountItems(lastAccountItems);
  }, (error) => {
    setAccountStatus("");
    renderEmpty("notificationsList", "Private sync unavailable", "Check Firebase rules and admin setup, then refresh.");
    console.warn("AdnnStudio account data error", error);
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
  renderFirebaseFeed(
    "notificationsList",
    items.filter((item) => item.type === "notification"),
    "No notifications yet",
    "Nothing has been shared with this account yet.",
    "notification"
  );
  renderFirebaseFeed(
    "tasksList",
    items.filter((item) => item.type === "task"),
    "No ongoing task",
    "Nothing has been assigned yet.",
    "task"
  );
  renderFirebaseFeed(
    "invoiceList",
    items.filter((item) => item.type === "invoice"),
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

  if (isSafeUrl(item.bannerImage)) {
    const image = document.createElement("img");
    image.className = "account-banner-image";
    image.src = item.bannerImage;
    image.alt = "";
    image.loading = "lazy";
    article.appendChild(image);
  }

  const top = document.createElement("div");
  top.className = "account-item-top";
  const title = document.createElement("h2");
  const status = document.createElement("span");
  status.className = "account-status";
  title.textContent = item.title || defaultTitle(type);
  status.textContent = item.status || "New";
  top.append(title, status);

  const body = document.createElement("p");
  body.textContent = item.message || invoiceSummary(item) || "No details added yet.";

  const meta = document.createElement("div");
  meta.className = "account-meta";
  addMeta(meta, item.createdAt ? `Created ${formatDate(item.createdAt)}` : "");
  addMeta(meta, item.dueDate ? `Due ${formatDate(item.dueDate)}` : "");
  addMeta(meta, item.amount ? `${item.currency || ""} ${item.amount}`.trim() : "");
  addLink(meta, item.paymentLink, "Payment link");
  addLink(meta, item.fileLink, "Open file");
  addLink(meta, item.buttonLink, item.buttonLabel || "Open");

  article.append(top, body);
  if (meta.childElementCount) article.appendChild(meta);
  return article;
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
  const visible = Number(count) > 0;
  document.querySelectorAll("[data-notification-badge]").forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = !visible;
  });
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
