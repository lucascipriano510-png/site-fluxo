import { ArrowLeft, Layers3 } from "lucide-react";
import { useState } from "react";
import LiquidMetalCheckoutButton from "./LiquidMetalCheckoutButton";

export default function LiquidMetalLab() {
  const [glassEnabled, setGlassEnabled] = useState(true);
  const [checkoutBarOpen, setCheckoutBarOpen] = useState(false);

  return (
    <main className="liquid-metal-lab">
      <div className="liquid-metal-lab__light liquid-metal-lab__light--one" aria-hidden="true" />
      <div className="liquid-metal-lab__light liquid-metal-lab__light--two" aria-hidden="true" />

      <header className="liquid-metal-lab__header">
        <a href="/" className="liquid-metal-lab__back">
          <ArrowLeft size={17} aria-hidden="true" />
          Voltar à loja
        </a>
        <div className="liquid-metal-lab__mark">
          <Layers3 size={16} aria-hidden="true" />
          Fluxo Material Lab
        </div>
      </header>

      <section className="liquid-metal-lab__stage" aria-labelledby="lab-title">
        <div className="liquid-metal-lab__copy">
          <p className="liquid-metal-lab__index">Estudo de material 01</p>
          <h1 id="lab-title">
            Metal frio.
            <br />
            Vidro vivo.
          </h1>
          <p>
            Uma base de titânio escovado recebe uma camada óptica que captura luz, profundidade e
            movimento.
          </p>
        </div>

        <div className="liquid-metal-lab__experiment">
          <div className="liquid-metal-lab__button-field">
            <span
              className="liquid-metal-lab__orbit liquid-metal-lab__orbit--one"
              aria-hidden="true"
            />
            <span
              className="liquid-metal-lab__orbit liquid-metal-lab__orbit--two"
              aria-hidden="true"
            />
            <div className="liquid-metal-lab__button-stack">
              <LiquidMetalCheckoutButton
                glassEnabled={glassEnabled}
                statusOpen={checkoutBarOpen}
                onClick={() => setCheckoutBarOpen((open) => !open)}
              />
            </div>
          </div>

          <div className="liquid-metal-lab__controls">
            <div>
              <strong>{glassEnabled ? "Metal + Liquid Glass" : "Metal sem vidro"}</strong>
              <span>Use o controle para comparar as duas camadas.</span>
            </div>
            <button
              type="button"
              className="liquid-metal-lab__switch"
              role="switch"
              aria-checked={glassEnabled}
              onClick={() => setGlassEnabled((enabled) => !enabled)}
            >
              <span aria-hidden="true" />
              {glassEnabled ? "Vidro ligado" : "Vidro desligado"}
            </button>
          </div>

          <p className="liquid-metal-lab__feedback">
            Mova o cursor sobre o metal e clique para abrir a barra.
          </p>
        </div>
      </section>
    </main>
  );
}
