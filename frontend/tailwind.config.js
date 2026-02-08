/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#6366f1',
        't-page':    'rgb(var(--c-page)    / <alpha-value>)',
        't-surface': 'rgb(var(--c-surface) / <alpha-value>)',
        't-text':    'rgb(var(--c-text)    / <alpha-value>)',
        't-overlay': 'rgb(var(--c-overlay) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
