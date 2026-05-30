# BayFlow Plumbing — Keystatic CMS test harness

A small Astro + React + Tailwind plumbing site wired to **[Keystatic](https://keystatic.com)**,
a git-based CMS. A non-technical client edits content through a UI; every save
writes to plain files in this repo. **Currently in LOCAL mode** (edits write to
local files for you to test). See [Switching to GitHub mode](#switching-to-github-mode-hosted-client-editing)
to host the editor for a client.

## Stack

| Piece | Version | Notes |
|---|---|---|
| Astro | ^6.4 | `output: "static"` (default) — pages prerender to HTML |
| Adapter | `@astrojs/node` | Needed so Keystatic's server routes can run. **Local mode only** — swap for `@astrojs/cloudflare` to deploy (see below) |
| React | ^19 | Powers the Keystatic admin UI |
| Markdoc | `@astrojs/markdoc` | Long-form body fields |
| Keystatic | `@keystatic/core` ^0.5 + `@keystatic/astro` ^5 | `storage.kind: "local"` |
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

## ✅ Verify the loop: edit a service and watch the file change

This is the whole point — confirm an edit in the UI becomes a file change.

1. **Start the dev server** (`npm run dev`) and open **http://127.0.0.1:4321/keystatic**.
2. In the sidebar click **Services → Drain Cleaning & Unclogging**. Change the
   **Price from** field from `149` to `159` (or edit the short description), then
   click **Save** (top right).
3. **Watch the file change.** In a terminal:
   ```bash
   git diff src/content/services/drain-cleaning.mdoc
   ```
   You'll see the YAML frontmatter updated to `priceFrom: '159'` — the edit became
   a plain-text change in the repo. (In GitHub mode this same save becomes a commit.)
4. **See it on the site.** Open **http://127.0.0.1:4321/** — the Drain Cleaning card
   now shows **From $159**. The dev server hot-reloaded from the changed file.
5. **(Optional) confirm the reader agrees:** run `npm run content:check` — it lists
   every entry and reads each one through the same config the editor uses.

To revert your test edit: `git checkout src/content/services/drain-cleaning.mdoc`.

> Try the singleton too: **Site Settings → Phone number**. Save, then reload the
> homepage — the header, hero CTA, footer, and emergency banner all update from
> that one field.

---

## Switching to GitHub mode (hosted client editing)

> **Not built yet — this is the plan for when you decide to flip it.** Local mode
> is for your own testing. GitHub mode is what lets a client edit the live site
> from a hosted `/keystatic`, with each save becoming a real git commit/PR.

### 1. Create a GitHub App (one-time)

Keystatic authenticates editors and writes commits through a **GitHub App** (not a
personal token). The fastest path is Keystatic's guided creator:

1. Temporarily set storage to GitHub (step 2) and run `npm run dev`.
2. Visit `/keystatic` — it shows a **"Create GitHub App"** button that pre-fills
   the App manifest (callback URLs, permissions: *Contents: read/write*,
   *Pull requests: read/write*, *Metadata: read*).
3. Install the App on the content repo. Keystatic writes the four secrets it
   generates into a local `.env` (App slug, client ID, client secret, and your
   `KEYSTATIC_SECRET`).

### 2. Change the config

In `keystatic.config.ts`:

```ts
storage: {
  kind: "github",
  repo: "your-org/plumbing-cms-demo",   // the repo edits commit to
},
```

Add the env vars (these go in keychain/CI secrets, **never committed** — see `.env.example`):

```
KEYSTATIC_GITHUB_CLIENT_ID=...
KEYSTATIC_GITHUB_CLIENT_SECRET=...
KEYSTATIC_SECRET=...                 # random 32-byte hex, signs the auth session
PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=... # the App's slug
```

### 3. Swap the adapter back to Cloudflare

```bash
npm install @astrojs/cloudflare
```

```js
// astro.config.mjs
import cloudflare from "@astrojs/cloudflare";
export default defineConfig({
  output: "static",
  adapter: cloudflare(),
  integrations: [react(), markdoc(), keystatic()],
});
```

### What renders where (the part that trips people up on Cloudflare Pages)

| Route | Rendering | Runtime needs |
|---|---|---|
| `/`, `/services/*`, `/blog/*` | **Prerendered to static HTML at build** | Built on Cloudflare Pages CI (a **Node** environment — `node:fs` works), so the Keystatic reader reads the committed content files fine. |
| `/keystatic` (admin UI) | **Server route → ships a client-side React app** | Runs on the deployed Worker. The UI itself is React in the browser. |
| `/api/keystatic/[...]` | **Server route (on-demand)** | Runs on the deployed Worker. In GitHub mode it calls the **GitHub API over `fetch`** — no filesystem — so it's workerd-safe. |

### Cloudflare-specific gotchas

- **The reason this harness uses the Node adapter, not Cloudflare, for local mode:**
  the `@astrojs/cloudflare` adapter prerenders pages inside a **workerd sandbox**,
  which has **no `node:fs`/`node:path`**. Keystatic's *local* reader/API need those,
  so a local-mode build under the Cloudflare adapter fails with
  `No such module "node:path"`. GitHub mode sidesteps this because the admin API
  uses `fetch`, not `fs` — but if you ever see that error, this is why.
- **`nodejs_compat`:** add the `nodejs_compat` compatibility flag (and a recent
  `compatibility_date`) in your Pages project / `wrangler` config so the Worker has
  Node-compatible APIs at runtime.
- **Build vs. runtime are different environments.** Static content is read at
  **build** (Node CI, fs available). The admin lives at **runtime** (workerd, no fs).
  Don't expect the deployed Worker to read content off disk — it goes through GitHub.
- **OAuth callback URLs must match your deployed domain.** Set the GitHub App's
  callback to `https://<your-pages-domain>/api/keystatic/github/oauth/callback`
  (and keep a `http://127.0.0.1:4321/...` entry for local). A domain mismatch is
  the most common "login does nothing" symptom.
- **Secrets via Pages environment variables**, not `.env` in the repo. Mirror them
  into the Pages project settings (and your keychain locally).
- **Branching/PR behavior:** with the App's *Pull requests* permission, non-default
  branches let editors save to a branch and open a PR instead of committing straight
  to `main` — useful for a review step before a client's edits go live.

After flipping, `/keystatic` on the deployed site asks the editor to sign in with
GitHub; saves become commits (or PRs) to the repo, which retrigger the Pages build.
