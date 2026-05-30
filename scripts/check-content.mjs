// Verifies that the Keystatic reader can parse every seeded content file.
// Run with: npm run content:check
//
// This is the source of truth for "are my files in the format Keystatic
// expects?" — the reader and the /keystatic editor share the same config, so
// if the reader reads a file, the editor will too.
import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../keystatic.config.ts";

const reader = createReader(process.cwd(), keystaticConfig);

const services = await reader.collections.services.all();
const testimonials = await reader.collections.testimonials.all();
const areas = await reader.collections.serviceAreas.all();
const posts = await reader.collections.posts.all();
const settings = await reader.singletons.siteSettings.read();

console.log("Services:     ", services.map((s) => s.slug).join(", "));
console.log("Testimonials: ", testimonials.map((t) => t.slug).join(", "));
console.log("Service areas:", areas.map((a) => a.slug).join(", "));
console.log("Posts:        ", posts.map((p) => p.slug).join(", "));
console.log("Site settings:", settings ? `OK (${settings.businessName}, ${settings.phone})` : "MISSING");

const counts = {
  services: services.length,
  testimonials: testimonials.length,
  areas: areas.length,
  posts: posts.length,
  settings: settings ? 1 : 0,
};
const missing = Object.entries(counts).filter(([, n]) => n === 0);
if (missing.length) {
  console.error("\n✗ Empty collections:", missing.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("\n✓ Reader parsed all collections + the singleton.");
