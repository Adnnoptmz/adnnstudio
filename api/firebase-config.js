function jsonString(value) {
  return JSON.stringify(String(value || ""));
}

module.exports = function handler(req, res) {
  const config = {
    apiKey: process.env.ADNN_FIREBASE_API_KEY || "",
    authDomain: process.env.ADNN_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.ADNN_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.ADNN_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.ADNN_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.ADNN_FIREBASE_APP_ID || "",
    measurementId: process.env.ADNN_FIREBASE_MEASUREMENT_ID || ""
  };

  const ready = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(
    ready
      ? `window.ADNN_FIREBASE_CONFIG = ${JSON.stringify(config)};\n`
      : "window.ADNN_FIREBASE_CONFIG = null;\n"
  );
};
