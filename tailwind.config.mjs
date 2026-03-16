import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FFFFFF",
        ink: "#111111",
        muted: "#111111",
        accent: "#F76F5C",
        accentSoft: "rgb(247 111 92 / 0.14)",
        line: "rgba(17, 17, 17, 0.12)"
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
