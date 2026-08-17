import { motion } from "framer-motion";
import React from "react";

export default function LiquidMetalCheckoutButton({
  onClick,
  reducedMotion = false,
}) {
  const ref = React.useRef<HTMLButtonElement>(null);

  const paintLight = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion || !ref.current) return;

    const bounds = ref.current.getBoundingClientRect();

    const x = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );

    const y = Math.max(
      0,
      Math.min(1, (event.clientY - bounds.top) / bounds.height)
    );

    ref.current.style.setProperty("--lens-x", `${x * 100}%`);
    ref.current.style.setProperty("--lens-y", `${y * 100}%`);
    ref.current.style.setProperty(
      "--lens-shift-x",
      `${(x - 0.5) * 5}px`
    );
    ref.current.style.setProperty(
      "--lens-shift-y",
      `${(y - 0.5) * 3}px`
    );
  };

  const resetLight = () => {
    if (!ref.current) return;

    ref.current.style.setProperty("--lens-x", "28%");
    ref.current.style.setProperty("--lens-y", "22%");
    ref.current.style.setProperty("--lens-shift-x", "-1px");
    ref.current.style.setProperty("--lens-shift-y", "-1px");
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      className="liquid-metal-button--card"
      onClick={onClick}
      onPointerDown={paintLight}
      onPointerMove={(event) => {
        if (event.pointerType !== "touch") {
          paintLight(event);
        }
      }}
      onPointerLeave={resetLight}
      onBlur={resetLight}
      whileHover={
        reducedMotion
          ? {}
          : {
              scale: 1.04,
              transition: {
                duration: 0.15,
                ease: "easeOut",
              },
            }
      }
      whileTap={
        reducedMotion
          ? {}
          : {
              scale: 0.96,
              transition: {
                duration: 0.08,
              },
            }
      }
    >
      <span
        className="liquid-metal-button__refraction"
        aria-hidden="true"
      />

      <span
        className="liquid-metal-button__reflection"
        aria-hidden="true"
      />

      <span
        className="liquid-metal-button__rim"
        aria-hidden="true"
      />

      <span className="liquid-metal-button__content">
        <span>COMPRAR</span>
      </span>
    </motion.button>
  );
}
