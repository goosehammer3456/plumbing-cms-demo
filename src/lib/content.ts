import { createReader } from "@keystatic/core/reader";
import Markdoc from "@markdoc/markdoc";
import keystaticConfig from "../../keystatic.config";

/**
 * A single Keystatic reader, created against the local filesystem.
 *
 * Every page is prerendered (output: "static"), so the reader runs at BUILD
 * time, reading the content files committed in the repo. The Cloudflare adapter
 * is configured with `prerenderEnvironment: "node"` (see astro.config.mjs) so
 * this runs in real Node where node:fs works — Cloudflare's CI checks out the
 * repo, so the files are on disk. When an editor saves in the hosted /keystatic,
 * Keystatic commits the change, which retriggers the build and the new content
 * is read here. (The deployed site is fully static; only the admin routes hit
 * the GitHub API at runtime.)
 */
export const reader = createReader(process.cwd(), keystaticConfig);

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
