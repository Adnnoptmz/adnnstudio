import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithCredential
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
const ADMIN_EMAILS = new Set([
  window.ADNN_ADMIN_EMAIL,
  ...(Array.isArray(window.ADNN_ADMIN_EMAILS) ? window.ADNN_ADMIN_EMAILS : [])
].map(emailKey).filter(Boolean));
const ADMIN_EMAIL = emailKey(window.ADNN_ADMIN_EMAIL || Array.from(ADMIN_EMAILS)[0] || "");
const provider = new GoogleAuthProvider();
provider.addScope("email");
provider.addScope("profile");
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
let clientStatusUnsubscribe = null;

function emailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.has(emailKey(email));
}

function userPayload(user) {
  return {
    name: user.displayName || "Account",
    email: user.email || "",
    picture: user.photoURL || "",
    role: isAdminEmail(user.email) ? "admin" : "client",
    uid: user.uid
  };
}

function saveUser(user) {
  const payload = userPayload(user);
  localStorage.setItem("adhnanPortfolioUser", JSON.stringify(payload));
  return payload;
}

function isGoogleUser(user) {
  return Boolean(user?.providerData?.some((providerData) => providerData.providerId === "google.com"));
}

function isInactiveClient(data = {}) {
  return data.active === false || String(data.status || "").toLowerCase().trim() === "inactive";
}

function inactiveAccountError() {
  const error = new Error("ACCOUNT_DEACTIVATED");
  error.code = "adnn/account-deactivated";
  return error;
}

function showInactiveAccountMessage() {
  const message = "This account is currently inactive. Please contact AdnnStudio.";
  const errorNode = document.getElementById("googleLoginError");
  if (errorNode) errorNode.textContent = message;
  else alert(message);
}

async function syncClientDoc(user) {
  if (!db || !user?.email) return;
  const ref = doc(db, "clients", user.uid);
