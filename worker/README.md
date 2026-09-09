# Panel Count sync server

Only needed if you want to log in with **Discord**. Google Drive sync needs
none of this.

Discord can prove who you are, but it gives you nowhere to keep files. So this
worker holds the data: one JSON blob per Discord account, in Cloudflare KV.
Free tier covers this many times over.

## Setup, about ten minutes

**1. Make a Discord application**

Go to discord.com/developers/applications, hit New Application, name it.
Open OAuth2 and copy the Client ID and Client Secret. Under Redirects add:

    https://fst.nokoding.workers.dev/auth/discord/callback

The subdomain comes from your Cloudflare account, so you only know the real
address after step 3. Come back and fix this then. It must match exactly.

**2. Install wrangler and log in**

    npm install -g wrangler
    wrangler login

**3. Make the KV store and deploy**

    cd worker
    npx wrangler kv namespace create PANEL_KV

Copy the id it prints into `wrangler.toml`. Set `ALLOWED_ORIGIN` in the same
file to wherever the app is hosted, with no trailing slash. Then:

    npx wrangler secret put DISCORD_CLIENT_ID
    npx wrangler secret put DISCORD_CLIENT_SECRET
    npx wrangler deploy

It prints your worker URL. Check it with:

    curl https://fst.nokoding.workers.dev/health

**4. Point the app at it**

Open the app, Settings, Sync, paste the worker URL under Discord, then Log in
with Discord.

## What it stores

Your Discord user id, and the JSON blob. Nothing else. The `identify` scope is
the narrowest one Discord offers, it cannot read your messages, servers, or
anything else. Sessions last 90 days.

## Routes

    GET  /auth/discord?redirect=<app url>   start login
    GET  /auth/discord/callback             Discord returns here
    GET  /state                             read the blob, 204 when empty
    PUT  /state                             write the blob
    GET  /health                            liveness check

`/state` needs `Authorization: Bearer <token>` where the token is what the
callback handed back to the app.
