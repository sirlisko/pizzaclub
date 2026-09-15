import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://pizzaclub.sirlisko.com',
  vite: {
    // Vite's dev-time dependency pre-bundling mangles maplibre-gl's worker
    // script URL, causing it to 404 and silently breaking the map (no tiles
    // decode, `load` never fires, markers never get added).
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    // maplibre-gl's worker is an ES module with its own internal imports;
    // bundling it via `?worker&url` (below) needs this to produce a
    // self-contained module worker instead of the default iife format.
    worker: {
      format: 'es',
    },
  },
})
