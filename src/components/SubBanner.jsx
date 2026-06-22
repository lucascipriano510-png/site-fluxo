import React from 'react';
import { optimizeImage, buildSrcSet, markWsrvFailed } from '../lib/images';

// Logo do WhatsApp (lucide não tem ícone de marca).
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
  </svg>
);

/**
 * Sub-banner do meio da home (entre Destaques e Peças Disponíveis).
 * Faixa larga 2:1 otimizada via wsrv e lazy — abaixo da dobra, não é o LCP.
 * A imagem é decorativa (sem clique). Se o banner tiver `wa_message` e a loja
 * tiver número, mostra um botão de WhatsApp que abre a conversa com a mensagem.
 */
export default function SubBanner({ banner, whatsapp }) {
  const [loaded, setLoaded] = React.useState(false);
  const src = banner?.image;
  if (!src) return null;

  const imgSrc = optimizeImage(src, 1280, 90);
  const imgSrcSet = buildSrcSet(src, [640, 900, 1280, 1600], 90);

  const waNumber = String(whatsapp || '5534984148067').replace(/\D/g, '');
  const waMsg = (banner.wa_message || '').trim();
  const waUrl = waMsg && waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}` : null;

  return (
    <section className="relative -mx-6 lg:mx-0 lg:rounded-3xl overflow-hidden" aria-label={banner.title || 'Destaque'}>
      <div className="relative w-full aspect-[2/1] bg-zinc-950">
        {!loaded && (
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)',
              backgroundSize: '200% 200%',
              animation: 'bannerSkeleton 1.8s ease-in-out infinite',
            }}
          />
        )}
        <img
          src={imgSrc}
          srcSet={imgSrcSet}
          sizes="100vw"
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          alt={banner.title || 'Destaque'}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              markWsrvFailed();
              e.target.src = src; // URL original sem proxy
              e.target.srcset = '';
            }
          }}
        />

        {/* CTA de WhatsApp — ícone na quina superior direita, com pulso leve */}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            className="absolute top-3 right-3 z-10 grid place-items-center touch-manipulation"
          >
            {/* anel pulsando (piscadinha) atrás do ícone */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-60 animate-ping motion-reduce:hidden" aria-hidden="true" />
            <span className="relative grid place-items-center h-10 w-10 rounded-full bg-[#25D366] text-white shadow-[0_6px_18px_rgba(37,211,102,0.5)] ring-2 ring-white/25 active:scale-95 transition-transform">
              <WhatsAppIcon size={20} />
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
