# pizzaclub

Journal of my pizza adventures — every pizza, pizzeria, rating and photo, on a map and in stats.

[https://pizzaclub.sirlisko.com](https://pizzaclub.sirlisko.com)

## Stack

- [Astro](https://astro.build/) — static site, build-time data fetching, `astro:assets` image optimization
- Content lives in the repo as [content collections](https://docs.astro.build/en/guides/content-collections/), validated at build time
- [Netlify](https://www.netlify.com/) — hosting, rebuilds on every push to `main`
- [MapLibre GL](https://maplibre.org/) — the `/map` page

## Adding a new pizza

Pizzas come from Apple Photos in batches: a local, gitignored `photo-import/` workspace holds the originals and a reviewer page, and `pnpm import:photos <reviewer export>.json [--dry-run]` writes the entries, WebP photos (1600px long edge) and any new pizzerias into `src/content/`. The schema is in `src/content.config.ts`.

## Local development

```bash
pnpm install
pnpm dev
```

- `pnpm build` — production build to `dist/`
- `pnpm format` — prettier, including `.astro` files

## Project layout

- `src/` — the Astro site (pages, components, `lib/content.ts` for data access)
- `src/content/` — the data: a pizza (one per pizza eaten) references a pizzeria (one per place, shared across repeat visits)

## Powered by

- Flour
- Water
- Salt
- Yeast
- Tomato
- Mozzarella
- Basil
