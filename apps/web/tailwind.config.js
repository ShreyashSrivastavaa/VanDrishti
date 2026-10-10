/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
        },
        rule: "var(--rule)",
        forest: {
          900: "var(--forest-900)",
          700: "var(--forest-700)",
        },
        olive: {
          600: "var(--olive-600)",
          200: "var(--olive-200)",
        },
        stone: {
          500: "var(--stone-500)",
        },
        loss: {
          600: "var(--loss-600)",
          200: "var(--loss-200)",
        },
        warn: {
          500: "var(--warn-500)",
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
      },
    },
  },
  plugins: [],
}
