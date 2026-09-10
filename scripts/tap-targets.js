#!/usr/bin/env node
/*
  Checks that every control in the app is at least 44 by 44 to a finger.

  Not every control is 44 by 44 of ink. The ones you tap rarely, the logo, the
  sync pill, the view switcher, are visually shorter and carry an invisible
  zone instead, see .pc-btn-slim in src/app.jsx. So a check that measures the
  visible box reports those as failures when they are fine. This one asks the
  browser what a tap at a given point actually hits, walking outwards from the
  middle of each control until the answer stops being that control. That is
  the real target, however it was built.

  It also catches two zones sitting on top of each other, without looking for
  it directly: if a neighbour's zone covers this one, the browser hands the tap
  to the neighbour, and the measured target comes back too small.

  Playwright is deliberately not a dependency of this repo, so this does not
  run in npm test or in CI. Install it somewhere else and point Node at it:

    npm --prefix /tmp/pw install playwright
    npx playwright install chromium
    NODE_PATH=/tmp/pw/node_modules node scripts/tap-targets.js

  Run npm run build first. Exits 0 when everything clears 44, 1 on a failure,
  2 when it could not run at all.
*/

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const MIN = 44;
const PORT = Number(process.env.PORT) || 8123;
const root = path.join(__dirname, "..");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error("This needs Playwright, which is not a dependency of this repo on purpose.\n");
  console.error("  npm --prefix /tmp/pw install playwright");
  console.error("  npx playwright install chromium");
  console.error("  NODE_PATH=/tmp/pw/node_modules node scripts/tap-targets.js");
  process.exit(2);
}

if (!fs.existsSync(path.join(root, "dist", "app.js"))) {
  console.error("No dist/ yet. Run: npm run build");
  process.exit(2);
}

/* two pages and two people, so the strip looks like someone's real install */
const seed = () => {
  const now = Date.now();
  const person = (id, name, to) => ({
    id, sectionId: "s1", name, updatedAt: now, theme: { from: "#F4F1E8", to, angle: 168 },
    base: { count: 0, allTime: 0, since: 0, touch: 0 },
  });
  return {
    version: 3, deviceId: "probe",
    sections: [{ id: "s1", name: "Discord", updatedAt: now }, { id: "s2", name: "Work", updatedAt: now }],
    people: [person("A", "Ada", "#7FE03C"), person("B", "Bo", "#A855F7")],
    events: [{ id: "e1", p: "A", d: 1, t: now - 900 }, { id: "e2", p: "B", d: 1, t: now - 800 }],
    tombs: [], history: [],
    settings: {
      transition: "split", chart: "pie", chartSource: "period", chartScope: "section",
      resetMode: "weekly", resetWeekday: 0, resetDay: 1, customDays: 14,
      lastReset: new Date(now).toISOString(), halftone: true, motion: true,
      photoBackdrop: true, showBios: true, updatedAt: now,
    },
  };
};

/* runs in the page: walk out from the middle of each control until a tap
   there stops landing on it, which gives the target a finger really gets */
const PROBE = (min) => {
  const REACH = 80;
  const vw = window.innerWidth, vh = window.innerHeight;

  const lands = (x, y, el) => {
    if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit));
  };

  const out = [];
  const controls = [...document.querySelectorAll("button, input, select, textarea, [role=button]")];

  for (const el of controls) {
    if (el.getBoundingClientRect().width === 0) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;

    /* elementFromPoint only answers for what is on screen, so bring each one
       into view before asking about it */
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    if (cx < 0 || cy < 0 || cx >= vw || cy >= vh) continue;

    /* something is sitting on top of the middle of it, which is its own bug */
    if (!lands(cx, cy, el)) {
      out.push({
        name: (el.getAttribute("aria-label") || el.textContent || el.placeholder || el.tagName).trim().slice(0, 26),
        cls: el.className.toString().slice(0, 30),
        visual: [Math.round(r.width), Math.round(r.height)],
        tap: [0, 0], covered: true,
      });
      continue;
    }

    const reachOut = (dx, dy) => {
      let n = 1;
      while (n <= REACH && lands(cx + dx * n, cy + dy * n, el)) n++;
      return n - 1;
    };

    const left = reachOut(-1, 0), right = reachOut(1, 0);
    const up = reachOut(0, -1), down = reachOut(0, 1);

    out.push({
      name: (el.getAttribute("aria-label") || el.textContent || el.placeholder || el.tagName).trim().slice(0, 26),
      cls: el.className.toString().slice(0, 30),
      visual: [Math.round(r.width), Math.round(r.height)],
      tap: [left + right + 1, up + down + 1],
      covered: false,
    });
  }
  return out;
};

function serve() {
  const child = spawn(process.execPath, [path.join(root, "scripts", "serve.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  const ready = new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const poke = () => {
      http.get({ host: "127.0.0.1", port: PORT, path: "/" }, (res) => { res.resume(); resolve(); })
        .on("error", () => {
          if (Date.now() > deadline) return reject(new Error("the dev server did not come up"));
          setTimeout(poke, 150);
        });
    };
    poke();
  });
  return { child, ready };
}

(async () => {
  const server = serve();
  let failures = 0;
  let checked = 0;

  try {
    await server.ready;
    const browser = await chromium.launch();

    for (const [w, h, where] of [[390, 780, "phone"], [1200, 800, "desktop"]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
      await page.evaluate((state) => {
        localStorage.setItem("panelcount:state:v2", JSON.stringify(state));
        localStorage.setItem("panelcount:tour:v1", "done");
      }, seed());
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(400);

      for (const view of ["Panels", "Dashboard", "Settings"]) {
        await page.getByRole("button", { name: view, exact: true }).first().click();
        await page.waitForTimeout(350);

        const found = await page.evaluate(PROBE, MIN);
        checked += found.length;
        const bad = found.filter((c) => c.covered || c.tap[0] < MIN || c.tap[1] < MIN);

        console.log(`${where} ${w}x${h}  ${view.padEnd(9)} ${String(found.length).padStart(3)} controls, ${bad.length} under ${MIN}`);
        for (const c of bad) {
          failures++;
          const why = c.covered ? "something is covering it" : `tap ${c.tap[0]}x${c.tap[1]}`;
          console.log(`    ${c.name.padEnd(26)} visual ${c.visual[0]}x${c.visual[1]}   ${why}   [${c.cls}]`);
        }
      }
      await ctx.close();
    }
    await browser.close();
  } catch (err) {
    console.error("could not finish:", err.message);
    server.child.kill();
    process.exit(2);
  }

  server.child.kill();
  console.log(`\n${checked} controls measured, ${failures} under ${MIN} by ${MIN}.`);
  process.exit(failures ? 1 : 0);
})();
