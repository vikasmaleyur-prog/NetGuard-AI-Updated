import React, { useEffect, useRef } from "react";

/**
 * MagneticButton - Cursor attraction button wrapper.
 * Inspired by bleibtgleich.dev magnetic interactive link/button behavior.
 * 
 * Provides subtle magnetic displacement towards cursor when in proximity,
 * with spring damping on release. Fully respects reduced motion.
 */
export function MagneticButton({
  children,
  className = "",
  strength = 0.28,
  maxDistance = 50,
  onClick,
  type = "button",
  disabled = false,
  title = "",
  ariaLabel = "",
  style = {},
  ...rest
}) {
  const btnRef = useRef(null);

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn || disabled) return;

    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!hasFinePointer || prefersReducedMotion) return;

    let rect = null;

    const updateRect = () => {
      rect = btn.getBoundingClientRect();
    };

    const onMouseEnter = () => {
      updateRect();
      btn.style.transition = "transform 0.15s ease-out";
    };

    const onMouseMove = (e) => {
      if (!rect) updateRect();

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.hypot(deltaX, deltaY);

      if (dist < maxDistance) {
        const pullX = deltaX * strength;
        const pullY = deltaY * strength;
        btn.style.transform = `translate3d(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px, 0)`;
      }
    };

    const onMouseLeave = () => {
      btn.style.transition = "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)";
      btn.style.transform = "translate3d(0px, 0px, 0)";
    };

    btn.addEventListener("mouseenter", onMouseEnter);
    btn.addEventListener("mousemove", onMouseMove, { passive: true });
    btn.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", updateRect, { passive: true });

    return () => {
      btn.removeEventListener("mouseenter", onMouseEnter);
      btn.removeEventListener("mousemove", onMouseMove);
      btn.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", updateRect);
      btn.style.transform = "";
      btn.style.transition = "";
    };
  }, [disabled, strength, maxDistance]);

  return (
    <button
      ref={btnRef}
      type={type}
      className={`magnetic-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      style={style}
      {...rest}
    >
      <span className="magnetic-btn-inner">{children}</span>
    </button>
  );
}

export default MagneticButton;
