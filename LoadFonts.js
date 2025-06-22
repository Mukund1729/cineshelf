// src/LoadFonts.js
if ('fonts' in document) {
  document.fonts.load('1em Inter').catch(() => {
    const fallbackFont = document.createElement('link');
    fallbackFont.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
    fallbackFont.rel = 'stylesheet';
    document.head.appendChild(fallbackFont);
  });
}