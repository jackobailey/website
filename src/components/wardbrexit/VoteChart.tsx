import { useLayoutEffect, useRef, useState } from 'react';
import { RESPONSES, percentage, type Preference, type Vote, type Ward } from './data';

const SHARE_DURATION = 350;
const ORDER_DURATION = 350;

function useAnimatedVotes(target: Vote[]) {
  const [votes, setVotes] = useState(target);
  const current = useRef(target);
  const rows = useRef<HTMLDivElement>(null);
  const previousPositions = useRef(new Map<string, number>());
  const movements = useRef<Animation[]>([]);

  // After the shares have reached their targets, animate each keyed row from
  // its old position to its new position in the sorted DOM (FLIP).
  useLayoutEffect(() => {
    if (!previousPositions.current.size) return;
    const positions = previousPositions.current;
    previousPositions.current = new Map();
    movements.current.forEach(animation => animation.cancel());
    movements.current = [];
    rows.current?.querySelectorAll<HTMLElement>('.chart-row').forEach(row => {
      const before = positions.get(row.dataset.preference!);
      const distance = before === undefined ? 0 : before - row.getBoundingClientRect().top;
      if (distance) movements.current.push(row.animate([
        { transform: `translateY(${distance}px)` },
        { transform: 'translateY(0)' },
      ], { duration: ORDER_DURATION, easing: 'ease-in-out' }));
    });
  });

  useLayoutEffect(() => {
    if (current.current === target) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const publish = (next: Vote[]) => { current.current = next; setVotes(next); };
    const finishImmediately = () => {
      cancelAnimationFrame(frame);
      movements.current.forEach(animation => animation.cancel());
      previousPositions.current.clear();
      publish(target);
    };
    if (motion.matches) { finishImmediately(); return; }

    // Freeze an interrupted sort at its visible positions while the latest
    // shares change; the next sort resumes from those positions.
    movements.current.forEach(animation => animation.pause());

    // A new selection starts from the values currently on screen. Preferences
    // entering/leaving the chart grow from/shrink to zero before sorting.
    const from = current.current;
    const targets = new Map<Preference, Vote>(target.map(vote => [vote[0], vote]));
    const existing = new Set(from.map(([preference]) => preference));
    const starts: Vote[] = [...from, ...target.filter(([preference]) => !existing.has(preference)).map(([preference]): Vote => [preference, 0, 0, 0])];
    const started = performance.now();
    const update = (now: number) => {
      const progress = Math.min((now - started) / SHARE_DURATION, 1);
      const eased = progress * progress * (3 - 2 * progress);
      if (progress < 1) {
        publish(starts.map(([preference, est, lower, upper]): Vote => {
          const goal = targets.get(preference) ?? [preference, 0, 0, 0];
          return [preference, est + (goal[1] - est) * eased, lower + (goal[2] - lower) * eased, upper + (goal[3] - upper) * eased];
        }));
        frame = requestAnimationFrame(update);
      } else {
        previousPositions.current = new Map(Array.from(rows.current?.querySelectorAll<HTMLElement>('.chart-row') ?? [], row => [row.dataset.preference!, row.getBoundingClientRect().top]));
        publish(target);
      }
    };
    frame = requestAnimationFrame(update);
    const motionChanged = () => { if (motion.matches) finishImmediately(); };
    motion.addEventListener('change', motionChanged);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', motionChanged); };
  }, [target]);

  useLayoutEffect(() => () => { movements.current.forEach(animation => animation.cancel()); }, []);
  return { votes, rows };
}

export default function VoteChart({ ward }: { ward: Ward }) {
  const { votes, rows } = useAnimatedVotes(ward.votes);
  return <section className="vote-chart" aria-labelledby="vote-chart-title">
    <h3 id="vote-chart-title">Estimated Vote Share</h3>
    <p className="chart-subtitle">% among those choosing Rejoin or Stay out</p>
    <div className="chart-bars" aria-hidden="true" ref={rows}>
      {votes.map(([preference, est, lower, upper]) => <div className="chart-row" key={preference} data-preference={preference}>
        <div className="bar-label"><span>{RESPONSES[preference].name}</span><strong>{percentage(est)}</strong></div>
        <div className="bar-track" title={`${RESPONSES[preference].name}: ${percentage(est)} (95% interval ${percentage(lower)}–${percentage(upper)})`}>
          <div className="bar-fill" style={{ width: `${est * 100}%`, backgroundColor: RESPONSES[preference].color }} />
          <div className="bar-interval" style={{ left: `${lower * 100}%`, width: `${(upper - lower) * 100}%` }} />
        </div>
      </div>)}
      <div className="chart-axis">{[0, 25, 50, 75, 100].map(value => <span key={value}>{value}{value === 100 ? '%' : ''}</span>)}</div>
    </div>
    <p className="interval-key"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2 7h40M2 2v10M42 2v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>95% uncertainty interval</p>
    <div className="sr-only"><table><caption>Estimated vote shares in {ward.name}, with 95% uncertainty intervals</caption>
      <thead><tr><th scope="col">Preference</th><th scope="col">Estimate</th><th scope="col">Lower bound</th><th scope="col">Upper bound</th></tr></thead>
      <tbody>{ward.votes.map(([preference, est, lower, upper]) => <tr key={preference}><th scope="row">{RESPONSES[preference].name}</th><td>{percentage(est)}</td><td>{percentage(lower)}</td><td>{percentage(upper)}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
