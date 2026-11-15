# Running and self-hosting flowdraft

This guide covers local development, the production build, the database and the OAuth setup that the MCP server needs. flowdraft.tech itself runs on a self-hosted Supabase at `api.flowdraft.tech`; replace the domains below with your own.

## Local development

Requires Node.js 22+ and a Supabase project (Cloud or self-hosted).

```bash
cp .env.example .env   # SUPABASE_URL and SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:5173
```

Other scripts: `npm run typecheck`, `npm run check:guides` (validates the SEO guide pages).

## Production

```bash
npm run build
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm start   # :3000
```

`npm run build` type-checks, builds the web app into `dist/` and compiles the MCP server into `dist-server/`.

**Docker / Coolify:** build pack **Dockerfile**, port **3000**, environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`. They reach the browser at runtime through `/config.js`, so changing them needs no rebuild.

## Database

Run the files in `supabase/migrations/` in order (0001 → 0006) in the Supabase SQL editor.

| Migration | Adds |
| --- | --- |
| `0001_projects.sql` | Projects table and row-level security |
| `0002_delete_account.sql` | Self-service account deletion |
| `0003_live_canvas.sql` | `live_canvas` table for `get_open_diagram` |
| `0004_admin.sql`, `0005_admin_flow.sql` | Admin panel (`/yonetim`); admins are listed in `public.admins` |
| `0006_flow_sharing.sql` | Share links and email invites (`/s/<token>`) |

In Auth → URL Configuration set the Site URL to your app's address (`https://flowdraft.tech`).

## AI tools (MCP)

Users add **`https://<your-domain>/mcp`** to ChatGPT, Claude, Claude Code, Codex, Cursor or VS Code. The assistant can list, read, create, update and delete the diagrams in their account. Opened in a browser, the same address shows a public setup guide.

- Authentication uses **Supabase Auth's OAuth 2.1 server**. The AI tool registers itself (dynamic client registration) and the user signs in and approves it on `/oauth/consent`.
- `/mcp` is only a protected resource: it validates the token and runs every query with the user's own token, so row-level security applies.
- A link the assistant returns (`https://flowdraft.tech/?p=<id>`) opens that diagram.

### Pictures in the chat

The assistant can draw and revise a diagram without the user ever opening flowdraft: it calls `create_diagram` / `update_diagram`, the result comes back as a PNG, the user writes a correction, and the assistant updates the same diagram.

- The PNG is rendered on the server (`server/render.ts`): diagram JSON → SVG (the editor's light theme) → PNG, with `@resvg/resvg-js`, `opentype.js` for text measurement and the Geist fonts (OFL, `server/fonts/`).
- `create_diagram`, `update_diagram`, `get_diagram` and `get_open_diagram` include the PNG, so the model always sees it. Clients with MCP Apps support (Claude, ChatGPT) also show it in the chat (`server/view.ts`, `ui://flowdraft/diagram.html`).
- `get_open_diagram` returns the canvas the user has open right now, unsaved changes included. The app writes it to `live_canvas` only while the user is signed in, an AI tool is connected (an OAuth grant exists) and "Share the open flow with connected AI tools" is switched on (Menu → Connect AI tools).
- When an assistant changes the open diagram, the editor reloads it when the user returns to the tab, or immediately if Supabase Realtime is available (`src/lib/live.ts`; on self-hosted Supabase, the `/realtime/v1` route in Kong).

### Setup on self-hosted Supabase

1. **Auth (GoTrue) environment** with a recent `supabase/gotrue` image (for example v2.196.0):

   ```env
   GOTRUE_OAUTH_SERVER_ENABLED=true
   GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=true
   GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH=/oauth/consent
   # OAuth endpoints are derived from the issuer (issuer + /oauth/authorize), so it must end in /auth/v1:
   GOTRUE_JWT_ISSUER=https://api.flowdraft.tech/auth/v1
   GOTRUE_SITE_URL=https://flowdraft.tech
   ```

2. **Kong** (`volumes/api/kong.yml`, under `services:`). AI clients send no `apikey`, so these two routes must be open:

   ```yaml
   - name: auth-v1-open-oauth
     url: http://auth:9999/oauth/
     routes:
       - name: auth-v1-open-oauth
         strip_path: true
         paths:
           - /auth/v1/oauth/
     plugins:
       - name: cors
   - name: well-known-oauth-auth-v1
     url: http://auth:9999/.well-known/oauth-authorization-server
     routes:
       - name: well-known-oauth-auth-v1
         strip_path: true
         paths:
           - /.well-known/oauth-authorization-server/auth/v1
     plugins:
       - name: cors
   ```

3. **The app** needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`; the MCP server uses them too.

4. **Check:**

   ```bash
   curl https://api.flowdraft.tech/.well-known/oauth-authorization-server/auth/v1   # must include registration_endpoint
   curl https://flowdraft.tech/.well-known/oauth-protected-resource/mcp
   ```

On Supabase Cloud, replace steps 1–2 with: Dashboard → Authentication → OAuth Server → enable, Authorization Path `/oauth/consent`, dynamic client registration on.

## Repository layout

- `src/flow/` — node and edge types, components, parts palette, templates, layout for drawing from a description
- `src/store/` — editor (undo/redo), session, settings, UI state
- `src/lib/` — Supabase, project CRUD, saving, export, document validation, sharing, live canvas (`live.ts`)
- `src/admin/` — admin panel (`/yonetim`): members, their flows and a read-only flow preview
- `src/profile/` — profile page (`/profil`): account details, sign-out, account deletion
- `src/share/` — shared flow page (`/s/<token>`); rules in `0006_flow_sharing.sql`, client in `src/lib/share.ts`
- `src/oauth/` — OAuth consent page for AI tools (`/oauth/consent`)
- `src/guide/` — MCP setup guide (`/mcp` in a browser)
- `src/promo/` — product tour (`/tanitim`)
- `server/mcp.ts` — MCP server (`/mcp`), compiled into `dist-server/`
- `server/render.ts` — renders a diagram to PNG; `server/view.ts` — MCP Apps view that shows it in the chat
- `server.js` — Express: static files, SPA fallback, `/config.js`, `/mcp`, security headers
- `seo.js`, `seo/` — server-rendered home page content and guides in English and Turkish
- `ios/` — iPhone, iPad and Mac app (XcodeGen project in `ios/project.yml`; `ios/scripts/build-web.sh` bundles the web build)
