import { createReader } from "@keystatic/core/reader";
import { createGitHubReader } from "@keystatic/core/reader/github";
import Markdoc from "@markdoc/markdoc";
import keystaticConfig from "../../keystatic.config";

const REPO = "goosehammer3456/plumbing-cms-demo" as const;

/**
 * One Keystatic reader, chosen by environment.
 *
 * Pages are prerendered (output: "static"), so the reader runs at BUILD time.
 * BUT on the Cloudflare adapter the prerender happens inside workerd, which has
 * no real filesystem (`fs.readdir` is unimplemented) — so the local reader
 * can't run there. Instead:
 *
 *   • dev (`astro dev`, real Node) → `createReader` off the local filesystem,
 *     so your own edits in /keystatic show up instantly on hot reload.
 *   • build/prod → `createGitHubReader`, which fetches the committed content
 *     from the GitHub repo over `fetch` (workerd-safe). The repo is public, so
 *     no token is needed. When an editor saves in the hosted /keystatic, the
 *     commit lands here and the next Pages build reads the new content.
 *
 * `token` is optional and only read from the env for forward-compatibility (a
 * private repo, or to lift GitHub's unauthenticated rate limit on busy CI).
 */
export const reader = import.meta.env.DEV
  ? createReader(process.cwd(), keystaticConfig)
  : createGitHubReader(keystaticConfig, {
      repo: REPO,
      token: import.meta.env.GITHUB_READ_TOKEN || undefined,
    });

export type ServiceEntry = Awaited<ReturnType<typeof getServices>>[number];
export type Testimonial = Awaited<ReturnType<typeof getTestimonials>>[number];

/** All services, sorted by `order` then name. */
export async function getServices() {
  const entries = await reader.collections.services.all();
  return entries
    .map((e) => ({ slug: e.slug, ...e.entry }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Services flagged to appear on the homepage. */
export async function getFeaturedServices() {
  return (await getServices()).filter((s) => s.featured);
}

export async function getService(slug: string) {
  const entry = await reader.collections.services.read(slug);
  return entry ? { slug, ...entry } : null;
}

export async function getTestimonials() {
  const entries = await reader.collections.testimonials.all();
  return entries.map((e) => ({ slug: e.slug, ...e.entry }));
}

export async function getServiceAreas() {
  const entries = await reader.collections.serviceAreas.all();
  return entries
    .map((e) => ({ slug: e.slug, ...e.entry }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPosts() {
  const entries = await reader.collections.posts.all();
  return entries
    .map((e) => ({ slug: e.slug, ...e.entry }))
    .sort((a, b) => (a.publishDate < b.publishDate ? 1 : -1));
}

export async function getPost(slug: string) {
  const entry = await reader.collections.posts.read(slug);
  return entry ? { slug, ...entry } : null;
}

/** Site Settings singleton. Falls back to safe defaults if never edited. */
export async function getSiteSettings() {
  const settings = await reader.singletons.siteSettings.read();
  return (
    settings ?? {
      businessName: "BayFlow Plumbing",
      phone: "(650) 555-0142",
      email: "dispatch@bayflowplumbing.com",
      hours: "Mon–Fri 7am–6pm",
      emergencyCallout: true,
    }
  );
}

/**
 * Render a Keystatic markdoc field to an HTML string.
 *
 * Keystatic's reader returns markdoc content as an async thunk that resolves to
 * a Markdoc AST `node`. We transform + render it to HTML for `set:html`.
 */
export async function renderMarkdoc(
  contentFn: () => Promise<{ node: Markdoc.Node }>,
): Promise<string> {
  const { node } = await contentFn();
  const renderable = Markdoc.transform(node);
  return Markdoc.renderers.html(renderable);
}

/** Convert "(650) 555-0142" → "+16505550142" for a tel: link. */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `tel:${digits.length === 10 ? "+1" + digits : "+" + digits}`;
}
