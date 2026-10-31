// node scripts/render-ward-tour-poster.mjs (Node 22.18+)
import { readFile, writeFile } from 'node:fs/promises';
import { merge } from 'topojson-client';
import { optimize } from 'svgo';
import { buildWardTourMap, renderWardTourPoster } from '../src/lib/wardTourScene.ts';
import { projectWardPoint } from '../src/lib/wardTour.ts';
const root = new URL('../', import.meta.url);
const [topology, estimates] = await Promise.all([
  readFile(new URL('public/data/ward2024/wards.topo.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('public/data/ward2024/estimates.json', root), 'utf8').then(JSON.parse),
]);
const map = buildWardTourMap(topology, estimates);
const svg = renderWardTourPoster(map);
await writeFile(new URL('src/assets/writing/ward-election-tour.svg', root), svg + '\n');
// Cards retain vector detail without drawing shared edges between same-colour wards.
// Merge source topology first, so neighbouring regions keep matching boundaries.
const colours = new Map(map.wards.map(ward => [ward.id, ward.colour]));
const groups = new Map();
for (const geometry of topology.objects.wards.geometries) {
  const colour = colours.get(geometry.properties.ward);
  if (!colour) throw new Error(`Missing ward colour: ${geometry.properties.ward}`);
  if (!groups.has(colour)) groups.set(colour, []);
  groups.get(colour).push(geometry);
}
const thumbnailMap = {
  ...map,
  wards: [...groups].map(([colour, geometries]) => ({
    colour,
    rings: merge(topology, geometries).coordinates.flat().map(ring => ring.map(projectWardPoint)),
  })),
};
const thumbnail = optimize(renderWardTourPoster(thumbnailMap), {
  floatPrecision: 1,
  plugins: [{ name: 'preset-default', params: { overrides: { removeDesc: false } } }],
}).data;
await writeFile(new URL('src/assets/writing/ward-election-thumbnail.svg', root), thumbnail + '\n');
console.log(`Rendered ${map.wards.length} ward estimates (${(Buffer.byteLength(svg) / 1024).toFixed(0)} KiB).`);
console.log(`Vector thumbnail: ${(Buffer.byteLength(thumbnail) / 1024).toFixed(0)} KiB.`);
console.log(map.stops.map(stop => `${stop.name}: ${stop.camera.scale.toFixed(3)} px/km`).join('\n'));
