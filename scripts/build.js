#!/usr/bin/env node
/*
  Two targets from one source.

    dist/        the installable PWA. React comes from vendor/ as globals,
                 and the app mounts itself into #root.

    artifact/    one .jsx file that imports React and default exports the
                 component, for pasting into places that expect a module.

  src/sync.js is plain JS on purpose. It holds the merge logic, it has no
  JSX and no React, and test/sync.test.js loads it directly.
*/

const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const root = path.join(__dirname, "..");
const p = (...bits) => path.join(root, ...bits);

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');";
const FONT_LOCAL =
  "@font-face { font-family: 'Bebas Neue'; font-style: normal; font-weight: 400; " +
  "font-display: swap; src: url('vendor/bebas.woff2') format('woff2'); }";

const REACT_IMPORT = 'import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";';
const REACT_GLOBALS = "const { useState, useEffect, useRef, useCallback, useMemo } = React;";

function readSource() {
  const sync = fs.readFileSync(p("src", "sync.js"), "utf8");
  const app = fs.readFileSync(p("src", "app.jsx"), "utf8");
  if (!app.includes(REACT_IMPORT)) throw new Error("src/app.jsx: React import line changed, build.js needs updating");
  // the sync engine slots in where the app expects it, after the storage adapter
  const marker = "/* ================================================================== */\n/*  image handling";
  if (!app.includes(marker)) throw new Error("src/app.jsx: image handling banner missing, build.js needs updating");
  return app.replace(marker, sync + "\n" + marker);
}

function compile(code, filename) {
  const out = babel.transformSync(code, {
    filename,
    presets: [[require.resolve("@babel/preset-react"), { runtime: "classic" }]],
    configFile: false,
    babelrc: false,
  });
  return out.code;
}

function copyDir(from, to, skip = []) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, skip);
    else fs.copyFileSync(src, dst);
  }
}

function bumpCacheName(dist) {
  /* stamp the service worker cache so an update actually reaches devices */
  const swPath = path.join(dist, "sw.js");
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 12);
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.replace(/const CACHE = "[^"]+";/, `const CACHE = "panel-count-${stamp}";`);
  fs.writeFileSync(swPath, sw);
  return stamp;
}

function build() {
  const source = readSource();

  /* ---- PWA ---- */
  const dist = p("dist");
  fs.rmSync(dist, { recursive: true, force: true });
  copyDir(p("public"), dist);

  let web = source
    .replace(REACT_IMPORT, REACT_GLOBALS)
    .replace(FONT_IMPORT, FONT_LOCAL)
    .replace("export default function PanelCount()", "function PanelCount()");
  web += '\n\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(PanelCount));\n';
  fs.writeFileSync(path.join(dist, "app.js"), compile(web, "app.jsx"));

  const stamp = bumpCacheName(dist);

  /* ---- single file artifact ---- */
  const artifact = p("artifact");
  fs.mkdirSync(artifact, { recursive: true });
  fs.writeFileSync(path.join(artifact, "panel-count.jsx"), source);

  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + "kb";
  console.log("built");
  console.log("  dist/app.js                 " + kb(path.join(dist, "app.js")));
  console.log("  dist/  cache name           panel-count-" + stamp);
  console.log("  artifact/panel-count.jsx    " + kb(path.join(artifact, "panel-count.jsx")));
}

build();
