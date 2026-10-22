import { useEffect, useRef } from "react";

/**
 * useTilt - Hardware-accelerated 3D perspective tilt and spotlight tracker.
 * Inspired by bleibtgleich.dev card hover dynamics.
 * 
 * Modifies element.style.transform and CSS custom properties directly inside
 * requestAnimationFrame to guarantee 60-120fps performance with 0 React re-renders.
 */
export function useTilt({
  maxTilt = 5,
  perspective = 900,
  scale = 1.018,
  glow = true,
  disabled = false,
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    // Check device capabilities
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!hasFinePointer || prefersReducedMotion) {
      return;
    }

    let rect = null;
    let animId = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isHovering = false;

    const updateRect = () => {
      rect = el.getBoundingClientRect();
    };

    const onMouseEnter = () => {
      isHovering = true;
      updateRect();
      el.style.willChange = "transform, box-shadow";
      el.style.transition = "transform 0.12s ease-out, box-shadow 0.25s ease-out";
    };

    const onMouseMove = (e) => {
      if (!rect) updateRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Normalized coordinates from center: -0.5 to +0.5
      targetX = mouseX / rect.width - 0.5;
      targetY = mouseY / rect.height - 0.5;

      // Update CSS variables for radial spotlight highlight
      if (glow) {
        el.style.setProperty("--mouse-x", `${mouseX.toFixed(1)}px`);
        el.style.setProperty("--mouse-y", `${mouseY.toFixed(1)}px`);
      }
    };

    const onMouseLeave = () => {
      isHovering = false;
      targetX = 0;
      targetY = 0;
      // Smooth reset transition
      el.style.transition = "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.45s ease-out";
      el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)`;
    };

    const renderLoop = () => {
      if (isHovering) {
        // Smooth lerp towards target tilt
        currentX += (targetX - currentX) * 0.22;
        currentY += (targetY - currentY) * 0.22;

        const rotX = -currentY * maxTilt;
        const rotY = currentX * maxTilt;

        el.style.transform = `perspective(${perspective}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(6px) scale3d(${scale}, ${scale}, ${scale})`;
      }

      animId = requestAnimationFrame(renderLoop);
    };

    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mousemove", onMouseMove, { passive: true });
    el.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", updateRect, { passive: true });

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", updateRect);
      el.style.transform = "";
      el.style.willChange = "";
      el.style.transition = "";
    };
  }, [maxTilt, perspective, scale, glow, disabled]);

  return ref;
}

export default useTilt;
