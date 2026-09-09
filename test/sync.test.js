/*
  The merge engine is the part that can silently lose your data, so it gets
  the tests. Run with: npm test

  src/sync.js has no imports and no JSX, so it loads straight into a
  function here with a few browser stubs.
*/

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

function loadSync() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "sync.js"), "utf8");
  const stub = {
    window: { PANEL_COUNT_CONFIG: {}, location: {} },
    document: {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    history: {},
    fetch: () => Promise.reject(new Error("no network in tests")),
  };
  const exported = {};
  const fn = new Function(
    "window", "document", "localStorage", "history", "fetch", "exports",
    code + `
    exports.derive = derive;
    exports.mergeStates = mergeStates;
    exports.fingerprint = fingerprint;
    exports.syncPayload = syncPayload;
    exports.googleDrive = googleDrive;
    exports.customServer = customServer;`
  );
  fn(stub.window, stub.document, stub.localStorage, stub.history, stub.fetch, exported);
  return exported;
}

const { derive, mergeStates, fingerprint, syncPayload } = loadSync();

const base = (over = {}) => ({ count: 0, allTime: 0, since: 0, touch: 0, ...over });
const person = (id, over = {}) => ({
  id, sectionId: "s1", name: id, updatedAt: 100, base: base(), ...over,
});
const state = (events, people, over = {}) => ({
  version: 3, deviceId: "dev", events, people,
  sections: [{ id: "s1", name: "Discord", updatedAt: 100 }],
  tombs: [], history: [], settings: { updatedAt: 100 }, ...over,
});

test("totals come from the event log", () => {
  const s = derive(state(
    [{ id: "e1", p: "A", d: 1, t: 1000 },
     { id: "e2", p: "A", d: 1, t: 2000 },
     { id: "e3", p: "B", d: 1, t: 1500 }],
    [person("A"), person("B")]
  ));
  assert.equal(s.people[0].count, 2);
  assert.equal(s.people[0].allTime, 2);
  assert.equal(s.people[1].count, 1);
});

test("a period reset clears the period but keeps all time", () => {
  let s = derive(state([{ id: "e1", p: "A", d: 1, t: 1000 }], [person("A")]));
  s = derive({
    ...s,
    people: s.people.map((p) => ({ ...p, base: base({ since: 2000 }) })),
  });
  assert.equal(s.people[0].count, 0);
  assert.equal(s.people[0].allTime, 1);
});

test("counting past a reset still lands in the new period", () => {
  const s = derive(state(
    [{ id: "e1", p: "A", d: 1, t: 1000 }, { id: "e2", p: "A", d: 1, t: 3000 }],
    [person("A", { base: base({ since: 2000 }) })]
  ));
  assert.equal(s.people[0].count, 1);
  assert.equal(s.people[0].allTime, 2);
});

test("two devices counting offline lose nothing and double nothing", () => {
  const shared = { id: "e1", p: "A", d: 1, t: 1000 };
  const phone = derive(state([shared, { id: "p1", p: "A", d: 1, t: 3000 }, { id: "p2", p: "A", d: 1, t: 3100 }], [person("A")]));
  const laptop = derive(state([shared, { id: "l1", p: "A", d: 1, t: 3200 }], [person("A")]));
  const merged = mergeStates(phone, laptop);
  assert.equal(merged.people[0].count, 4);
  assert.equal(merged.events.length, 4);
});

test("merging is symmetric", () => {
  const a = derive(state([{ id: "a1", p: "A", d: 1, t: 10 }], [person("A")]));
  const b = derive(state([{ id: "b1", p: "A", d: 1, t: 20 }], [person("A", { updatedAt: 300 })]));
  assert.equal(fingerprint(mergeStates(a, b)), fingerprint(mergeStates(b, a)));
});

test("merging twice changes nothing the second time", () => {
  const a = derive(state([{ id: "a1", p: "A", d: 1, t: 10 }], [person("A")]));
  const b = derive(state([{ id: "b1", p: "A", d: 1, t: 20 }], [person("A")]));
  const once = mergeStates(a, b);
  const twice = mergeStates(once, b);
  assert.equal(fingerprint(once), fingerprint(twice));
  assert.equal(once.people[0].count, twice.people[0].count);
});

test("the newer profile edit wins", () => {
  const older = state([], [person("A", { name: "old", updatedAt: 100 })]);
  const newer = state([], [person("A", { name: "new", updatedAt: 900 })]);
  assert.equal(mergeStates(older, newer).people[0].name, "new");
  assert.equal(mergeStates(newer, older).people[0].name, "new");
});

test("a stale device cannot resurrect someone you deleted", () => {
  const deleted = state([], [], { tombs: [{ id: "A", t: 500 }] });
  const stale = state([], [person("A", { updatedAt: 100 })]);
  assert.equal(mergeStates(deleted, stale).people.length, 0);
});

test("but an edit made after the delete survives", () => {
  const deleted = state([], [], { tombs: [{ id: "A", t: 500 }] });
  const edited = state([], [person("A", { updatedAt: 900 })]);
  assert.equal(mergeStates(deleted, edited).people.length, 1);
});

test("the newer settings win as a block", () => {
  const a = state([], [person("A")], { settings: { chart: "pie", updatedAt: 100 } });
  const b = state([], [person("A")], { settings: { chart: "radar", updatedAt: 800 } });
  assert.equal(mergeStates(a, b).settings.chart, "radar");
});

test("past periods are unioned, never duplicated", () => {
  const h = { id: "h1", endedAt: "2026-01-01T00:00:00.000Z", totals: [] };
  const a = state([], [person("A")], { history: [h] });
  const b = state([], [person("A")], { history: [h, { id: "h2", endedAt: "2026-02-01T00:00:00.000Z", totals: [] }] });
  assert.equal(mergeStates(a, b).history.length, 2);
});

test("counts never go negative", () => {
  const s = derive(state([{ id: "e1", p: "A", d: -5, t: 1000 }], [person("A")]));
  assert.equal(s.people[0].count, 0);
  assert.equal(s.people[0].allTime, 0);
});

test("lastTouch tracks the most recent positive count", () => {
  const s = derive(state(
    [{ id: "e1", p: "A", d: 1, t: 1000 }, { id: "e2", p: "A", d: -1, t: 5000 }],
    [person("A")]
  ));
  assert.equal(new Date(s.people[0].lastTouch).getTime(), 1000);
});

test("the device id stays local and is never uploaded", () => {
  const s = state([], [person("A")]);
  assert.equal(s.deviceId, "dev");
  assert.equal(syncPayload(s).deviceId, undefined);
});

test("merging against an empty remote is a no-op", () => {
  const s = derive(state([{ id: "e1", p: "A", d: 1, t: 10 }], [person("A")]));
  assert.equal(fingerprint(mergeStates(s, null)), fingerprint(s));
});
