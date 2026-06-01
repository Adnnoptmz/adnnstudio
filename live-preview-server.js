const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const oneDayMs = 24 * 60 * 60 * 1000;
const clients = new Set();

const liveReloadSnippet = `
<script>
(() => {
  const source = new EventSource("/__live");
  source.addEventListener("change", () => location.reload());
})();
</script>`;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

function sendLiveReload() {
  for (const res of clients) {
    res.write("event: change\\n");
    res.write(`data: ${Date.now()}\\n\\n`);
  }
}

function sendFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const isHtml = path.extname(filePath).toLowerCase() === ".html";
  fs.readFile(filePath, isHtml ? "utf8" : null, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", contentType(filePath));
    if (isHtml) {
      res.end(data.replace("</body>", `${liveReloadSnippet}\\n</body>`));
    } else {
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/__live") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("\\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  sendFile(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview ready at http://localhost:${port}`);
  console.log("This temporary preview will stop automatically in 24 hours.");
});

setTimeout(() => {
  sendLiveReload();
  server.close(() => {
    console.log("Temporary preview stopped after 24 hours.");
    process.exit(0);
  });
}, oneDayMs).unref();

let lastIndexMtime = 0;
setInterval(() => {
  fs.stat(path.join(root, "index.html"), (err, stats) => {
    if (err) return;
    if (!lastIndexMtime) {
      lastIndexMtime = stats.mtimeMs;
      return;
    }
    if (stats.mtimeMs !== lastIndexMtime) {
      lastIndexMtime = stats.mtimeMs;
      sendLiveReload();
    }
  });
}, 500);
