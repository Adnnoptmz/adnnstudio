/*
  Google OAuth config shared by index.html and account.html.
  Keep production values out of GitHub. Add them only in your private deploy copy.
*/
window.GOOGLE_CLIENT_ID = "";
window.GOOGLE_REDIRECT_URI = window.location.origin;
window.ADNN_OWNER_EMAIL = "adnnoptmz@gmail.com";
window.ADNN_ADMIN_EMAILS = [
  "adnnoptmz@gmail.com",
  "getavcollab@gmail.com"
];
window.ADNN_ADMIN_EMAIL = window.ADNN_OWNER_EMAIL;
window.ADNN_IS_ADMIN_EMAIL = function ADNN_IS_ADMIN_EMAIL(email) {
  const key = String(email || "").trim().toLowerCase();
  return Array.isArray(window.ADNN_ADMIN_EMAILS)
    && window.ADNN_ADMIN_EMAILS.map((item) => String(item || "").trim().toLowerCase()).includes(key);
};
