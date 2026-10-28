import { useEffect, useRef, useState } from "react";

interface PlotFrame {
  threshold: number;
  logitWidth: number;
  position: number;
  labelX: number;
  labelY: number;
}

const DURATION = 280;
const KEYS: (keyof PlotFrame)[] = ["threshold", "logitWidth", "position", "labelX", "labelY"];

/** Animate only the presentation; inputs and accessible results keep their exact values. */
export function useAnimatedPlot(target: PlotFrame): PlotFrame {
  const [frame, setFrame] = useState(target);
  const current = useRef(target);
  const { threshold, logitWidth, position, labelX, labelY } = target;

  useEffect(() => {
    const next = { threshold, logitWidth, position, labelX, labelY };
    const from = current.current;
    if (KEYS.every((key) => from[key] === next[key])) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let request = 0;
    const publish = (value: PlotFrame) => {
      current.current = value;
      setFrame(value);
    };
    const finish = () => {
      cancelAnimationFrame(request);
      publish(next);
    };
    if (reducedMotion.matches) {
      finish();
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / DURATION));
      if (progress === 1) {
        publish(next);
        return;
      }
      const eased = 1 - (1 - progress) ** 3;
      const value = { ...next };
      for (const key of KEYS) value[key] = from[key] + (next[key] - from[key]) * eased;
      publish(value);
      request = requestAnimationFrame(animate);
    };
    const onMotionChange = () => { if (reducedMotion.matches) finish(); };
    reducedMotion.addEventListener("change", onMotionChange);
    request = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(request);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [threshold, logitWidth, position, labelX, labelY]);

  return frame;
}
