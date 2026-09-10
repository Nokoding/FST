# Sync

Without sync, everything lives in one browser on one device. Clear your browser
data and it is gone.

Sync fixes that by keeping a copy somewhere you control, and it keeps two
devices carrying the same numbers. It is off until you turn it on.

There are two ways to do it. Pick one. Google Drive is the one to pick unless
you have a reason not to.

## Google Drive

The app saves one file into your own Google Drive, in a hidden folder that only
this app can open. It does not show up in your Drive listing, other apps cannot
read it, and it does not count against anything except your own storage.

The catch is that Google will not let an app talk to your Drive until you have
told Google that the app exists. That means a one time trip through Google's
developer console to get an ID, and it is fiddly but it is only fiddly once.
Give it fifteen minutes.

### Getting the ID

1. Go to **console.cloud.google.com** and make a project. Any name.
2. **APIs and Services**, then **Library**. Search for **Google Drive API** and
   turn it on.
3. **APIs and Services**, then **OAuth consent screen**. Choose **External**.
   Fill in an app name and your own email.
4. Still on that screen, under **Data access**, add this permission:
   `https://www.googleapis.com/auth/drive.appdata`. That is the one that means
   "its own hidden folder, nothing else".
5. Under **Audience**, add your own Google account as a test user. You do not
   need to publish anything or get reviewed by Google. Test mode is fine
   forever for personal use.
6. **Credentials**, **Create credentials**, **OAuth client ID**, then **Web
   application**. Under **Authorised JavaScript origins** put exactly where the
   app is hosted, which is `https://nokoding.github.io` if you are using my
   copy. Just that, with no `/FST` and no slash at the end. Browsers match the
   address of the site and not the path within it, so the extra bit breaks it.
7. Copy the client ID it gives you. It looks like
   `1234-abcd.apps.googleusercontent.com`.

### Turning it on

Open the app, **Settings**, **Sync**, paste the ID into the Google Drive box,
then hit **Connect Google Drive**. Sign in when Google asks. Google will warn
you that the app is not verified, which is true and is because you just made it
yourself. Continue past it.

Do the same on your other devices with the same ID and the same Google account.

### The weekly tap

While your project is in test mode, Google expires the connection every seven
days, so once a week you tap Connect again. If that gets old, go back to the
consent screen and hit **Publish app**. The permission this app uses does not
need Google's review, so publishing is just a button.

## Discord

You can log in with Discord instead. Be warned that this is more work, not
less.

Discord can prove who you are, but it gives an app nowhere to keep files. So
this route needs a small server of your own to hold the data. There is one
ready to deploy in the [worker folder](../worker/README.md), it runs free on
Cloudflare, and it takes about ten minutes to set up. Deploy it, paste its
address into Settings, then log in with Discord.

If you do not already know what a Cloudflare Worker is, use Google Drive.

## When it syncs

By itself, whenever it makes sense: when you open the app, when a connection
comes back, when you switch back to the app, a few seconds after you change
anything, and every few minutes while it is in front of you. There is a **Sync
now** button too.

The pill in the header tells you where things stand. Green is synced, yellow is
working, red is failed, grey means no connection. Tap it to see more.

## Two devices at once

Counting on your phone underground and on your laptop at the same time does not
lose anything. Both sets of taps end up in both places once they meet, and
neither device overwrites the other.

Names, colors and settings work differently. There is no sensible way to merge
two different names for the same person, so the most recent edit wins. Deleting
someone sticks, even if another device has been offline for a week and still
thinks they exist.

The [architecture notes](architecture.md) explain how that is done, if you want
the detail.

## Turning it off

**Settings**, **Sync**, **Disconnect**. Your copy on the device is untouched.
It just stops talking to anything.

Connecting again merges rather than overwrites, so a month disconnected costs
you nothing.

## What actually gets sent

Everything you would expect and nothing you would not: your pages, the people,
their profiles and pictures, every count, past periods, and your settings.

Pictures travel as part of that file. They are shrunk when you add them, which
is what keeps the whole thing small enough to sync quickly.

The id that identifies this particular device never leaves it. It is stripped
out before anything is uploaded, so the file cannot be traced back to which
phone made it.
