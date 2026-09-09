# FST - Friendship Tracker

Track quality time with a small number of people. Everyone gets a comic panel,
a `+` and a `-`, and a profile you can style. The dashboard turns those counts
into a pie, a donut, a disk map, bars, rings or a radar so you can see at a
glance who you have been neglecting.

It is an offline first PWA. Install it, it runs full screen with its own icon,
and it works with no connection. Sync is optional and off by default.

I built this because "am I being a bad friend" is easy to feel and hard to
check. A number is harder to argue with than a vibe.

## What it does

- A panel per person, with a torn comic edge between them. Click one and it
  grows, pushing the others aside. Panels drop detail as they get narrower, so
  eight people still works, the ones you are not looking at just become score
  strips.
- Fullscreen a panel with the corner button, a double tap, or double click.
- Profile customization roughly matching what Discord charges for: a two tone
  gradient with a free angle, a banner, picture frames, animated profile
  effects, name styles, tags, and an about text.
- Sections, so Discord friends and Instagram friends are separate boards.
- Counters that reset weekly, monthly, on a custom interval, or never. All time
  totals never reset. Old periods get filed and stay readable.
- Six chart types, drawn by hand in SVG. No chart library, which is why the
  whole app still works offline.
- Optional sync to Google Drive or Discord, see [docs/SYNC.md](docs/SYNC.md).

## Run it

```bash
npm install
npm run dev        # builds, then serves dist on http://localhost:8000
```

Opening `dist/index.html` off the disk will not work properly. A service worker
needs a real origin, so use the dev server.

```bash
npm run build      # dist/ for the web, artifact/ for the single file version
npm test           # the merge engine tests
npm run vendor     # refetch React and the font, only when bumping versions
```

## Deploy it

```bash
git remote add origin https://github.com/Nokoding/FST.git
git push -u origin main
```

Then turn Pages on once: Settings, Pages, Source, GitHub Actions. It lands at
https://nokoding.github.io/FST/ and every later push to `main` redeploys it.

Anything that serves static files works too. Netlify, Vercel, Cloudflare Pages,
your own box. Build with `npm run build` and serve `dist/`.

Full instructions including installing on a phone are in
[docs/DEPLOY.md](docs/DEPLOY.md).

## Layout

```
src/
  app.jsx       the app. React, no framework, no router
  sync.js       merge engine and sync providers, plain JS, no JSX
public/         static shell copied into dist as is
  vendor/       React and the font, committed so a clone works offline
scripts/
  build.js      compiles src into dist and artifact
  serve.js      dependency free static server for dist
  vendor.js     refetches the vendored libraries
worker/         optional Cloudflare Worker, only needed for Discord login
test/           merge engine tests
docs/           sync, deploy, and how the thing is put together
```

`src/sync.js` is deliberately plain JavaScript with no imports. The build glues
it into the app, and the tests load it directly. Keeping it free of JSX is what
makes it testable without a bundler.

## Where the data lives

On your device, in localStorage, until you turn on sync. Nothing is uploaded
anywhere by default and there is no analytics, no telemetry, no accounts.

If you do turn on sync, Google Drive keeps a hidden file in your own Drive that
only this app can read. The Discord option talks to a worker you deploy
yourself. Either way the data stays yours.

Clearing browser data wipes the app. Settings has Export a backup for this
reason. Use it before you accumulate anything you would miss.

## Notes on the design

Counts are an append only event log, not running totals. Every `+` is a record
with an id. Merging two devices takes the union of their logs, so counting on
your phone with no signal and on your laptop at the same time cannot lose
clicks. Names and settings are last write wins on a timestamp instead, because
merging two different names is not a thing. Details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT, see [LICENSE](LICENSE).
