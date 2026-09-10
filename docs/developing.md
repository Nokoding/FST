# Developing

Plain React with hooks. No framework, no router, no bundler, no state library.
The build is one Babel call and a file copy, which is deliberate. This should
still build in ten years.

## Commands

```bash
npm install
npm run dev        # build, then serve dist on http://localhost:8000
npm run build      # dist/ for the web, artifact/ for the single file version
npm test           # the merge engine and state tests
npm run vendor     # refetch React and the font, only when bumping versions
python3 scripts/icons.py   # regenerate the icons, needs pip install pillow
node scripts/tap-targets.js  # checks every control is 44x44 to a finger
```

`tap-targets.js` drives a real browser and needs Playwright, which is not a
dependency here, so it is run by hand rather than in CI. The comment at the top
of the script says how. It is the thing to trust about tap targets, since the
visible size of a control and the size of its tap target are deliberately not
the same.

## Checking Settings with a config

`public/config.js` can carry a Google client ID, and a copy of the app that has
one is already set up. Settings hides the client ID field in that case and
shows only Connect, so a working copy does not look unconfigured. Type a value
into that field and it is saved on this device and the field stays, since
that is someone deliberately using their own key.

`googleDrive.preset()` in `src/sync.js` is the line between the two, and
`test/sync.test.js` covers it. What the tests cannot see is the Settings
screen, so after touching either one, open Settings once with `config.js`
filled in and once with it blank, and check the field is gone in the first and
there in the second. Nothing else surfaces this.

Use the dev server rather than opening `dist/index.html` off the disk. A
service worker needs a real origin, so the offline half of the app does nothing
from a `file://` URL.

Run `npm test` before you commit. CI runs it and refuses to deploy on a
failure.

## Layout

```
src/
  app.jsx       the whole app. React, one file
  sync.js       merge engine, storage, sync providers. Plain JS, no JSX
public/         static shell, copied into dist untouched
  vendor/       React and the font, committed on purpose
scripts/
  build.js      compiles src into dist and artifact
  serve.js      dependency free static server
  vendor.js     refetches the vendored libraries
  icons.py      regenerates the icon set
  tap-targets.js  checks every control is 44x44 to a finger
test/           tests for sync.js and for the state shape
worker/         optional Cloudflare Worker, only needed for Discord login
docs/           these pages
```

`dist/` and `artifact/` are build output and gitignored. Never commit them.

`src/sync.js` is plain JavaScript with no imports and no JSX on purpose. The
build splices it into the app, and the tests load it directly by reading the
file. Keeping it free of JSX is what makes it testable without a bundler.

## How the build works

`scripts/build.js` reads `src/sync.js` and `src/app.jsx`, splices the sync
engine into the app at the "image handling" banner comment, then emits two
targets from that one source:

- **dist/** swaps the React import for globals, points the font at the local
  woff2, drops the default export and appends a mount call.
- **artifact/** keeps the import and the default export, as one `.jsx` file.

The build also stamps a fresh service worker cache name on every run, which is
what makes an update actually reach installed devices.

If you change the React import line or that banner comment in `src/app.jsx`,
the build throws with a message telling you to update `build.js`. That is
deliberate. It fails loudly instead of emitting something broken.

## The one thing you must not break

Counts are an append only event log, not running totals. Each `+` or `-`
appends `{ id, p, d, t }`, and a person's numbers are derived from that log,
never stored:

```
count   = base.count   + every bump after base.since
allTime = base.allTime + every bump ever
```

If counts become a plain number that gets written directly, sync silently eats
data, which is the worst bug this app can have.

Any mutation to a person or a page must bump `updatedAt`. Any delete must push
a tombstone. If you touch the merge logic, add a test.
[How it works inside](architecture.md) has the full reasoning and the merge
rules.

## Where things are

- **UI, charts, panels, settings.** All of `src/app.jsx`. The charts are hand
  written SVG near the top, one function each.
- **Styling.** One `<style>` block inside the app component, near the bottom.
  The comic button system is the `.pc-btn` family, and everything clickable
  should use it rather than growing its own look. Every control has a 44 by 44
  tap target, though not every control is 44 by 44 of ink. Ones you tap rarely
  use `.pc-btn-slim`, which keeps the target and drops the height.
- **Merging, storage, sync providers.** `src/sync.js`. The state shape itself,
  `defaultState()` and `migrate()`, is at the top of `src/app.jsx`.
- **Manifest, service worker, icons, config.** `public/`.

A sync provider is an object with `connect`, `disconnect`, `linked`, `pull` and
`push`. That is the whole contract. Adding a third backend means writing those
five and adding a button.

## House rules

- No new dependencies. The only two are Babel, both dev only.
- Everything in `public/` uses relative paths, because Pages serves the app
  under `/FST/` rather than at the root. An absolute `/sw.js` or a
  `start_url: "/"` breaks the install silently.
- Do not change `STORAGE_KEY`. If the shape of the saved data changes, extend
  `migrate()` instead. Changing the key orphans everyone's data.

See [contributing](../CONTRIBUTING.md) if you want to send a change back.
