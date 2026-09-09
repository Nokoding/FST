# Deploying and installing

The whole thing is static files, so any HTTPS host works. Two easy options.

### GitHub Pages

1. Push this repo to GitHub.

       git remote add origin https://github.com/Nokoding/FST.git
       git push -u origin main

2. Settings, then Pages, then set Source to GitHub Actions.
3. Push to `main`. The workflow runs the tests, builds, and publishes.

It goes live at https://nokoding.github.io/FST/. That is a project page, so the
app sits under a `/FST/` path rather than at the root. Everything in here uses
relative paths for exactly that reason, so the manifest scope, the service
worker and the vendored files all resolve correctly without changes.

One thing that does not follow the path: the Google OAuth origin. That is
`https://nokoding.github.io` with no `/FST`, because browsers match origins, not
paths.

The Action is in `.github/workflows/deploy.yml`. It refuses to deploy if the
tests fail, which is the point.

### Netlify Drop

Run `npm run build`, then drag the `dist` folder onto app.netlify.com/drop.

### Locally

    npm run dev

Serves `dist` on http://localhost:8000. A service worker needs a real origin,
so opening the file off the disk will not register it.

## Then add it to your device

- **Android, Chrome:** the browser shows an install prompt, or use the menu and
  pick Install app. There is also an Install button in the app's Settings tab.
- **iPhone, Safari:** Share, then Add to Home Screen. Safari does not show an
  install prompt, this is the only way.
- **Windows and Mac, Chrome or Edge:** the install icon appears at the right of
  the address bar.

Once installed it opens full screen with its own icon and works with no
connection. React and the font are bundled, so nothing loads from the internet
at runtime.
