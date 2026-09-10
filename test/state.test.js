/*
  defaultState() and migrate() live in src/app.jsx, which is JSX. This loads
  that file the same way the build does, minus React, so the two functions can
  be tested without a browser. Run with: npm test
*/

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const REACT_IMPORT = 'import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";';
const MARKER = "/* ================================================================== */\n/*  image handling";

function loadApp() {
  const dir = path.join(__dirname, "..", "src");
  const sync = fs.readFileSync(path.join(dir, "sync.js"), "utf8");
  const app = fs.readFileSync(path.join(dir, "app.jsx"), "utf8");
  if (!app.includes(REACT_IMPORT) || !app.includes(MARKER)) {
    throw new Error("src/app.jsx changed shape, test/state.test.js needs updating");
  }
  const source = app
    .replace(MARKER, sync + "\n" + MARKER)
    .replace(REACT_IMPORT, "")
    .replace("export default function PanelCount()", "function PanelCount()");
  const { code } = babel.transformSync(source, {
    filename: "app.jsx",
    presets: [[require.resolve("@babel/preset-react"), { runtime: "classic" }]],
    configFile: false,
    babelrc: false,
  });

  const stub = {
    React: { useState: () => [], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f, useMemo: (f) => f() },
    window: { PANEL_COUNT_CONFIG: {}, location: {} },
    document: {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    history: {},
    fetch: () => Promise.reject(new Error("no network in tests")),
  };
  const exported = {};
  const fn = new Function(
    "React", "window", "document", "localStorage", "history", "fetch", "exports",
    code + `
    exports.defaultState = defaultState;
    exports.migrate = migrate;
    exports.makePerson = makePerson;`
  );
  fn(stub.React, stub.window, stub.document, stub.localStorage, stub.history, stub.fetch, exported);
  return exported;
}

const { defaultState, migrate } = loadApp();

test("a new install starts with no pages and nobody on them", () => {
  const s = defaultState();
  assert.deepEqual(s.sections, []);
  assert.deepEqual(s.people, []);
  assert.deepEqual(s.events, []);
  assert.ok(s.settings.resetMode);
});

test("nothing to migrate gives the blank state", () => {
  const s = migrate(null);
  assert.equal(s.sections.length, 0);
  assert.equal(s.people.length, 0);
});

test("an existing install keeps its pages and people", () => {
  const saved = {
    version: 3,
    deviceId: "dev",
    sections: [{ id: "s1", name: "Discord", updatedAt: 100 }],
    people: [{ id: "A", sectionId: "s1", name: "Ada", updatedAt: 100, base: { count: 2, allTime: 9, since: 0, touch: 0 } }],
    events: [{ id: "e1", p: "A", d: 1, t: 500 }],
    tombs: [],
    history: [],
    settings: { chart: "radar", updatedAt: 100 },
  };
  const s = migrate(saved);
  assert.equal(s.sections.length, 1);
  assert.equal(s.sections[0].name, "Discord");
  assert.equal(s.people.length, 1);
  assert.equal(s.people[0].name, "Ada");
  assert.equal(s.people[0].count, 3);
  assert.equal(s.people[0].allTime, 10);
  assert.equal(s.settings.chart, "radar");
  assert.equal(s.events.length, 1);
});

test("an old record with totals but no event log keeps its numbers", () => {
  const v1 = {
    people: [{ id: "A", sectionId: "s1", name: "Ada", color: "#7FE03C", count: 4, allTime: 12 }],
    sections: [{ id: "s1", name: "Instagram" }],
    settings: { lastReset: "2026-01-01T00:00:00.000Z" },
  };
  const s = migrate(v1);
  assert.equal(s.people[0].count, 4);
  assert.equal(s.people[0].allTime, 12);
  assert.equal(s.sections.length, 1);
  assert.ok(s.people[0].theme.to);
  assert.ok(s.sections[0].updatedAt > 0);
});

test("a blank default never empties an install that has data", () => {
  const saved = {
    sections: [{ id: "s1", name: "Work", updatedAt: 100 }, { id: "s2", name: "Home", updatedAt: 100 }],
    people: [{ id: "A", sectionId: "s1", name: "Ada", updatedAt: 100 }],
    events: [],
  };
  const s = migrate(saved);
  assert.equal(s.sections.length, 2);
  assert.equal(s.people.length, 1);
  assert.equal(defaultState().sections.length, 0);
});
