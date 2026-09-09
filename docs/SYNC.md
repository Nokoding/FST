# Sync

Without this, everything lives in one browser on one device and dies if you
clear browser data. Two ways to fix that. Pick one, not both.

### Google Drive, the one I would use

No server, nothing to deploy, nothing to maintain. The app keeps a single
hidden file in your own Drive, in a special folder that only this app can read.
Google cannot see it as a normal file and neither can anything else you install.

**Get a client ID:**

1. console.cloud.google.com, make a project, any name.
2. APIs and Services, Library, search Google Drive API, Enable.
3. APIs and Services, OAuth consent screen. Pick External, fill in the app name
   and your email. Under Data access add the scope
   `https://www.googleapis.com/auth/drive.appdata`. Under Audience, add your own
   Google account as a test user. You do not need to publish or get verified,
   test mode is fine forever for personal use.
4. Credentials, Create credentials, OAuth client ID, Web application. Under
   Authorised JavaScript origins add exactly where the app is hosted, like
   `https://nokoding.github.io`. Origin only, so no `/FST` on the end, no
   trailing slash.
5. Copy the client ID. Paste it into the app under Settings, Sync, or put it in
   `config.js` so every device gets it.

Then hit Connect Google Drive.

Test mode tokens expire every 7 days, so once a week you tap Connect again. If
that annoys you, hit Publish app on the consent screen. Scopes like appdata do
not need Google's review.

### Discord

Discord can prove who you are but has nowhere to keep files, so this route needs
the little server in `worker/`. Cloudflare Workers free tier, about ten minutes
to set up, instructions in `worker/README.md`. Deploy it, paste the URL into
Settings, log in with Discord.

### When it syncs

On open, the moment the connection comes back, when you switch back to the app,
about four seconds after any change, and every three minutes while the app is in
front. There is a Sync now button too. The pill in the header tells you where
it stands: green synced, yellow working, red failed, grey offline.

### How conflicts are handled

Every `+` and `-` is stored as its own event with an id, not as a running total.
Merging two devices takes the union of their events, so if you counted on your
phone with no signal and on your laptop at the same time, you end up with both.
Nothing overwrites anything.

Profile edits work differently. Names, gradients, banners and settings are last
write wins on a timestamp, because there is no sane way to merge two different
names. Deleting someone leaves a tombstone so a device that has been offline for
a week cannot bring them back.

Totals are never stored as facts, they are recalculated from the event log every
time. That is what makes the merge safe.

### If you use both devices offline for a long time

The event log grows by one small record per click, roughly 60 bytes. A few
clicks a day is about 100KB a year, so this is not a problem you will have.

## Turning it off

Settings, Sync, Disconnect. The local copy is untouched, it just stops talking
to anything. Reconnecting merges rather than overwrites, so nothing is lost by
disconnecting for a while.

## What is actually sent

The whole state blob: sections, people, their profiles and pictures, the event
log, past periods, and settings. The device id stays local and is stripped
before upload, so devices are not identifiable from the file.

Pictures are base64 inside that blob. They are downscaled on upload, 320px for
profile pictures and 1100px for banners, which keeps the file small enough that
sync stays fast.
