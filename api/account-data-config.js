module.exports = function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(
    `window.ADNN_ACCOUNT_ENDPOINT = ${JSON.stringify(process.env.ADNN_ACCOUNT_ENDPOINT || "")};\n`
  );
};
