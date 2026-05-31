// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import keystatic from "@keystatic/astro";
import cloudflare from "@astrojs/cloudflare";

// astro dev → 'dev' is in argv; astro build → 'build'. We need the React
// `.edge` alias ONLY for the production (workerd) build: in dev, Vite's Node
// module runner can't load react-dom/server.edge (it uses `require`), so
// aliasing it there throws `require is not defined`.
const isDev = process.argv.includes("dev");

// https://astro.build/config
//
// Output is the Astro 6 default ("static"): every page in src/pages is
// prerendered to HTML at build time. The Keystatic integration injects two
// on-demand (server-rendered) routes — the admin UI at /keystatic and its API
// at /api/keystatic/[...] — so we MUST configure an adapter for those routes to
// run. (Astro 5+ removed the old `output: 'hybrid'`; static + adapter is the
// modern equivalent.)
//
// GITHUB-MODE NOTE — why the Cloudflare adapter:
//   Deployed as a Cloudflare Worker (with static assets) with Keystatic in
//   `storage.kind: "github"`. The split that makes this work:
//     • Prerendered pages (/, /services/*, /blog/*) render at BUILD time in
//       Node (see prerenderEnvironment below), where the local Keystatic reader
//       reads the content files committed in the repo via node:fs.
//     • The on-demand admin routes (/keystatic, /api/keystatic/[...]) run on the
//       deployed Worker (workerd). In GitHub mode they talk to the GitHub API
//       over `fetch` — no filesystem — so they're workerd-safe.
//   The `nodejs_compat` flag (see wrangler.jsonc) covers Node built-ins the
//   bundled admin code references at runtime.
export default defineConfig({
  output: "static",
  adapter: cloudflare({
    // Astro 6 + adapter v13 prerenders inside workerd by default, which has no
    // real filesystem (`fs.readdir` is unimplemented) — so Keystatic's local
    // reader can't list content there. `'node'` restores Node-based prerendering
    // for the static pages (reader reads the committed files fine) while the
    // on-demand admin routes (/keystatic, /api/keystatic) still run in workerd.
    prerenderEnvironment: "node",
  }),
  integrations: [react(), markdoc(), keystatic()],
  vite: {
    resolve: {
      // React 19 on workerd: react-dom/server uses MessageChannel, which isn't
      // in the Workers runtime. The `.edge` build avoids it. (Astro + Cloudflare
      // + React 19 known issue — astro#12824 / react#436.) Build only — see
      // `isDev` above for why it must NOT apply during `astro dev`.
      alias: isDev ? {} : { "react-dom/server": "react-dom/server.edge" },
    },
    // Per-ENVIRONMENT optimizeDeps — these two environments have opposite needs:
    //   • ssr (the deployed worker route that serves /api/keystatic) imports
    //     Keystatic's `virtual:keystatic-config`. The workerd dep-optimizer can't
    //     resolve that virtual module, so Keystatic must be EXCLUDED here — both
    //     in dev and build, or you get "Could not resolve virtual:keystatic-config".
    //   • client (the browser admin bundle) must NOT exclude Keystatic, or Vite
    //     skips pre-bundling its CommonJS deps (e.g. lodash/debounce) and the app
    //     throws "does not provide an export named 'default'" → blank /keystatic.
    // Scoping to `environments.ssr` keeps the client default. (A top-level
    // optimizeDeps.exclude hits both environments and breaks the client.)
    environments: {
      ssr: {
        optimizeDeps: { exclude: ["@keystatic/astro", "@keystatic/core"] },
      },
    },
  },
});
