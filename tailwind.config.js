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
        /* Legacy class names map to the current pair so old utilities don't load AI fonts. */
        playfair: ['var(--vc-font-display)', 'Georgia', 'serif'],
        outfit: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        lato: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
        cormorant: ['var(--vc-font-display)', 'Georgia', 'serif'],
        manrope: ['var(--vc-font-body)', 'Helvetica Neue', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
