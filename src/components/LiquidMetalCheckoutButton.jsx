import { ArrowUpRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import "./liquid-metal-lab.css";

export default function LiquidMetalCheckoutButton({
  disabled = false,
  glassEnabled = true,
  icon = "arrow",
  label = "Finalizar compra",
  loading = false,
  onClick,
  size = "default",
  statusOpen,
}) {
  const buttonRef = useRef(null);
  const controlRef = useRef(null);
  const boundsRef = useRef(null);
  const frameRef = useRef(null);
  const resetTimerRef = useRef(null);
  const statusId = useId();
  const isStatusOpen = statusOpen ?? loading;

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const paintPointer = (clientX, clientY) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const control = controlRef.current;
    const button = buttonRef.current;
    if (!control || !button) return;

    const bounds = boundsRef.current || button.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      control.style.setProperty("--pointer-x", `${x * 100}%`);
      control.style.setProperty("--pointer-y", `${y * 100}%`);
      control.style.setProperty("--tilt-x", `${(0.5 - y) * 3}deg`);
      control.style.setProperty("--tilt-y", `${(x - 0.5) * 4}deg`);
      control.style.setProperty("--lens-x", `${(0.5 - x) * 6}px`);
      control.style.setProperty("--lens-y", `${(0.5 - y) * 4}px`);
    });
  };

  const handlePointerDown = (event) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    boundsRef.current = buttonRef.current?.getBoundingClientRect() || null;
    paintPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType === "touch") return;
    paintPointer(event.clientX, event.clientY);
  };

  const resetPointer = () => {
    const control = controlRef.current;
    if (!control) return;

    boundsRef.current = null;
    control.style.setProperty("--pointer-x", "50%");
    control.style.setProperty("--pointer-y", "18%");
    control.style.setProperty("--tilt-x", "0deg");
    control.style.setProperty("--tilt-y", "0deg");
    control.style.setProperty("--lens-x", "0px");
    control.style.setProperty("--lens-y", "0px");
  };

  const releasePointer = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(resetPointer, 220);
  };

  return (
    <div
      ref={controlRef}
      className={`liquid-metal-checkout-control ${isStatusOpen ? "is-status-open" : ""}`}
    >
      {size === "cart" && (
        <span className="liquid-metal-checkout-control__ambient" aria-hidden="true">
          <span />
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`liquid-metal-button liquid-metal-checkout-control__button liquid-metal-button--${size} ${
          glassEnabled ? "is-glass-enabled" : "is-metal-only"
        }`}
        disabled={disabled}
        aria-busy={loading}
        aria-expanded={isStatusOpen}
        aria-controls={statusId}
        aria-describedby={statusId}
        onClick={onClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onBlur={resetPointer}
      >
        <span className="liquid-metal-button__metal" aria-hidden="true" />
        <span className="liquid-metal-button__refraction" aria-hidden="true" />
        <span className="liquid-metal-button__glass" aria-hidden="true" />
        <span className="liquid-metal-button__caustic" aria-hidden="true" />
        <span className="liquid-metal-button__content">
          <span>{loading ? "Finalizando..." : label}</span>
          {icon === "bag" ? (
            <ShoppingBag size={16} strokeWidth={2} aria-hidden="true" />
          ) : icon === "lock" || size === "cart" ? (
            <LockKeyhole size={15} strokeWidth={2} aria-hidden="true" />
          ) : (
            <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
          )}
        </span>
      </button>

      <div className="liquid-metal-checkout-control__status-slot">
        <div>
          <div
            id={statusId}
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
