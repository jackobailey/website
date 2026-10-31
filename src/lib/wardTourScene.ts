import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { PARTIES, type Estimates, type Party } from '../components/ward2024/data.ts';
import { WARD_TOUR, projectWardPoint, createWardTour, type MapBounds, type MapCamera } from './wardTour.ts';

export type WardTourTopology = Topology<{ wards: GeometryCollection<{ ward: string }> }>;
export interface TourWard { id: string; colour: string; bounds: MapBounds; rings: [number, number][][]; }
const emptyBounds = (): MapBounds => [Infinity, Infinity, -Infinity, -Infinity];
function extend(bounds: MapBounds, x: number, y: number) {
  bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
  bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
}

/** The animation and vector still use the explorer's same ward keys and leaders. */
export function buildWardTourMap(topology: WardTourTopology, estimates: Estimates) {
  const byCode = new Map(estimates.wards.map(ward => [ward.id, ward]));
  const regions = new Map(['Great Britain', 'London'].map(name => [name, emptyBounds()]));
  const collection = feature(topology, topology.objects.wards);
  const wards: TourWard[] = collection.features.map(item => {
    const ward = byCode.get(item.properties.ward);
    if (!ward) throw new Error(`Missing ward estimate: ${item.properties.ward}`);
    const geometry = item.geometry;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') throw new Error('Expected ward polygons');
    const coordinates = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
    const bounds = emptyBounds();
    const rings = coordinates.map(ring => ring.map(point => {
      const projected = projectWardPoint(point);
      extend(bounds, ...projected);
      return projected;
    }));
    for (const name of ['Great Britain', ward.region]) {
      const region = regions.get(name);
      if (region) { extend(region, bounds[0], bounds[1]); extend(region, bounds[2], bounds[3]); }
    }
    const leader = ward.leader;
    if (leader !== 'tie' && !(leader in PARTIES)) throw new Error(`Unknown party: ${leader}`);
    return { id: ward.id, colour: leader === 'tie' ? '#d1d7db' : PARTIES[leader as Party].color, bounds, rings };
  });
  if (wards.length !== byCode.size || new Set(wards.map(ward => ward.id)).size !== wards.length) throw new Error('Ward coverage differs from estimates');
  if ([...regions.values()].some(bounds => !bounds.every(Number.isFinite))) throw new Error('Missing tour region');
  return { wards, stops: createWardTour(regions.get('Great Britain')!, regions.get('London')!) };
}

export function wardRingPath(rings: [number, number][][]) {
  return rings.map(ring => ring.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join('') + 'Z').join('');
}

function screenPoint([x, y]: [number, number], camera: MapCamera): [number, number] {
  return [(x - camera.x) * camera.scale + WARD_TOUR.width / 2, (y - camera.y) * camera.scale + WARD_TOUR.height / 2];
}

// Douglas–Peucker at poster scale: maximum 0.18px deviation at 1280px wide.
// Every ward and its source colour remain; this is only display simplification.
function simplifyPosterRing(points: [number, number][]) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [x, y] = points[first];
    const dx = points[last][0] - x, dy = points[last][1] - y;
    const length = dx * dx + dy * dy;
    let furthest = -1, maximum = .18 ** 2;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const t = length ? Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / length)) : 0;
      const distance = (px - x - dx * t) ** 2 + (py - y - dy * t) ** 2;
      if (distance > maximum) { maximum = distance; furthest = i; }
    }
    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([first, furthest], [furthest, last]);
    }
  }
  const simplified = points.filter((_, index) => keep[index]);
  return simplified.length >= 4 ? simplified : points;
}

export function renderWardTourPoster(map: ReturnType<typeof buildWardTourMap>) {
  const camera = map.stops[0].camera;
  const paths = new Map<string, string[]>();
  for (const ward of map.wards) {
    const path = ward.rings.map(ring => {
      const points = simplifyPosterRing(ring.map(point => screenPoint(point, camera)));
      return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') + 'Z';
    }).join('');
    if (!paths.has(ward.colour)) paths.set(ward.colour, []);
    paths.get(ward.colour)!.push(path);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="ward-tour-title ward-tour-desc">
<title id="ward-tour-title">The 2024 election, ward by ward</title>
<desc id="ward-tour-desc">All 7,993 Great Britain census wards, coloured by the party or category with the largest estimated vote share. These are modelled estimates, not counted ward results or winning probabilities.</desc>
<rect width="1280" height="720" fill="${WARD_TOUR.background}"/>
${[...paths].map(([colour, paths]) => `<path fill="${colour}" stroke="#ffffff" stroke-opacity="0.15" stroke-width="0.42" fill-rule="evenodd" d="${paths.join('')}"/>`).join('\n')}
</svg>`;
}
