// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import keystatic from "@keystatic/astro";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

// `astro dev` puts 'dev' in argv; `astro build` puts 'build'.
const isDev = process.argv.includes("dev");

// https://astro.build/config
//
// Output is the Astro 6 default ("static"): pages prerender to HTML at build
// time. The Keystatic integration injects two on-demand routes — the admin UI
// at /keystatic and its API at /api/keystatic/[...] — so an adapter is required
// to run them.
//
// WHY TWO ADAPTERS (this is the important bit):
//   • dev  → @astrojs/node. `astro dev` then runs SSR in real Node, exactly like
//     the original local mode. Keystatic's reader, its CommonJS deps (lodash,
//     superstruct), the admin UI, and the GitHub-App setup flow at
//     /keystatic/setup all "just work." The Cloudflare adapter runs dev SSR
//     inside workerd, which chokes on those CJS deps ("module is not defined",
//     "does not provide an export named 'default'") — so we keep it out of dev.
//   • build → @astrojs/cloudflare. Produces the Worker (static assets +
//     on-demand admin) we deploy. `prerenderEnvironment: "node"` so the static
//     pages prerender in Node (the Keystatic reader can use node:fs); the admin
//     routes still run in workerd at runtime (GitHub API over fetch).
//
// All the workerd-specific Vite workarounds below are therefore BUILD-ONLY.
export default defineConfig({
  output: "static",
  adapter: isDev
    ? node({ mode: "standalone" })
    : cloudflare({ prerenderEnvironment: "node" }),
  integrations: [react(), markdoc(), keystatic()],
  vite: isDev
    ? {}
    : {
        resolve: {
          // React 19 on workerd: react-dom/server uses MessageChannel, absent in
          // the Workers runtime; the `.edge` build avoids it (astro#12824 /
          // react#436). Build-only — it throws `require is not defined` in dev.
          alias: { "react-dom/server": "react-dom/server.edge" },
        },
        // The deployed worker (ssr env) imports Keystatic's
        // `virtual:keystatic-config`, which the workerd dep-optimizer can't
        // resolve — exclude Keystatic there. Scoped to `environments.ssr` so the
        // client admin bundle still pre-bundles Keystatic's CJS deps.
        environments: {
          ssr: {
            optimizeDeps: { exclude: ["@keystatic/astro", "@keystatic/core"] },
          },
        },
      },
});
