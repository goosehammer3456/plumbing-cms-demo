# BayFlow Plumbing — Keystatic Cloud client-site template

A small Astro + React + Tailwind business site wired to **[Keystatic](https://keystatic.com)**
in **Cloud mode**. A non-technical client edits content through a simple web UI —
**signing in by email, with no GitHub account** — and every save becomes a git
commit that auto-deploys. This is the reference template for the productized
"we host it, the client edits it" sites.

**Status: Keystatic Cloud, deployed to Cloudflare.**
- **Live site:** https://plumbing-cms-demo.brucejohnson1479.workers.dev
- **Editor:** https://plumbing-cms-demo.brucejohnson1479.workers.dev/keystatic
- **Repo (content lives here):** https://github.com/goosehammer3456/plumbing-cms-demo
- **Keystatic Cloud project:** `bay-pulse-marketing/plumbing-cms-demo`

How it fits together: editor edits at `/keystatic` → **Keystatic Cloud** commits to
the repo (as `keystatic-cloud[bot]`) → a **GitHub Action** rebuilds and deploys the
Cloudflare Worker → change is live in ~1–2 min. No GitHub accounts, no custom OAuth
app, no secrets in the editor path.

## Stack

| Piece | Version | Notes |
|---|---|---|
| Astro | ^6.4 | `output: "static"` — pages prerender; the admin routes run on-demand |
| Adapter | `@astrojs/cloudflare` ^13 (build) / `@astrojs/node` ^10 (dev) | Conditional by command — see gotchas. Deploys as a Cloudflare **Worker** (static assets + on-demand admin) |
| React | ^19 | Powers the Keystatic admin UI |
| Markdoc | `@astrojs/markdoc` | Long-form body fields |
| Keystatic | `@keystatic/core` ^0.5 + `@keystatic/astro` ^5 | `storage.kind: "cloud"` + `cloud.project` |
| Tailwind | ^3.4 | via PostCSS |

## Run it locally

```bash
npm install
npm run dev
```

| URL | What |
|---|---|
| **http://127.0.0.1:4321/** | The rendered site |
| **http://127.0.0.1:4321/keystatic** | The content editor (Keystatic Cloud sign-in) |

Other commands:

```bash
npm run build          # production build into dist/
npm run content:check  # prints every entry the Keystatic reader can parse (sanity check)
```

> Local editing at `/keystatic` also signs in through Keystatic Cloud and commits to
> the repo — so `http://localhost:4321` must be listed as a Primary URL on the Cloud
> project (it is). To edit purely offline, hand-edit files under `src/content/` and the
> dev site hot-reloads.

## Content model

Defined in [`keystatic.config.ts`](./keystatic.config.ts). Files live under `src/content/`.

| Collection / singleton | On disk | Fields |
|---|---|---|
| **Services** | `src/content/services/<slug>.mdoc` | name, short description, icon, photo, price-from, featured toggle, sort order, markdoc body |
| **Testimonials** | `src/content/testimonials/<slug>.yaml` | customer name, location, rating (1–5), quote |
| **Service areas** | `src/content/service-areas/<slug>.yaml` | city/neighborhood, county |
| **Blog posts** | `src/content/posts/<slug>.mdoc` | title, publish date, cover image, excerpt, markdoc body |
| **Site Settings** (singleton) | `src/content/settings/site.yaml` | business name, phone, email, hours, 24/7 emergency toggle |

### How pages read content
Astro pages read through a single Keystatic reader in [`src/lib/content.ts`](./src/lib/content.ts).
Pages are prerendered, so the reader runs **at build time in Node** off the committed
content files. When an editor saves (→ commit → CI build), the new content is read on
the next build. The homepage pulls featured **services**, **testimonials**, **service
areas**, and the **phone** from Site Settings; `/services/[slug]` and `/blog/*` render
markdoc bodies.

## The editing loop (verify it)
1. Open `/keystatic` (live or local) → **Log in with Keystatic Cloud** (email).
2. Edit something (e.g. **Service areas → add a city**) → **Save**.
3. The save lands as a commit on `main` (author `keystatic-cloud[bot]`).
4. The **GitHub Action** rebuilds + `wrangler deploy`s → the change is live in ~1–2 min.

---

## Clone this for a new client

Per-client, ~15 min. Everything stays under **your** Cloudflare + GitHub; the client
only gets the email editor.

1. **New repo** — copy this project into a fresh repo (e.g. `goosehammer3456/<client>-site`).
   Customize content under `src/content/` + the design.
2. **Cloudflare Worker** — `npm run build && npx wrangler deploy -c dist/server/wrangler.json`
   (set a unique `name` in `wrangler.jsonc`). Note the `*.workers.dev` URL (or map a domain).
3. **Keystatic Cloud project** — at [keystatic.cloud](https://keystatic.cloud):
   - **Create a new team per client** (one team each — keeps projects private and stays on
     the free tier: up to 3 users/team is free; only a team with 4+ editors hits Pro).
   - Create a project in it, **connect the client's GitHub repo**.
   - Add the deployed Worker URL **and** `http://localhost:4321` as **Primary URLs**
     (auth allowed-origins).
   - Paste the project's `cloud: { project: "<team>/<project>" }` snippet into
     `keystatic.config.ts` (already set to `bay-pulse-marketing/plumbing-cms-demo` here).
4. **Auto-deploy** — add one repo secret `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile →
   API Tokens → "Edit Cloudflare Workers"). The included `.github/workflows/deploy.yml`
   builds + deploys on every push to `main` (incl. the client's content commits). Set the
   account id in the workflow if it differs.
5. **Invite the client** to the Keystatic Cloud team **by email** as a Contributor. Done —
   they edit at `/keystatic`, no GitHub account needed.

## Deploy

The GitHub Action (`.github/workflows/deploy.yml`) runs `npm run build` then
`wrangler deploy` on every push to `main`. The only required secret is
`CLOUDFLARE_API_TOKEN`. To deploy by hand:
`npm run build && npx wrangler deploy -c dist/server/wrangler.json`.

### What renders where
| Route | Rendering | Notes |
|---|---|---|
| `/`, `/services/*`, `/blog/*` | Prerendered to static HTML at build | Built in **Node** (`prerenderEnvironment: "node"`) so the reader can use `node:fs`. |
| `/keystatic` | On-demand → client-side React app | Runs on the Worker; auth goes through Keystatic Cloud (email). |
| `/api/keystatic/[...]` | On-demand | Runs on the Worker; in Cloud mode it talks to **Keystatic Cloud**, which manages the GitHub commit. |

### Gotchas (so you don't re-hit them)
- **Two adapters by command:** `@astrojs/node` for `dev`, `@astrojs/cloudflare` for `build`
  (`const isDev = process.argv.includes("dev")` in `astro.config.mjs`). The Cloudflare
  adapter runs dev SSR in workerd, which breaks on Keystatic's CommonJS deps
  (`module is not defined`); Node-for-dev avoids it.
- **Adapter v13 prerenders in workerd by default** (no `fs.readdir`). Fix:
  `cloudflare({ prerenderEnvironment: "node" })` so static pages prerender in Node.
- **`virtual:keystatic-config` could-not-resolve** → exclude Keystatic from the **ssr**
  optimizer only: `vite.environments.ssr.optimizeDeps.exclude` (a top-level exclude breaks
  the client bundle's lodash → blank `/keystatic`).
- **React 19 on workerd** → alias `react-dom/server` → `react-dom/server.edge` **in the
  build only** (it throws `require is not defined` in dev — gated behind `isDev`).
- **No `pages_build_output_dir` in `wrangler.jsonc`** ("ASSETS is reserved in Pages
  projects"). v13 deploys a **Worker**, not Pages — free URL is `*.workers.dev`.
- **`SESSION` KV namespace** is pinned in `wrangler.jsonc` so CI reuses one namespace.
- **`@keystatic/astro` 5.1.0 + Astro 6 env:** it reads env via `Astro.locals.runtime.env`,
  removed in Astro 6, so `/api/keystatic` 500s. Fixed with a `patch-package` patch
  (`patches/@keystatic+astro+5.1.0.patch`, reapplied via `postinstall`) that falls back to
  `process.env`. **Keep this patch.** Remove only when Keystatic ships an Astro-6 fix.

### Pricing note
Keystatic Cloud free = up to **3 users per team**; unlimited teams/projects. **One team
per client** keeps each client private and free (client + you = 2 seats). A client with
4+ editors upgrades only *that* team to Pro (~$10/mo + ~$5/seat). Keep images in the repo
(`public/`) to avoid the Cloud Images paid feature.
