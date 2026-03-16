# Jack Bailey Website

Astro site for [jack-bailey.co.uk](https://jack-bailey.co.uk/) with three main sections:

- `Writing`: MDX posts in `src/content/blog/`
- `Notebook`: shorter notes in `src/content/notes/`
- `Polls`: written updates plus a React chart backed by JSON in `src/data/polls/`

## Development

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run check
npm run build
```

## Project Structure

- `src/site.config.ts`: site-wide metadata used in layouts and structured data
- `src/content/`: blog posts, notes, polls, and curated tags
- `src/components/`: Astro layout/UI components and React chart islands
- `src/pages/`: Astro routes
- `public/`: static assets

## Notes

- Build output is generated into `dist/`.
- Local caches, Playwright screenshots, and other generated files are ignored via `.gitignore`.
- `astro.config.mjs` still uses `https://example.com`; update it before deploying.
