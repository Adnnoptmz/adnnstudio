window.GOOGLE_CLIENT_ID = "";
window.GOOGLE_REDIRECT_URI = window.location.origin;
window.ADNN_OWNER_EMAIL = "adnnoptmz@gmail.com";
window.ADNN_ADMIN_EMAILS = [
  "getavcollab@gmail.com"
];
window.ADNN_ADMIN_EMAIL = window.ADNN_ADMIN_EMAILS[0] || "";
window.ADNN_IS_ADMIN_EMAIL = function ADNN_IS_ADMIN_EMAIL(email) {
  const key = String(email || "").trim().toLowerCase();
  return Array.isArray(window.ADNN_ADMIN_EMAILS)
    && window.ADNN_ADMIN_EMAILS.map((item) => String(item || "").trim().toLowerCase()).includes(key);
};
