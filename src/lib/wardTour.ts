export const WARD_TOUR = {
  width: 1280, height: 720, background: '#f1f0eb',
  overviewSeconds: 1.5, travelSeconds: 3.5, holdSeconds: 2,
} as const;

export type MapBounds = [number, number, number, number];
export interface MapCamera { x: number; y: number; scale: number; }
export interface TourStop { name: string; bounds: MapBounds; camera: MapCamera; }

// Web Mercator in kilometres, with screen y increasing southwards.
export function projectWardPoint([longitude, latitude]: number[]): [number, number] {
  return [6378.137 * longitude * Math.PI / 180,
    -6378.137 * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))];
}

export function geographicBounds(west: number, south: number, east: number, north: number): MapBounds {
  const [left, top] = projectWardPoint([west, north]);
  const [right, bottom] = projectWardPoint([east, south]);
  return [left, top, right, bottom];
}

export function fitWardCamera(bounds: MapBounds, padding = 58): MapCamera {
  const [left, top, right, bottom] = bounds;
  return { x: (left + right) / 2, y: (top + bottom) / 2,
    scale: Math.min((WARD_TOUR.width - padding * 2) / (right - left),
      (WARD_TOUR.height - padding * 2) / (bottom - top)) };
}

export function createWardTour(country: MapBounds, london: MapBounds): TourStop[] {
  const manchester = geographicBounds(-2.78, 53.30, -1.90, 53.70);
  const cityBounds = (longitude: number, latitude: number, zoom = 1.6): MapBounds => {
    const [x, y] = projectWardPoint([longitude, latitude]);
    const halfWidth = (manchester[2] - manchester[0]) / (2 * zoom);
    const halfHeight = (manchester[3] - manchester[1]) / (2 * zoom);
    return [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight];
  };
  return [
    { name: 'Great Britain', bounds: country },
    // A framing window, not a claimed Greater Manchester administrative boundary.
    { name: 'Manchester', bounds: manchester },
    { name: 'London', bounds: london },
    { name: 'Glasgow', bounds: cityBounds(-4.25, 55.86) },
    { name: 'Edinburgh', bounds: cityBounds(-3.19, 55.95) },
    { name: 'Cardiff', bounds: cityBounds(-3.18, 51.49) },
    { name: 'Birmingham', bounds: cityBounds(-1.90, 52.48, 1.25) },
    { name: 'Bristol', bounds: cityBounds(-2.59, 51.45) },
  ].map(stop => ({ ...stop, camera: fitWardCamera(stop.bounds) }));
}

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function interpolateWardCamera(from: MapCamera, to: MapCamera, progress: number): MapCamera {
  const amount = smooth(progress);
  // Interpolate the visible world span, so the zoom and centre remain coupled.
  const fromSpan = 1 / from.scale;
  const toSpan = 1 / to.scale;
  const span = Math.exp(Math.log(fromSpan) * (1 - amount) + Math.log(toSpan) * amount);
  const position = Math.abs(toSpan - fromSpan) < 1e-10 ? amount : (span - fromSpan) / (toSpan - fromSpan);
  return { x: from.x + (to.x - from.x) * position,
    y: from.y + (to.y - from.y) * position, scale: 1 / span };
}

export function wardTourDuration(stops: TourStop[]) {
  return (stops.length - 1) * (WARD_TOUR.overviewSeconds + 2 * WARD_TOUR.travelSeconds + WARD_TOUR.holdSeconds);
}

export function wardTourFrame(time: number, stops: TourStop[]) {
  const duration = wardTourDuration(stops);
  const local = ((time % duration) + duration) % duration;
  const visitDuration = duration / (stops.length - 1);
  const index = Math.floor(local / visitDuration) + 1;
  const phase = local % visitDuration;
  const country = stops[0];
  const target = stops[index];
  const { overviewSeconds: overview, travelSeconds: travel, holdSeconds: hold } = WARD_TOUR;
  if (phase < overview) return { camera: country.camera, label: country.name, labelOpacity: 1 };
  if (phase < overview + travel) {
    const progress = (phase - overview) / travel;
    return { camera: interpolateWardCamera(country.camera, target.camera, progress),
      label: target.name, labelOpacity: smooth(Math.min(progress * 3, 1)) };
  }
  if (phase < overview + travel + hold) return { camera: target.camera, label: target.name, labelOpacity: 1 };
  const progress = (phase - overview - travel - hold) / travel;
  return { camera: interpolateWardCamera(target.camera, country.camera, progress),
    label: target.name, labelOpacity: 1 - smooth(Math.min(progress * 3, 1)) };
}
