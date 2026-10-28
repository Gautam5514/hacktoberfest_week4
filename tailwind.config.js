/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#090B0A",
        panel: "#151A17",
        panelElevated: "#1C2420",
        border: "#28352D",
        borderLight: "#3B4E42",
        life: "#A4F4B8",
        lifeGlow: "rgba(164, 244, 184, 0.15)",
        textMain: "#E8EDE9",
        textMuted: "#88998E",
        pumpkin: "#FF9F43",
        crimson: "#FF5E57",
        ghostPurple: "#A29BFE",
      },
      fontFamily: {
        sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
      boxShadow: {
        ghost: "0 0 20px -5px rgba(164, 244, 184, 0.3)",
        tombstone: "0 10px 30px -10px rgba(0, 0, 0, 0.7)",
      },
      animation: {
        pulseGhost: "pulseGhost 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scanline: "scanline 8s linear infinite",
      },
      keyframes: {
        pulseGhost: {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 8px rgba(164,244,184,0.4))" },
          "50%": { opacity: "0.65", filter: "drop-shadow(0 0 2px rgba(164,244,184,0.1))" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
      },
    },
  },
  plugins: [],
};
