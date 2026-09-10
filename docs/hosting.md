# Host your own copy

You do not need to do this to use the app. This is for putting your own copy
online, under your own address, so you are not depending on mine.

The whole thing is static files, so anywhere that serves web pages will do.

## GitHub Pages, free

1. Fork this repo, or push your own copy of it to GitHub.

       git remote add origin https://github.com/YOURNAME/FST.git
       git push -u origin main

2. In the repo, go to **Settings**, then **Pages**, and set **Source** to
   **GitHub Actions**. This has to be done by hand once. The build fails with a
   confusing Not Found error if you skip it.
3. Push to `main`. That runs the tests, builds the app, and publishes it.

It lands at `https://YOURNAME.github.io/FST/`. Every later push to `main` puts
the new version out, and installed copies pick it up on their own.

The workflow is in `.github/workflows/deploy.yml`. It will not deploy if the
tests fail, which is the point of having it.

## Anywhere else

Build it and upload the `dist` folder.

    npm install
    npm run build

That works for Netlify, Vercel, Cloudflare Pages, or a folder on your own
server. The quickest version of all: run the build, then drag `dist` onto
app.netlify.com/drop.

It has to be served over HTTPS, and it has to be served by a real web server.
Opening the files off your disk will not work properly, because the piece that
makes the app run without internet refuses to load that way.

## On your own machine

    npm install
    npm run dev

Serves it at http://localhost:8000.

## Two things that catch people out

**The app sits in a subfolder.** GitHub Pages serves it under `/FST/` rather
than at the root of the domain. Everything in the app refers to its files by
relative path for that reason, so it works either way. If you change any of
that, keep the paths relative.

**Sync is set up per address.** If you host your own copy, the Google Drive
setup in [sync](sync.md) needs your address rather than mine, and it wants the
site address only. `https://yourname.github.io`, with no folder on the end.

Installing the hosted app onto a phone works the same as with mine, see
[start here](start-here.md).
