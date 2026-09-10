# Contributing

It is a personal app, but the door is open.

## Setup

```bash
npm install
npm run dev
```

[docs/developing.md](docs/developing.md) has the commands, the layout, and how
the build fits together.

## Before you open a PR

```bash
npm test
npm run build
```

CI runs both and will not deploy if either fails.

## Where to put things

- App and UI go in `src/app.jsx`.
- Anything touching how state merges goes in `src/sync.js`, and it must stay
  plain JavaScript with no imports and no JSX. The tests load that file
  directly, and keeping it dependency free is what makes that work.
- Never commit `dist/` or `artifact/`. They are build output.

## If you touch the merge logic

Add a test. The rules that must keep holding:

- merging is symmetric, A into B equals B into A
- merging is idempotent, doing it twice changes nothing the second time
- no bump event is ever counted twice or dropped
- all time totals never go down on a merge

Losing someone's counts silently is the worst bug this app can have, which is
why that file has tests and the rest does not.
[docs/architecture.md](docs/architecture.md) explains why it is built this way.

## Style

Plain React, hooks, no state library. No new dependencies without a real reason,
the whole point is that this builds and runs in ten years with a Babel call.
