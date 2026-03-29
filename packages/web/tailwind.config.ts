import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--fg)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-fg)' },
        border: 'var(--border)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-fg)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-fg)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-fg)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-fg)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-fg)' },
      }
    }
  },
  darkMode: 'class'
} satisfies Config
