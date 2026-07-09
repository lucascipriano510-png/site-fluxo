// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const GlobalStyles = () => (
<style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        ::-webkit-scrollbar { display: none; }
        
        html, body {
          background-color: #09090b;
          height: 100%;
          overflow: hidden;
        }

        body {
          font-family: 'Inter', sans-serif;
          -webkit-tap-highlight-color: transparent;
          background-color: #09090b;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        #root {
          height: 100%;
          overflow-x: hidden;
          overflow-y: scroll;
          overscroll-behavior-y: contain;
        }

        .app-shell {
          min-height: 100%;
          /* stacking context próprio: o canvas da atmosfera (z -1) fica acima
             do brilho-ambient do shell e abaixo de todo o conteúdo — sem isso
             o z -1 cairia atrás do fundo opaco e sumiria. */
          isolation: isolate;
        }

        .native-x-scroll {
          touch-action: pan-x pan-y;
          overscroll-behavior-x: contain;
          overscroll-behavior-y: auto;
        }

        .carousel-scroll {
          touch-action: pan-x pan-y;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          will-change: scroll-position;
        }

        img {
          /* auto = downscaling suave e de alta qualidade do navegador (correto p/
             FOTO). crisp-edges/optimize-contrast serrilhavam a foto reduzida; e o
             translateZ forcava cada img p/ camada GPU (rasterizada em baixa res).
             Eram a causa real do "borrado/perdeu pixels" no desktop E no mobile. */
          image-rendering: auto;
          object-fit: cover;
          display: block;
          max-width: 100%;
        }
        
        .premium-shadow {
          shadow-[0_20px_50px_rgba(0,0,0,0.5)];
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .mask-linear { -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%); mask-image: linear-gradient(to right, black 85%, transparent 100%); }
        .animate-in { animation: fadeIn 0.5s ease-out; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-marquee { animation: marquee 30s linear infinite; }
        
        #reader { position: relative; width: 100%; height: 100%; }
        #reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; position: absolute !important; top: 0; left: 0; border-radius: 20px !important; }
        #reader canvas { position: absolute !important; top: 0; left: 0; z-index: 10 !important; border-radius: 20px !important; }

        @supports (-webkit-touch-callout: none) {
            .client-input { font-size: 16px !important; }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        .card-enter { animation: cardEnter 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
);

export default GlobalStyles;
