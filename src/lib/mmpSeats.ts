// The middle of the site's Magma palette, omitting ink and pale gold.
export const MMP_SEAT_COLORS = ["#3B0F70", "#B73779", "#F76F5C", "#FEB77E"] as const;
export const MMP_MAX_SEATS = 10;
export const MMP_SEAT_POSITIONS = Array.from({ length: 25 }, (_, index) => {
  const col = index % 5, row = Math.floor(index / 5);
  const x = 88 + col * 95, y = 88 + row * 95;
  return { x: 640 + (x - y) * Math.sqrt(3) / 2, y: 180 + (x + y) / 2, depth: row + col };
});
export const MMP_STILL_SLOTS = [0, 3, 6, 9, 11, 14, 17, 18, 20, 23];

type Phase = "visible" | "out" | "hidden" | "in";
export type MmpSeat = { slot: number; color: number; phase: Phase; elapsed: number; duration: number; opacity: number };
const choose = (length: number, random: () => number) => Math.floor(random() * length);
const smooth = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

export function createMmpSeats(random = Math.random): MmpSeat[] {
  const available = MMP_SEAT_POSITIONS.map((_, index) => index);
  return Array.from({ length: MMP_MAX_SEATS }, () => ({
    slot: available.splice(choose(available.length, random), 1)[0],
    color: choose(MMP_SEAT_COLORS.length, random),
    phase: "visible", elapsed: 0, duration: 1 + random() * 6, opacity: 1,
  }));
}

export function stepMmpSeats(seats: MmpSeat[], seconds: number, random = Math.random) {
  for (const seat of seats) {
    seat.elapsed += seconds;
    if (seat.elapsed >= seat.duration) {
      seat.elapsed = 0;
      if (seat.phase === "visible") {
        seat.phase = "out";
        seat.duration = 1 + random() * 1.1;
      } else if (seat.phase === "out") {
        seat.phase = "hidden";
        seat.duration = .6 + random() * 2;
      } else if (seat.phase === "hidden") {
        // Reposition and recolour only at zero opacity. Reserve hidden slots too,
        // so two chairs never share a place. There are only ten chair instances.
        const occupied = new Set(seats.map(other => other.slot));
        const available = MMP_SEAT_POSITIONS.map((_, i) => i).filter(i => !occupied.has(i));
        seat.slot = available[choose(available.length, random)];
        seat.color = choose(MMP_SEAT_COLORS.length, random);
        seat.phase = "in";
        seat.duration = 1.1 + random() * 1.2;
      } else {
        seat.phase = "visible";
        seat.duration = 2.5 + random() * 5;
      }
    }
    const t = seat.elapsed / seat.duration;
    seat.opacity = seat.phase === "visible" ? 1 : seat.phase === "hidden" ? 0 : seat.phase === "in" ? smooth(t) : 1 - smooth(t);
  }
}
