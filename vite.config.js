import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      "Content-Security-Policy": `
        default-src 'self';
        connect-src 'self' https://api.themoviedb.org;
        script-src 'self' 'wasm-unsafe-eval';
        style-src 'self' 'unsafe-inline';
        img-src 'self' https://image.tmdb.org data:;
      `.replace(/\n/g, '')
    }
  }
});