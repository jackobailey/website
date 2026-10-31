// node scripts/render-ward-tour-poster.mjs (Node 22.18+)
import { readFile, writeFile } from 'node:fs/promises';
import { buildWardTourMap, renderWardTourPoster } from '../src/lib/wardTourScene.ts';
const root = new URL('../', import.meta.url);
const [topology, estimates] = await Promise.all([
  readFile(new URL('public/data/ward2024/wards.topo.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('public/data/ward2024/estimates.json', root), 'utf8').then(JSON.parse),
]);
const map = buildWardTourMap(topology, estimates);
const svg = renderWardTourPoster(map);
await writeFile(new URL('src/assets/writing/ward-election-tour.svg', root), svg + '\n');
console.log(`Rendered ${map.wards.length} ward estimates (${(Buffer.byteLength(svg) / 1024).toFixed(0)} KiB).`);
console.log(map.stops.map(stop => `${stop.name}: ${stop.camera.scale.toFixed(3)} px/km`).join('\n'));
