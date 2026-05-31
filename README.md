# BayFlow Plumbing — Keystatic CMS test harness

A small Astro + React + Tailwind plumbing site wired to **[Keystatic](https://keystatic.com)**,
a git-based CMS. A non-technical client edits content through a UI; every save
becomes a git commit.

**Status: GitHub mode, deployed to Cloudflare.**
- **Live site:** https://plumbing-cms-demo.brucejohnson1479.workers.dev
- **Editor:** https://plumbing-cms-demo.brucejohnson1479.workers.dev/keystatic
- **Repo (content source of truth):** https://github.com/goosehammer3456/plumbing-cms-demo
- The public site is live now. The hosted editor needs a one-time **GitHub App**
  setup before sign-in/saving works — see [Finishing the editor setup](#finishing-the-editor-setup).
- `dev` still uses the local filesystem reader, so `npm run dev` works without any
  GitHub App and your local edits show instantly.

## Stack

| Piece | Version | Notes |
|---|---|---|
| Astro | ^6.4 | `output: "static"` — pages prerender; admin routes run on-demand |
| Adapter | `@astrojs/cloudflare` ^13 | Deploys as a Cloudflare **Worker** (static assets + on-demand admin). `prerenderEnvironment: "node"` so the build-time reader can use the filesystem |
| React | ^19 | Powers the Keystatic admin UI (aliased to `react-dom/server.edge` in the build for workerd) |
| Markdoc | `@astrojs/markdoc` | Long-form body fields |
| Keystatic | `@keystatic/core` ^0.5 + `@keystatic/astro` ^5 | `storage.kind: "github"` |
| Tailwind | ^3.4 | via PostCSS |

## How to run it

```bash
npm install
npm run dev
```

| URL | What |
|---|---|
| **http://127.0.0.1:4321/** | The rendered plumbing site |
| **http://127.0.0.1:4321/keystatic** | 👈 **The content editor** |

Other commands:

```bash
npm run build          # production build into dist/ (also validates all content reads)
npm run content:check  # prints every entry the Keystatic reader can parse (sanity check)
```

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
Because pages are prerendered, the reader runs **at build time in Node**, so editing
a file (via the UI or by hand) and rebuilding updates the site. In `npm run dev`
the change hot-reloads.

- The **homepage** (`src/pages/index.astro`) pulls featured **services**, **testimonials**,
  **service areas**, and the **phone number** from Site Settings.
- **Service detail** pages (`/services/[slug]`) render the markdoc body.
- **Blog** (`/blog`, `/blog/[slug]`) lists and renders posts.

## ✅ Verify the loop

**In GitHub mode each save is a git commit, not a local file write.** Once the
GitHub App (below) is set up, the editing loop is:

1. Open `/keystatic` (local or the live URL) and sign in with GitHub.
2. Edit **Services → Drain Cleaning & Unclogging** → change **Price from** → **Save**.
3. **Watch the commit land:** a new commit appears on `main` at
   https://github.com/goosehammer3456/plumbing-cms-demo/commits/main
   (or `git pull` and `git log -1` locally) — the YAML frontmatter now shows the
   new `priceFrom`.
4. **See it on the site:** with Workers Builds connected (step 3 of setup), that
   commit redeploys the Worker and the live Drain Cleaning card shows the new price.
   Without CI, run `npm run build && npx wrangler deploy -c dist/server/wrangler.json`.

> **Local-only shortcut (no GitHub App needed):** `npm run dev` reads content
> straight off your working tree, so you can hand-edit a file under
> `src/content/` (e.g. `drain-cleaning.mdoc`), save, and the dev site hot-reloads
> instantly. Run `npm run content:check` to confirm the reader parses everything.

---

## Deploying (what's already done)

Already wired and live:

- **`keystatic.config.ts`** → `storage.kind: "github"`, `repo: goosehammer3456/plumbing-cms-demo`.
- **`astro.config.mjs`** → `@astrojs/cloudflare` adapter with `prerenderEnvironment: "node"`,
  the React-19 `react-dom/server.edge` build alias, and a Keystatic dep-optimizer exclude.
- **`wrangler.jsonc`** → `nodejs_compat` + a pinned `SESSION` KV namespace.
- Deployed as a **Worker** to `plumbing-cms-demo.brucejohnson1479.workers.dev`
  via `npm run build && npx wrangler deploy -c dist/server/wrangler.json`.

The **public site is fully functional now**. The hosted *editor* still needs the
GitHub App below before sign-in/saving works.

## Finishing the editor setup

### 1. Create the Keystatic GitHub App (one-time, browser)

Keystatic authenticates editors and writes commits through a **GitHub App** (not a
personal token). Easiest path is the guided creator:

1. `npm run dev`, open **http://127.0.0.1:4321/keystatic**.
2. It shows a **"Create GitHub App"** screen — click through. GitHub creates the App
   via manifest (permissions: *Contents: read/write*, *Pull requests: read/write*,
   *Metadata: read*) and **installs it on the `plumbing-cms-demo` repo**.
3. Keystatic writes four values into a local `.env` (never committed — see `.env.example`):
   ```
   KEYSTATIC_GITHUB_CLIENT_ID=...
   KEYSTATIC_GITHUB_CLIENT_SECRET=...
   KEYSTATIC_SECRET=...                 # random hex that signs the auth session
   PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=... # public — baked into the build
   ```
4. You can now edit at the **local** `/keystatic` and watch each save land as a
   commit in the GitHub repo.

### 2. Give production the same values

- **Runtime secrets** (the Worker's `/api/keystatic` OAuth handler needs these):
  ```bash
  printf "%s" "$ID"     | npx wrangler secret put KEYSTATIC_GITHUB_CLIENT_ID
  printf "%s" "$SECRET" | npx wrangler secret put KEYSTATIC_GITHUB_CLIENT_SECRET
  printf "%s" "$KS"     | npx wrangler secret put KEYSTATIC_SECRET
  ```
  (Use `printf "%s"`, not a raw pipe, so no trailing newline breaks the value.)
- **Build-time public var:** `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` is baked into the
  client bundle at build. For CLI deploys it's read from your local `.env`. For
  CI builds (step 3), set it as a build env var there too.

### 3. Auto-deploy on edit (so client saves go live)

Each Keystatic save is a commit to `main`. To turn that commit into a live update,
connect the repo to **Cloudflare → Workers & Pages → Workers Builds → Connect a repo**
(`goosehammer3456/plumbing-cms-demo`), with:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build env var: `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`

Until then, edits still commit to GitHub — just run `npm run build && npx wrangler
deploy -c dist/server/wrangler.json` to push them live manually.

### 4. Add the production OAuth callback to the GitHub App

In the App's settings add (alongside the localhost entry the guided flow created):

```
https://plumbing-cms-demo.brucejohnson1479.workers.dev/api/keystatic/github/oauth/callback
```

A callback-URL mismatch is the #1 cause of "sign-in does nothing."

### What renders where

| Route | Rendering | Notes |
|---|---|---|
| `/`, `/services/*`, `/blog/*` | **Prerendered to static HTML at build** | Built in **Node** (`prerenderEnvironment: "node"`), so the Keystatic reader reads the committed content files via `node:fs`. |
| `/keystatic` | On-demand → ships a client-side React app | Runs on the deployed Worker (workerd). |
| `/api/keystatic/[...]` | On-demand | Runs on the Worker; in GitHub mode it calls the **GitHub API over `fetch`** — workerd-safe. |

### Gotchas hit building this (so you don't re-hit them)

- **Adapter v13 prerenders in workerd by default**, which has no real filesystem
  (`fs.readdir` unimplemented) — Keystatic's local reader can't run there. Fix:
  `cloudflare({ prerenderEnvironment: "node" })` so static pages prerender in Node.
- **`virtual:keystatic-config` "could not resolve"** during build → the adapter's
  workerd dep-optimizer can't see Keystatic's virtual module. Fix:
  `vite.optimizeDeps.exclude: ["@keystatic/astro", "@keystatic/core"]`.
- **React 19 `MessageChannel`/`require` errors** → alias `react-dom/server` →
  `react-dom/server.edge` **in the build only** (it breaks `astro dev`, so it's
  gated behind an `isDev` check in `astro.config.mjs`).
- **`pages_build_output_dir` in `wrangler.jsonc` breaks the build** ("ASSETS is
  reserved in Pages projects"). The v13 adapter deploys a **Worker**, not a Pages
  project — leave that key out. The free URL is `*.workers.dev`, not `*.pages.dev`.
- **`SESSION` KV namespace:** Astro 6 enables a KV-backed session feature; the
  namespace is pinned in `wrangler.jsonc` so CI reuses it.
- **The GitHub reader is a dead end here:** `createGitHubReader` would avoid the fs
  problem but its `fetch` from workerd has no `User-Agent`, which GitHub rejects
  with `403 (User-Agent required)`. Node prerendering with the local reader is the
  working path.
- **`@keystatic/astro` 5.1.0 isn't Astro-6-ready for env:** it reads its GitHub
  secrets from `Astro.locals.runtime.env`, which Astro 6 removed, so the deployed
  `/api/keystatic` 500s. Fixed with a `patch-package` patch
  (`patches/@keystatic+astro+5.1.0.patch`, reapplied via the `postinstall` script)
  that falls back to `process.env` — which `nodejs_compat` populates from the
  Worker's secrets. Remove the patch if/when Keystatic ships an Astro-6 fix.
