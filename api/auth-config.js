function emailList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = function handler(req, res) {
  const ownerEmail = String(process.env.ADNN_OWNER_EMAIL || "adnnoptmz@gmail.com").trim().toLowerCase();
  const configuredAdmins = emailList(process.env.ADNN_ADMIN_EMAILS);
  const admins = new Set((configuredAdmins.length ? configuredAdmins : ["getavcollab@gmail.com"]).filter(Boolean));

  const script = `
window.GOOGLE_CLIENT_ID = ${JSON.stringify(process.env.ADNN_GOOGLE_CLIENT_ID || "")};
window.GOOGLE_REDIRECT_URI = ${JSON.stringify(process.env.ADNN_GOOGLE_REDIRECT_URI || "https://www.adnnstudio.com")};
window.ADNN_OWNER_EMAIL = ${JSON.stringify(ownerEmail)};
window.ADNN_ADMIN_EMAILS = ${JSON.stringify(Array.from(admins))};
window.ADNN_ADMIN_EMAIL = window.ADNN_ADMIN_EMAILS[0] || "";
window.ADNN_IS_ADMIN_EMAIL = function ADNN_IS_ADMIN_EMAIL(email) {
  const key = String(email || "").trim().toLowerCase();
  return Array.isArray(window.ADNN_ADMIN_EMAILS) && window.ADNN_ADMIN_EMAILS.includes(key);
};
`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(script);
};
