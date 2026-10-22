import React, { useEffect, useRef, useState } from "react";

/**
 * ScrollReveal - Smooth viewport entrance reveal wrapper.
 * Inspired by bleibtgleich.dev data-reveal and scrub-reveal transitions.
 * 
 * Uses IntersectionObserver to trigger hardware-accelerated fade-up
 * when entering the viewport. Fully respects prefers-reduced-motion.
 */
export function ScrollReveal({
  children,
  className = "",
  delay = 0, // delay in ms
  threshold = 0.1,
  direction = "up", // "up" | "down" | "fade"
  once = true,
  style = {},
  ...rest
}) {
  const containerRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(() => {
    // If reduced motion is preferred or SSR, reveal immediately
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return true;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isRevealed) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delay > 0) {
              setTimeout(() => {
                setIsRevealed(true);
              }, delay);
            } else {
              setIsRevealed(true);
            }

            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setIsRevealed(false);
          }
        });
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [delay, threshold, once, isRevealed]);

  return (
    <div
      ref={containerRef}
      className={`scroll-reveal-box reveal-${direction} ${
        isRevealed ? "is-revealed" : "is-hidden"
      } ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export default ScrollReveal;
