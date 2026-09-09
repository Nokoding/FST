#!/usr/bin/env node
/*
  Refetches the vendored libraries into public/vendor.

  They are committed on purpose: a fresh clone builds and runs with no
  network, and the installed app never loads anything from the internet.
  Only run this when bumping a version.
*/

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "vendor");
const FILES = [
  ["react.js", "https://unpkg.com/react@18.3.1/umd/react.production.min.js"],
  ["react-dom.js", "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"],
  ["bebas.woff2", "https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2"],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, url] of FILES) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`${name}  ${(buf.length / 1024).toFixed(1)}kb`);
  }
})();
