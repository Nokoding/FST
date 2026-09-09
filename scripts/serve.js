#!/usr/bin/env node
/*
  Static server for dist/, no dependencies.

  A service worker needs a real origin, so opening dist/index.html straight
  off the disk will not register it and offline mode will look broken.
  Use this instead: npm run dev
*/

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "dist");
const port = Number(process.env.PORT) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

if (!fs.existsSync(root)) {
  console.error("No dist/ yet. Run: npm run build");
  process.exit(1);
}

http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(root, clean === "/" ? "index.html" : clean);

  /* never let a path escape dist/ */
  if (!file.startsWith(root)) {
    res.writeHead(403).end("nope");
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, "index.html");
  }

  const type = TYPES[path.extname(file)] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Service-Worker-Allowed": "/",
  });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`serving dist/ on http://localhost:${port}`);
  console.log("stop with ctrl+c");
});
