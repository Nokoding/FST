# How it is put together

Short version: one React component tree, no framework, no router, no bundler.
The build is a Babel call and a file copy. That is deliberate, this thing should
still build in five years.

## The state

Everything lives in one object, saved as one JSON blob.

```
{
  version, deviceId,
  sections: [{ id, name, updatedAt }],
  people:   [{ id, sectionId, name, theme, photo, banner, frame, effect,
               nameStyle, bio, badges, base, updatedAt }],
  events:   [{ id, p, d, t }],
  tombs:    [{ id, t }],
  history:  [{ id, startedAt, endedAt, totals }],
  settings: { ..., updatedAt }
}
```

`deviceId` never leaves the device. Everything else syncs.

## Counts are derived, never stored

This is the one decision the rest hangs off. A person's totals are not fields
you can write to. They are recalculated from the event log every time:

```
count   = base.count   + every bump after base.since
allTime = base.allTime + every bump ever
```

Each `+` or `-` appends `{ id, p, d, t }`. Nothing edits a total directly.

Resetting a period sets `base.count = 0` and `base.since = now`, which is an
ordinary profile edit and merges like any other. `base.allTime` only ever
changes during migration from an older version, which is what keeps all time
totals monotonic.

`derive()` runs after every mutation and after every merge. The `count` and
`allTime` fields you see on a person are a cache of that, so the UI can stay
dumb.

### Why bother

Because the obvious design loses data. If counts were plain numbers and two
devices both counted while offline, whichever synced last would overwrite the
other. You would tap `+` four times across two devices and end up with two.
With a log, merging is the union of two sets of ids, so the same event appearing
on both devices is counted once and different events are both kept.

## Merging

Three different rules, because the data is three different shapes.

**Event logs: union by id.** Append only, so this is safe in any order.

**Profiles and sections: last write wins on `updatedAt`.** There is no coherent
way to merge two different names for the same person, so the newer edit takes
it. This loses the older edit, which is correct.

**Settings: last write wins as a whole block.** Merging field by field would let
two devices produce a settings object that neither of them ever had.

Deletes leave a tombstone in `tombs`. On merge, a person is dropped if a
tombstone exists that is newer than their last edit. That stops a device that
has been offline for a week from resurrecting someone you removed, while still
letting a genuine edit made after the delete win.

The merge is symmetric and idempotent, both of which are tested. Merging A into
B gives the same result as B into A, and merging twice changes nothing the
second time.

## The sync loop

`useSync` in `src/app.jsx`. It fires on:

- app open
- the `online` event, the moment a connection comes back
- `visibilitychange` to visible, so switching back to the app pulls
- four seconds after any change, debounced
- every three minutes while the app is in front
- the Sync now button

Each run is always pull, merge, push. Never push alone. A push that has not
pulled first is how you overwrite the other device.

Runs are serialised by a `busy` flag with a single queued follow up, so rapid
changes coalesce instead of stacking requests. `fingerprint()` compares state
cheaply so an unchanged state is not uploaded on a timer.

## Providers

`PROVIDERS` maps an id to an object with `connect`, `disconnect`, `linked`,
`pull` and `push`. That is the whole contract. Adding a third backend means
writing those five and adding a button.

**Google Drive** uses Google Identity Services for a browser access token, so
there is no client secret and no server. Files go to `appDataFolder`, a hidden
per app folder in the user's own Drive. Tokens last an hour and are refreshed
silently.

**The worker** is a normal REST pair, `GET /state` and `PUT /state`, behind a
bearer token that the Cloudflare Worker issues after a Discord login. Discord
is only doing identity. The storage is Cloudflare KV.

## The charts

Hand written SVG in `src/app.jsx`: pie, donut, treemap, bar, rings, radar. The
treemap uses a recursive squarified layout, which is the same idea as a disk
usage map, splitting along the longer axis each time.

There was a chart library here originally. It was around 500kb, it fought the
thick ink styling, and it could not be cached cleanly for offline. Six charts
by hand came to about 200 lines.

## Panel sizing

Each panel measures itself with a `ResizeObserver` and picks a detail tier from
its real width, not from how many people there are:

```
>= 330px   everything: picture, name, count, buttons, stats
>= 205px   drops the stats
>= 125px   drops the picture, shrinks the buttons
<  125px   count and buttons only
```

Measuring beats counting because the expanded panel and the squeezed ones need
different answers at the same time.

## Storage

`store` in `src/sync.js` tries `window.storage` first, which exists when the app
runs inside a Claude artifact, and falls back to `localStorage`, which is the
real path in the installed PWA. Same code both places.

Writes are debounced 350ms. A failed write surfaces in the status bar rather
than failing silently, since the usual cause is a full quota from too many
banner images.

## Things I would fix next

- The event log grows forever. Roughly 60 bytes a click, so a few clicks a day
  is about 100kb a year. Fine for years, but a compaction step that folds events
  older than the last reset into `base.allTime` would be the honest fix. It
  needs care: compacting on one device while another still holds those events in
  its log would double count them on merge.
- No per section profile overrides, which is the one Discord customization
  feature not copied.
- Reordering panels by dragging.
