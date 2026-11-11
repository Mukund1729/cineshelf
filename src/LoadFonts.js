// src/LoadFonts.js
// Only attempt to load the local Inter font. No Google Fonts fallback due to CSP.
if ('fonts' in document) {
  document.fonts.load('1em Inter');
}