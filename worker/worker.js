/*
  Panel Count sync server.

  Runs on Cloudflare Workers, free tier. It does two jobs: log you in with
  Discord, and keep one JSON blob per Discord account in KV.

  Routes:
    GET  /auth/discord?redirect=<app url>   start the login
    GET  /auth/discord/callback             Discord returns here
    GET  /state                             read your blob
    PUT  /state                             write your blob
    GET  /health                            check it is alive

  Secrets to set with wrangler:
    DISCORD_CLIENT_ID
    DISCORD_CLIENT_SECRET
    ALLOWED_ORIGIN     where your app is hosted, no trailing slash

  KV namespace binding: PANEL_KV
*/

const SESSION_DAYS = 90;

function cors(env, extra = {}) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

function json(env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(env, { "Content-Type": "application/json" }),
  });
}

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function userFor(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const userId = await env.PANEL_KV.get(`token:${token}`);
  return userId || null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (path === "/health") {
      return json(env, { ok: true, service: "panel-count-sync" });
    }

    /* step one: send them to Discord */
    if (path === "/auth/discord") {
      const back = url.searchParams.get("redirect") || env.ALLOWED_ORIGIN;
      const state = newToken();
      await env.PANEL_KV.put(`state:${state}`, back, { expirationTtl: 600 });
      const auth = new URL("https://discord.com/oauth2/authorize");
      auth.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      auth.searchParams.set("redirect_uri", `${url.origin}/auth/discord/callback`);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "identify");
      auth.searchParams.set("state", state);
      return Response.redirect(auth.toString(), 302);
    }

    /* step two: Discord sends them back with a code */
    if (path === "/auth/discord/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return json(env, { error: "missing code" }, 400);

      const back = await env.PANEL_KV.get(`state:${state}`);
      if (!back) return json(env, { error: "login expired, start again" }, 400);
      await env.PANEL_KV.delete(`state:${state}`);

      const form = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${url.origin}/auth/discord/callback`,
      });
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!tokenRes.ok) return json(env, { error: "Discord rejected the code" }, 401);
      const tokens = await tokenRes.json();

      const meRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!meRes.ok) return json(env, { error: "could not read your Discord account" }, 401);
      const me = await meRes.json();

      const session = newToken();
      await env.PANEL_KV.put(`token:${session}`, me.id, { expirationTtl: SESSION_DAYS * 86400 });

      const dest = new URL(back);
      dest.hash = `pc_token=${session}&pc_user=${encodeURIComponent(me.username || me.id)}`;
      return Response.redirect(dest.toString(), 302);
    }

    /* the blob itself */
    if (path === "/state") {
      const userId = await userFor(request, env);
      if (!userId) return json(env, { error: "not logged in" }, 401);

      if (request.method === "GET") {
        const blob = await env.PANEL_KV.get(`state:user:${userId}`);
        if (!blob) return new Response(null, { status: 204, headers: cors(env) });
        return new Response(blob, { headers: cors(env, { "Content-Type": "application/json" }) });
      }

      if (request.method === "PUT") {
        const body = await request.text();
        if (body.length > 20 * 1024 * 1024) return json(env, { error: "too big" }, 413);
        try { JSON.parse(body); } catch (e) { return json(env, { error: "not valid json" }, 400); }
        await env.PANEL_KV.put(`state:user:${userId}`, body);
        return json(env, { ok: true, bytes: body.length });
      }
    }

    return json(env, { error: "no such route" }, 404);
  },
};
