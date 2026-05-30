/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,mdoc}"],
  theme: {
    extend: {
      fontFamily: {
        // Fontshare stack (loaded via <link> in Layout.astro). No Inter/system-ui.
        display: ['"Clash Display"', "sans-serif"],
        sans: ['"Satoshi"', "sans-serif"],
      },
      colors: {
        // Trade-services palette: deep navy + a clean "service blue" + copper accent.
        navy: {
          DEFAULT: "#0d1b2a",
          800: "#10243a",
          700: "#16314f",
        },
        brand: {
          DEFAULT: "#1d6fb8",
          600: "#1862a3",
          500: "#1d6fb8",
          400: "#3d8dd4",
        },
        copper: "#c2703d",
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
