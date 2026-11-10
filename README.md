# Jack Bailey Website

Astro site for [jack-bailey.co.uk](https://jack-bailey.co.uk/) with two main sections:

- `Writing`: MDX posts in `src/content/blog/`
- `Notebook`: shorter notes in `src/content/notes/`

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
- `src/content/`: blog posts, notes, and curated tags
- `src/components/`: Astro layout/UI components and React chart islands
- `src/pages/`: Astro routes
- `public/`: static assets

## Notes

- Build output is generated into `dist/`.
- Local caches, Playwright screenshots, and other generated files are ignored via `.gitignore`.
- `astro.config.mjs` sets the canonical production URL for sitemap and metadata output.

## POLI10302 assessment documents

Link Canvas to `/poli10302/assessments/1/` and `/poli10302/assessments/2/`. Each page links to `brief.pdf` and `checklist.pdf` in its own directory.

To revise an assessment, render the PDFs from the Markdown sources in the teaching project's `_assessments/` directory. Replace the matching files in `public/poli10302/assessments/1/` or `public/poli10302/assessments/2/` and update the draft note in `src/pages/poli10302/assessments/[assessment].astro` when the outstanding details are confirmed. Keep the directory and PDF names unchanged when publishing to the site. The pages and PDFs are public by URL and excluded from search indexing.
