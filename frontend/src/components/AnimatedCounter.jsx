import React, { useEffect, useRef, useState } from "react";

/**
 * AnimatedCounter - Smooth metric rolling counter.
 * Only animates when the value genuinely changes between telemetry polls.
 * Never restarts from zero on routine unchanged renders.
 */
export function AnimatedCounter({
  value,
  decimals = 1,
  duration = 500,
  className = "",
}) {
  const [displayValue, setDisplayValue] = useState(() => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return null;
    }
    return Number(value);
  });

  const prevValueRef = useRef(displayValue);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      setDisplayValue(null);
      prevValueRef.current = null;
      return;
    }

    const targetVal = Number(value);
    const startVal = prevValueRef.current !== null ? prevValueRef.current : targetVal;

    // If unchanged, do nothing
    if (startVal === targetVal) {
      setDisplayValue(targetVal);
      return;
    }

    // Check prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(targetVal);
      prevValueRef.current = targetVal;
      return;
    }

    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetVal);
        prevValueRef.current = targetVal;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  if (displayValue === null) {
    return <span className={`counter-text ${className}`}>--</span>;
  }

  return (
    <span className={`counter-text ${className}`}>
      {displayValue.toFixed(decimals)}
    </span>
  );
}

export default AnimatedCounter;
