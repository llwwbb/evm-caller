/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        fg: "var(--fg)",
        "fg-dim": "var(--fg-dim)",
        "fg-mute": "var(--fg-mute)",
        mint: "var(--mint)",
        "call-blue": "var(--blue)",
        "call-amber": "var(--amber)",
        "call-violet": "var(--violet)",
        "call-emerald": "var(--emerald)",
        "call-red": "var(--red)",
      },
      fontFamily: {
        ui: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: {
        none: "0",
        xs: "2px",
        sm: "3px",
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
}
