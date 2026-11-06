import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        subtle: "var(--text-muted)",
        neutral: "rgb(var(--neutral-rgb) / <alpha-value>)",
        muted: "rgb(var(--ink-rgb) / <alpha-value>)",
        accent: "#F76F5C",
        accentSoft: "rgb(247 111 92 / 0.14)",
        line: "var(--line-color)"
      },
      fontFamily: {
        sans: ["\"Ubuntu Sans\"", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 24px 64px rgba(17, 17, 17, 0.12)"
      },
      maxWidth: {
        reading: "72ch"
      }
    }
  },
  plugins: [typography]
};
