// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_TMDB_KEY: string;
  readonly VITE_TMDB_API_KEY: string;
  // add other environment variables here as needed
}