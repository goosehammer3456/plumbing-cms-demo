import { config, fields, collection, singleton } from "@keystatic/core";

/**
 * Keystatic CMS schema for the plumbing demo site.
 *
 * storage.kind === "local" means every edit made in the /keystatic admin UI is
 * written straight to files in this repo (and, in a normal workflow, committed
 * with git). No database, no cloud. To host the editor for a client we later
 * switch this to { kind: "github", repo: "owner/name" } — see the README.
 *
 * On-disk layout (path has no trailing slash, so each entry is a single file):
 *   - services:      src/content/services/<slug>.mdoc   (frontmatter + body)
 *   - testimonials:  src/content/testimonials/<slug>.yaml
 *   - serviceAreas:  src/content/service-areas/<slug>.yaml
 *   - posts:         src/content/posts/<slug>.mdoc
 *   - siteSettings:  src/content/settings/site.yaml      (singleton)
 */

const ICON_OPTIONS = [
  { label: "Wrench (general)", value: "wrench" },
  { label: "Droplet (leaks)", value: "droplet" },
  { label: "Flame (water heater)", value: "flame" },
  { label: "Pipe / drain", value: "pipe" },
  { label: "Alert (emergency)", value: "alert" },
  { label: "Sparkle (install)", value: "sparkle" },
] as const;

export default config({
  // GitHub mode: the admin UI authenticates editors via a GitHub App and writes
  // every save as a commit to this repo, which retriggers the Cloudflare Pages
  // build. (Was `kind: "local"` during local testing — see README.) The
  // build-time reader in src/lib/content.ts still reads the committed files
  // off disk in CI; only the WRITE path goes through GitHub.
  storage: {
    kind: "github",
    repo: { owner: "goosehammer3456", name: "plumbing-cms-demo" },
  },
  ui: {
    brand: { name: "BayFlow Plumbing CMS" },
    navigation: {
      Content: ["services", "testimonials", "serviceAreas", "posts"],
      Configuration: ["siteSettings"],
    },
  },
  collections: {
    services: collection({
      label: "Services",
      slugField: "title",
      path: "src/content/services/*",
      format: { contentField: "body" },
      // Sort the collection list in the admin UI by display name.
      columns: ["title", "priceFrom"],
      entryLayout: "content",
      schema: {
        title: fields.slug({
          name: {
            label: "Service name",
            description: "Shown as the card title. The URL slug is derived from this.",
            validation: { isRequired: true },
          },
        }),
        shortDescription: fields.text({
          label: "Short description",
          description: "One or two sentences for the homepage card.",
          multiline: true,
          validation: { isRequired: true, length: { max: 220 } },
        }),
        icon: fields.select({
          label: "Icon",
          description: "Drawn as an inline SVG on the card.",
          options: ICON_OPTIONS as unknown as { label: string; value: string }[],
          defaultValue: "wrench",
        }),
        image: fields.image({
          label: "Photo (optional)",
          description: "Optional hero photo for the service detail page.",
          // Stored under public/ so the uploaded file is served directly at the
          // publicPath URL with no import/build step.
          directory: "public/images/services",
          publicPath: "/images/services/",
        }),
        priceFrom: fields.text({
          label: "Price from (USD)",
          description: 'Just the number, e.g. "149". Leave blank to hide pricing.',
        }),
        featured: fields.checkbox({
          label: "Feature on homepage",
          defaultValue: true,
        }),
        order: fields.integer({
          label: "Sort order",
          description: "Lower numbers appear first.",
          defaultValue: 0,
        }),
        body: fields.markdoc({
          label: "Full description",
          description: "Long-form copy shown on the service detail page.",
        }),
      },
    }),

    testimonials: collection({
      label: "Testimonials",
      slugField: "customerName",
      path: "src/content/testimonials/*",
      columns: ["customerName", "location", "rating"],
      schema: {
        customerName: fields.slug({
          name: {
            label: "Customer name",
            validation: { isRequired: true },
          },
        }),
        location: fields.text({
          label: "Location",
          description: 'e.g. "San Mateo, CA"',
        }),
        rating: fields.integer({
          label: "Rating",
          description: "1 to 5 stars.",
          defaultValue: 5,
          validation: { isRequired: true, min: 1, max: 5 },
        }),
        quote: fields.text({
          label: "Quote",
          multiline: true,
          validation: { isRequired: true, length: { max: 500 } },
        }),
      },
    }),

    serviceAreas: collection({
      label: "Service areas",
      slugField: "name",
      path: "src/content/service-areas/*",
      columns: ["name", "county"],
      schema: {
        name: fields.slug({
          name: {
            label: "City / neighborhood",
            validation: { isRequired: true },
          },
        }),
        county: fields.text({
          label: "County / region",
          description: 'e.g. "San Mateo County"',
        }),
      },
    }),

    posts: collection({
      label: "Blog posts",
      slugField: "title",
      path: "src/content/posts/*",
      format: { contentField: "content" },
      columns: ["title", "publishDate"],
      entryLayout: "content",
      schema: {
        title: fields.slug({
          name: {
            label: "Title",
            validation: { isRequired: true },
          },
        }),
        publishDate: fields.date({
          label: "Publish date",
          defaultValue: { kind: "today" },
          validation: { isRequired: true },
        }),
        coverImage: fields.image({
          label: "Cover image",
          directory: "public/images/posts",
          publicPath: "/images/posts/",
        }),
        excerpt: fields.text({
          label: "Excerpt",
          multiline: true,
          validation: { length: { max: 280 } },
        }),
        content: fields.markdoc({
          label: "Body",
        }),
      },
    }),
  },

  singletons: {
    siteSettings: singleton({
      label: "Site Settings",
      path: "src/content/settings/site",
      schema: {
        businessName: fields.text({
          label: "Business name",
          validation: { isRequired: true },
        }),
        phone: fields.text({
          label: "Phone number",
          description: "Displayed and used for the click-to-call link.",
          validation: { isRequired: true },
        }),
        email: fields.text({
          label: "Email",
          validation: { isRequired: true },
        }),
        hours: fields.text({
          label: "Business hours",
          multiline: true,
          description: "One line per day, or a short summary.",
        }),
        emergencyCallout: fields.checkbox({
          label: "Show 24/7 emergency callout banner",
          defaultValue: true,
        }),
      },
    }),
  },
});
