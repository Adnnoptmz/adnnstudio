import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const config = window.ADNN_FIREBASE_CONFIG;
const app = config ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

if (auth && db && location.pathname.includes("designer-account.html")) {
  onAuthStateChanged(auth, async (user) => {
    if (!user?.uid || !isPasswordUser(user)) return;
    const snap = await getDoc(doc(db, "designers", user.uid)).catch(() => null);
    if (!snap?.exists()) return;
    const designer = snap.data() || {};
    const payload = {
      uid: user.uid,
      name: designer.name || user.email || "Designer",
      email: user.email || designer.authEmail || designer.email || "",
      authEmail: user.email || designer.authEmail || "",
      role: "designer",
      designerid: designer.designerId || designer.designerid || ""
    };
    localStorage.setItem("adnnDesignerUser", JSON.stringify(payload));
    if (typeof window.hydrateUser === "function") window.hydrateUser();
  });
}

function cleanId(value) {
  return String(value || "").trim().toUpperCase();
}

function isPasswordUser(user) {
  return Boolean(user?.providerData?.some((providerData) => providerData.providerId === "password"));
}

window.signInDesignerWithFirebase = async function signInDesignerWithFirebase(designer, password) {
  if (!auth || !db) {
    throw new Error("Firebase is not connected.");
  }

  const authEmail = String(designer.authEmail || designer.email || "").trim().toLowerCase();
  if (!authEmail) throw new Error("Designer auth email is missing.");

  const credential = await signInWithEmailAndPassword(auth, authEmail, password);
  const user = credential.user;
  const designerId = cleanId(designer.designerid || designer.designerId);
  const displayEmail = user.email || designer.authEmail || designer.email || "";
  const name = designer.name || `Designer ${designerId}`;

  await setDoc(doc(db, "designers", user.uid), {
    uid: user.uid,
    designerId,
    authEmail: user.email || authEmail,
    email: displayEmail,
    name,
    role: "designer",
    lastActiveAt: serverTimestamp()
  }, { merge: true });

  const payload = {
    uid: user.uid,
    name,
    email: displayEmail,
    authEmail: user.email || authEmail,
    role: "designer",
    designerid: designerId
  };
  window.dispatchEvent(new CustomEvent("adnnDesignerFirebaseReady", { detail: payload }));
  return payload;
};

window.signOutDesignerFirebase = async function signOutDesignerFirebase() {
  if (auth) await signOut(auth).catch(() => {});
};
