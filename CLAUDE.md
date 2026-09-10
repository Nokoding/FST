# Working on FST

A friendship tracker. Each person gets a comic panel with a `+` and a `-`, and
a dashboard turns the counts into charts. Offline first PWA, deployed to GitHub
Pages at https://nokoding.github.io/FST/.

The repo is FST. The app calls itself Panel Count in the manifest and on the
home screen, and the header shows FST which expands to Friendship Tracker on
tap. If you rename the app, the storage key needs a migration, not a find and
replace. See "Storage" below.

## Commands

```bash
npm install
npm run dev        # build, then serve dist on localhost:8000
npm run build      # dist/ for the web, artifact/ for the single file version
npm test           # merge engine and state tests
npm run vendor     # refetch React and the font, only when bumping versions
python3 scripts/icons.py   # regenerate icons, needs pip install pillow
```

Always run `npm test` before committing. CI runs it and refuses to deploy on a
failure.

## Layout

```
src/app.jsx     the whole app. React, no framework, no router
src/sync.js     merge engine and sync providers. Plain JS, no JSX, no imports
public/         static shell, copied into dist untouched
public/vendor/  React and the font, committed on purpose
scripts/        build, dev server, vendor refresh, icon generator
test/           merge engine tests, and tests for the state shape
worker/         optional Cloudflare Worker for Discord login
docs/           the written docs, see below
```

`dist/` and `artifact/` are build output and gitignored. Never commit them.

## The docs

`README.md` and everything in `docs/` up to `hosting.md` are written for a
person who is not a developer. Plain words, no jargon, no marketing tone, no em
dashes. Technical detail lives in `developing.md` and `architecture.md` and
gets linked from a plain sentence rather than explained inline.

```
README.md             what it is, who it is for, links out. No build commands
docs/start-here.md    installing it, and the first run
docs/using-it.md      pages, panels, counting, resets, dashboard, backups
docs/sync.md          Google Drive and Discord setup, in plain language
docs/hosting.md       putting your own copy online
docs/developing.md    commands, build, layout, house rules
docs/architecture.md  state shape, merge rules, why counts are a log
```

## How the build works

`scripts/build.js` reads `src/sync.js` and `src/app.jsx`, splices the sync
engine into the app at the "image handling" banner comment, then emits two
targets from that one source:

- **dist/** swaps the React import for globals, points the font at the local
  woff2, drops the default export and appends a mount call
- **artifact/** keeps the import and the default export, as one `.jsx` file

The build also stamps a fresh service worker cache name on every run, which is
what makes an update actually reach installed devices.

If you change the React import line or that banner comment in `src/app.jsx`,
the build throws with a message telling you to update `build.js`. That is
deliberate, it fails loudly instead of emitting something broken.

## Pages and sections are the same thing

The interface calls them **pages**. The data key is `sections` and stays that
way, because renaming it breaks everyone's saved record for no benefit. Code
and docs about the data shape say sections, anything on screen says pages.

A page can be made from the `+` at the end of the tab strip in the header
(`PageStrip`), which names it inline, or from Settings. Either way `addSection`
switches to the new page, and an empty page asks for its first person rather
than sitting there empty.

## The first run walkthrough

Five steps, shown once, on a device that has never had anything in it. The
seen flag is `panelcount:tour:v1` in `localStorage`, never in the synced state,
because it is about this device and not about the person. Anyone who already
has pages or people gets the flag set for them at load and never sees it, which
is what keeps it away from someone updating from an older version. Settings,
Help, runs it again.

The first two steps advance on their own when you actually make the page and
add the person, tracked by `tourMark` against the step it started on.

## The one thing you must not break

Counts are an append only event log, not running totals. Each `+` or `-`
appends `{ id, p, d, t }`. A person's numbers are derived, never stored:

```
count   = base.count   + every bump after base.since
allTime = base.allTime + every bump ever
```

`derive()` runs after every mutation and after every merge. The `count` and
`allTime` fields on a person are a cache of that.

This exists so two devices counting offline both keep their taps. Merging is
the union of two event logs by id. If you ever make counts a plain number that
gets written directly, sync silently eats data, which is the worst bug this app
can have.

Merge rules, three shapes, three rules:

- **events**: union by id, order independent
- **people and sections**: last write wins on `updatedAt`, with tombstones in
  `tombs` so a stale device cannot resurrect a deletion
- **settings**: last write wins as a whole block, never field by field

Any mutation to a person or section must bump `updatedAt`. Any delete must push
a tombstone. Period resets set `base.count = 0` and `base.since = now`, which
merges as an ordinary profile edit.

If you touch any of this, add a test. The invariants that must keep holding:
merging is symmetric, merging is idempotent, no bump is counted twice or
dropped, all time never decreases on a merge.

## Sync

`useSync` in `src/app.jsx`. Every run is pull, merge, push, in that order. A
push without a pull first overwrites the other device.

Triggers: app open, the `online` event, `visibilitychange` to visible, four
seconds after a change, every three minutes while visible, and the manual
button.

Providers live in `src/sync.js` and implement `connect`, `disconnect`,
`linked`, `pull`, `push`. That is the whole contract. Google Drive uses Google
Identity Services and the hidden `appDataFolder`, so no server and no client
secret. The Discord provider talks to `worker/`.

## Storage

`store` in `src/sync.js` tries `window.storage` first, which exists inside a
Claude artifact, and falls back to `localStorage`, which is the real path in the
installed app. The key is `panelcount:state:v2`, defined at the top of
`src/app.jsx`.

A new install starts blank. `defaultState()` returns no sections and no people,
and the app shows a make-your-first-page screen instead of the panels. Anything
already saved wins over that blank shape, because `migrate()` spreads the saved
record over the default. There are tests for both in `test/state.test.js`.

Changing that key orphans everyone's data. If the shape changes, extend
`migrate()` instead. It already carries v1 and v2 records forward.

## Conventions

- No new dependencies. The only two are Babel, both dev only. The point is that
  this builds in ten years with one Babel call.
- Everything in `public/` uses relative paths, because Pages serves the app
  under `/FST/` rather than at the root. An absolute `/sw.js` or `start_url: "/"`
  breaks the install silently.
- The Google OAuth origin is `https://nokoding.github.io` with no `/FST`.
  Browsers match origins, not paths.
- One button system, `.pc-btn` in the style block in `src/app.jsx`. Ink
  outline, hard offset shadow, presses into the page when tapped. Tabs, chart
  switchers, settings controls, the panel plus and minus and the sync pill all
  use it. `data-on` marks a selected one, `data-danger` a destructive one,
  `.pc-btn-sm` is the compact size. Do not give a new control its own look.
  Every button is at least 44 by 44, keeps a `:focus-visible` outline, and
  stops moving under `.pc-still`, which the app puts on the root when the
  animation setting is off, and under `prefers-reduced-motion`.
- Charts are hand written SVG in `src/app.jsx`. There was a chart library once.
  It was 500kb, fought the ink styling and could not be cached for offline.
- Panels size themselves from a measured width via `ResizeObserver`, not from
  how many people there are. Four detail tiers, see `tierFor`.
- Icons are full bleed on purpose. Apple's guidance is to not bake a rounded
  rectangle into the source, since the system applies its own shape and derives
  the dark, tinted and clear variants from what you give it.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` runs the tests, builds, and
publishes to Pages. Pages source must be set to GitHub Actions in the repo
settings or `configure-pages` fails with a Not Found.

## Known rough edges

- The event log grows forever, roughly 60 bytes a click. Fine for years. A
  compaction step folding events older than the last reset into `base.allTime`
  is the honest fix, and it needs care: compacting on one device while another
  still holds those events would double count them on merge.
- No per page profile overrides, the one Discord customization not copied.
- No drag to reorder panels, and no way to move a person to another page.
- The import error string still says "Panel Count backup".
