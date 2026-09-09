/* ================================================================== */
/*  sync engine                                                        */
/* ================================================================== */
/*
   Counts are an append only log of bump events. Two devices that both
   counted while offline end up with the union of their events, so no
   click is lost. Everything else (names, gradients, banners, sections,
   settings) is last write wins on an updatedAt stamp, and deletes leave
   a tombstone so a stale device cannot resurrect a removed friend.

   A person's totals are derived, never stored as truth:
     count   = base.count   + every bump after base.since
     allTime = base.allTime + every bump ever
   Resetting a period sets base.count to 0 and base.since to now, which
   merges cleanly because it is an ordinary profile edit.
*/

const now = () => Date.now();

function derive(state) {
  const sums = {};
  const cur = {};
  const touch = {};
  const bySince = {};
  for (const p of state.people) bySince[p.id] = (p.base && p.base.since) || 0;

  for (const e of state.events) {
    sums[e.p] = (sums[e.p] || 0) + e.d;
    if (e.t > (bySince[e.p] || 0)) cur[e.p] = (cur[e.p] || 0) + e.d;
    if (e.d > 0 && e.t > (touch[e.p] || 0)) touch[e.p] = e.t;
  }

  return {
    ...state,
    people: state.people.map((p) => {
      const base = p.base || { count: 0, allTime: 0, since: 0 };
      const last = Math.max(touch[p.id] || 0, base.touch || 0);
      return {
        ...p,
        count: Math.max(0, base.count + (cur[p.id] || 0)),
        allTime: Math.max(0, base.allTime + (sums[p.id] || 0)),
        lastTouch: last ? new Date(last).toISOString() : null,
      };
    }),
  };
}

function unionById(a = [], b = []) {
  const seen = new Map();
  for (const item of [...a, ...b]) if (!seen.has(item.id)) seen.set(item.id, item);
  return [...seen.values()];
}

function unionTombs(a = [], b = []) {
  const seen = new Map();
  for (const t of [...a, ...b]) {
    const prev = seen.get(t.id);
    if (!prev || t.t > prev.t) seen.set(t.id, t);
  }
  return [...seen.values()];
}

function lwwList(a = [], b = [], tombs) {
  const dead = new Map(tombs.map((t) => [t.id, t.t]));
  const out = new Map();
  for (const item of [...a, ...b]) {
    const prev = out.get(item.id);
    if (!prev || (item.updatedAt || 0) > (prev.updatedAt || 0)) out.set(item.id, item);
  }
  return [...out.values()].filter((item) => {
    const killed = dead.get(item.id);
    return !killed || killed < (item.updatedAt || 0);
  });
}

function mergeStates(local, remote) {
  if (!remote || !remote.people) return local;
  const tombs = unionTombs(local.tombs, remote.tombs);
  const merged = {
    ...local,
    version: 3,
    events: unionById(local.events, remote.events).sort((a, b) => a.t - b.t),
    tombs,
    history: unionById(local.history, remote.history).sort((a, b) => new Date(a.endedAt) - new Date(b.endedAt)).slice(-52),
    people: lwwList(local.people, remote.people, tombs),
    sections: lwwList(local.sections, remote.sections, tombs),
    settings: (remote.settings?.updatedAt || 0) > (local.settings?.updatedAt || 0) ? remote.settings : local.settings,
  };
  return derive(merged);
}

/* what actually travels over the wire, minus device local noise */
function syncPayload(state) {
  const { deviceId, ...rest } = state;
  return rest;
}

function fingerprint(state) {
  const s = syncPayload(state);
  return JSON.stringify([
    s.events.length,
    s.tombs.length,
    s.history.length,
    s.people.map((p) => [p.id, p.updatedAt || 0]),
    s.sections.map((x) => [x.id, x.updatedAt || 0]),
    s.settings?.updatedAt || 0,
  ]);
}

/* ------------------------------------------------------------------ */
/*  provider: Google Drive, hidden app folder, no server needed        */
/* ------------------------------------------------------------------ */

const FILE_NAME = "panel-count.json";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error("Google sign in could not load, check the connection"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

const googleDrive = {
  id: "google",
  label: "Google Drive",
  token: null,
  expires: 0,

  clientId() {
    return localStorage.getItem("panelcount:googleClientId")
      || (window.PANEL_COUNT_CONFIG && window.PANEL_COUNT_CONFIG.googleClientId)
      || "";
  },

  configured() { return !!this.clientId(); },

  async auth(interactive) {
    if (this.token && now() < this.expires - 60000) return this.token;
    const google = await loadGis();
    const cid = this.clientId();
    if (!cid) throw new Error("Add a Google client ID first");
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: DRIVE_SCOPE,
        prompt: interactive ? "consent" : "",
        callback: (res) => {
          if (res.error) return reject(new Error(res.error_description || res.error));
          this.token = res.access_token;
          this.expires = now() + (res.expires_in || 3600) * 1000;
          localStorage.setItem("panelcount:googleLinked", "1");
          resolve(this.token);
        },
        error_callback: (err) => reject(new Error(err.message || "Sign in was cancelled")),
      });
      client.requestAccessToken();
    });
  },

  linked() { return localStorage.getItem("panelcount:googleLinked") === "1"; },

  async connect() { await this.auth(true); return true; },

  disconnect() {
    this.token = null;
    this.expires = 0;
    localStorage.removeItem("panelcount:googleLinked");
  },

  async call(url, opts = {}) {
    const token = await this.auth(false);
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      this.token = null;
      throw new Error("Google session expired, connect again");
    }
    if (!res.ok) throw new Error(`Drive said ${res.status}`);
    return res;
  },

  async findFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}'`);
    const res = await this.call(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`
    );
    const json = await res.json();
    return json.files && json.files[0] ? json.files[0] : null;
  },

  async pull() {
    const file = await this.findFile();
    if (!file) return null;
    const res = await this.call(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    return await res.json();
  },

  async push(payload) {
    const body = JSON.stringify(payload);
    const file = await this.findFile();
    if (file) {
      await this.call(
        `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body }
      );
      return;
    }
    const boundary = "pcbound" + Math.random().toString(36).slice(2);
    const meta = { name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    await this.call(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart }
    );
  },
};

/* ------------------------------------------------------------------ */
/*  provider: your own server, which is how Discord login works        */
/* ------------------------------------------------------------------ */

const customServer = {
  id: "server",
  label: "Discord",

  base() {
    return localStorage.getItem("panelcount:serverUrl")
      || (window.PANEL_COUNT_CONFIG && window.PANEL_COUNT_CONFIG.serverUrl)
      || "";
  },
  token() { return localStorage.getItem("panelcount:serverToken") || ""; },
  configured() { return !!this.base(); },
  linked() { return !!this.token(); },

  async connect() {
    const base = this.base().replace(/\/$/, "");
    if (!base) throw new Error("Add your server URL first");
    const back = window.location.origin + window.location.pathname;
    window.location.href = `${base}/auth/discord?redirect=${encodeURIComponent(back)}`;
    return false;
  },

  disconnect() {
    localStorage.removeItem("panelcount:serverToken");
    localStorage.removeItem("panelcount:serverUser");
  },

  /* the worker sends us back with #pc_token=... in the address */
  captureRedirect() {
    const hash = window.location.hash || "";
    const m = hash.match(/pc_token=([^&]+)/);
    if (!m) return false;
    localStorage.setItem("panelcount:serverToken", decodeURIComponent(m[1]));
    const u = hash.match(/pc_user=([^&]+)/);
    if (u) localStorage.setItem("panelcount:serverUser", decodeURIComponent(u[1]));
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  },

  async call(path, opts = {}) {
    const base = this.base().replace(/\/$/, "");
    const res = await fetch(base + path, {
      ...opts,
      headers: { Authorization: `Bearer ${this.token()}`, ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      this.disconnect();
      throw new Error("Login expired, connect again");
    }
    if (!res.ok) throw new Error(`Server said ${res.status}`);
    return res;
  },

  async pull() {
    const res = await this.call("/state");
    if (res.status === 204) return null;
    const json = await res.json();
    return json && json.people ? json : null;
  },

  async push(payload) {
    await this.call("/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};

const PROVIDERS = { google: googleDrive, server: customServer };
