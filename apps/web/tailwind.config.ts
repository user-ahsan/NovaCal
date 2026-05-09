import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          elevated: "var(--surface-elevated)",
          hover: "var(--surface-hover)",
        },
        accent: {
          DEFAULT: "var(--primary-accent)",
          muted: "var(--primary-accent-muted)",
          glow: "var(--primary-accent-glow)",
        },
        border: {
          subtle: "var(--border-subtle)",
          elevated: "var(--border-elevated)",
        },
        ghost: {
          hover: "var(--ghost-hover)",
          active: "var(--ghost-active)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        destructive: "var(--destructive)",
        success: "var(--success)",
        warning: "var(--warning)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        base: "var(--radius-base)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        elevated: "var(--shadow-elevated)",
        modal: "var(--shadow-modal)",
      },
    },
  },
  plugins: [],
};

export default config;
