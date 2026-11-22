/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        serif: ['var(--vc-font-display)', 'Georgia', 'serif'],
        display: ['var(--vc-font-display)', 'Georgia', 'serif'],
        body: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        playfair: ['var(--vc-font-display)', 'Georgia', 'serif'],
        outfit: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        lato: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
