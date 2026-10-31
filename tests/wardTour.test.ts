import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildWardTourMap } from '../src/lib/wardTourScene.ts';
import { WARD_TOUR, wardTourFrame, wardTourDuration } from '../src/lib/wardTour.ts';

const map = buildWardTourMap(
  JSON.parse(readFileSync(new URL('../public/data/ward2024/wards.topo.json', import.meta.url), 'utf8')),
  JSON.parse(readFileSync(new URL('../public/data/ward2024/estimates.json', import.meta.url), 'utf8')),
);
const duration = wardTourDuration(map.stops);

test('all 7,993 source wards appear, and every target area fits within its held frame', () => {
  assert.equal(map.wards.length, 7993);
  assert.equal(new Set(map.wards.map(ward => ward.id)).size, 7993);
  assert.deepEqual(map.stops.map(stop => stop.name), ['Great Britain', 'Manchester', 'London', 'Glasgow', 'Edinburgh', 'Cardiff', 'Birmingham', 'Bristol']);
  for (const { bounds: [left, top, right, bottom], camera } of map.stops) {
    assert.ok((left - camera.x) * camera.scale + WARD_TOUR.width / 2 >= 57.99);
    assert.ok((right - camera.x) * camera.scale + WARD_TOUR.width / 2 <= WARD_TOUR.width - 57.99);
    assert.ok((top - camera.y) * camera.scale + WARD_TOUR.height / 2 >= 57.99);
    assert.ok((bottom - camera.y) * camera.scale + WARD_TOUR.height / 2 <= WARD_TOUR.height - 57.99);
  }
});

test('travel, hold and repeat boundaries join without jumps or sudden velocity changes', () => {
  const visits = map.stops.length - 1;
  const visit = duration / visits;
  const { overviewSeconds: overview, travelSeconds: travel, holdSeconds: hold } = WARD_TOUR;
  const epsilon = 1e-4;
  const screen = (time: number, x: number, y: number) => {
    const { camera } = wardTourFrame(time, map.stops);
    return [(x - camera.x) * camera.scale, (y - camera.y) * camera.scale];
  };
  for (let i = 0; i < visits; i++) {
    for (const phase of [0, overview, overview + travel, overview + travel + hold, visit]) {
      for (const stop of map.stops) {
        const time = i * visit + phase;
        const before = screen(time - epsilon, stop.camera.x, stop.camera.y);
        const at = screen(time, stop.camera.x, stop.camera.y);
        const after = screen(time + epsilon, stop.camera.x, stop.camera.y);
        assert.ok(Math.hypot(before[0] - at[0], before[1] - at[1]) < 1e-6);
        assert.ok(Math.hypot(after[0] - at[0], after[1] - at[1]) < 1e-6);
      }
    }
  }
  assert.deepEqual(wardTourFrame(0, map.stops).camera, wardTourFrame(duration, map.stops).camera);
});

test('every part of the tour retains land in view and pauses at the intended areas', () => {
  const visit = duration / (map.stops.length - 1);
  for (let index = 1; index < map.stops.length; index++) {
    const held = wardTourFrame((index - 1) * visit + WARD_TOUR.overviewSeconds + WARD_TOUR.travelSeconds + WARD_TOUR.holdSeconds / 2, map.stops);
    assert.equal(held.label, map.stops[index].name);
    assert.deepEqual(held.camera, map.stops[index].camera);
  }
  for (let time = 0; time <= duration; time += .2) {
    const { camera } = wardTourFrame(time, map.stops);
    assert.ok(Number.isFinite(camera.scale) && camera.scale > 0);
    const halfWidth = WARD_TOUR.width / (2 * camera.scale);
    const halfHeight = WARD_TOUR.height / (2 * camera.scale);
    assert.ok(map.wards.some(({ bounds: [left, top, right, bottom] }) =>
      right >= camera.x - halfWidth && left <= camera.x + halfWidth &&
      bottom >= camera.y - halfHeight && top <= camera.y + halfHeight), `No land in view at ${time}`);
  }
});
