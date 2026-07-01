function safeDesignerUsers() {
  try {
    const parsed = JSON.parse(process.env.ADNN_DESIGNER_USERS_JSON || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      designerid: String(item.designerid || item.designerId || "").trim(),
      authEmail: String(item.authEmail || item.email || "").trim().toLowerCase(),
      name: String(item.name || "").trim(),
      email: String(item.email || item.authEmail || "").trim().toLowerCase()
    })).filter((item) => item.designerid && item.authEmail);
  } catch (_) {
    return [];
  }
}

module.exports = function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`window.ADNN_DESIGNER_USERS = ${JSON.stringify(safeDesignerUsers())};\n`);
};
