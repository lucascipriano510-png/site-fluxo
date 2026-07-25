import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { useRef } from "react";
import "./liquid-metal-lab.css";

export default function LiquidMetalCheckoutButton({
  disabled = false,
  glassEnabled = true,
  label = "Finalizar compra",
  loading = false,
  onClick,
  size = "default",
  statusOpen,
}) {
  const buttonRef = useRef(null);
  const isStatusOpen = statusOpen ?? loading;

  const handlePointerMove = (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const button = buttonRef.current;
    if (!button) return;

    const bounds = button.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    button.style.setProperty("--pointer-x", `${x * 100}%`);
    button.style.setProperty("--pointer-y", `${y * 100}%`);
    button.style.setProperty("--tilt-x", `${(0.5 - y) * 5}deg`);
    button.style.setProperty("--tilt-y", `${(x - 0.5) * 7}deg`);
    button.style.setProperty("--lens-x", `${(0.5 - x) * 10}px`);
    button.style.setProperty("--lens-y", `${(0.5 - y) * 7}px`);
  };

  const resetPointer = () => {
    const button = buttonRef.current;
    if (!button) return;

    button.style.setProperty("--pointer-x", "50%");
    button.style.setProperty("--pointer-y", "18%");
    button.style.setProperty("--tilt-x", "0deg");
    button.style.setProperty("--tilt-y", "0deg");
    button.style.setProperty("--lens-x", "0px");
    button.style.setProperty("--lens-y", "0px");
  };

  return (
    <div className={`liquid-metal-checkout-control ${isStatusOpen ? "is-status-open" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`liquid-metal-button liquid-metal-checkout-control__button liquid-metal-button--${size} ${
          glassEnabled ? "is-glass-enabled" : "is-metal-only"
        }`}
        disabled={disabled}
        aria-busy={loading}
        aria-expanded={isStatusOpen}
        aria-controls="checkout-secure-status"
        aria-describedby="checkout-secure-status"
        onClick={onClick}
        onPointerDown={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        onPointerUp={resetPointer}
        onPointerCancel={resetPointer}
        onBlur={resetPointer}
      >
        <span className="liquid-metal-button__metal" aria-hidden="true" />
        <span className="liquid-metal-button__refraction" aria-hidden="true" />
        <span className="liquid-metal-button__glass" aria-hidden="true" />
        <span className="liquid-metal-button__caustic" aria-hidden="true" />
        <span className="liquid-metal-button__content">
          <span>{loading ? "Finalizando..." : label}</span>
          {size === "cart" ? (
            <LockKeyhole size={15} strokeWidth={2} aria-hidden="true" />
          ) : (
            <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
          )}
        </span>
      </button>

      <div className="liquid-metal-checkout-control__status-slot">
        <div>
          <div
            id="checkout-secure-status"
            className={`liquid-metal-checkout-bar ${isStatusOpen ? "is-open" : ""}`}
            role="status"
            aria-hidden={!isStatusOpen}
          >
            <LockKeyhole size={14} strokeWidth={1.9} aria-hidden="true" />
            <span>Preparando compra segura</span>
            <span className="liquid-metal-checkout-bar__progress" aria-hidden="true">
              <i />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
