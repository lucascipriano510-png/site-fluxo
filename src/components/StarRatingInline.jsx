import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchRatingsBatch, fetchExistingReview, submitReview } from '../lib/reviews';

// Estrelas inline do card/detalhe: mostra a média + permite o cliente avaliar
// (1 voto por perfil). Exige perfil Fluxo; abre o drawer de perfil se não houver.
const StarRatingInline = ({ product, ratingsMap, userProfile, setRatingsMap, setShowUserDrawer, setDrawerTab, showToast }) => {
  const rating = ratingsMap[product.id];
  const mode = rating?.mode || 0;
  const count = rating?.count || 0;
  const [pending, setPending] = React.useState(null);
  const [hovered, setHovered] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [myRating, setMyRating] = React.useState(null);

  const userId = userProfile?.phone?.trim() || userProfile?.id || null;

  React.useEffect(() => {
    if (!userId) return;
    fetchExistingReview(product.id, userId)
      .then(existing => { if (existing) setMyRating(existing.rating); })
      .catch(() => {});
  }, [product.id, userId]);

  const display = pending ?? hovered ?? (myRating || mode);

  const handleStarClick = (i) => {
    if (!userProfile) {
      setShowUserDrawer(true);
      setDrawerTab('profile');
      showToast('Crie seu perfil Fluxo para avaliar.', 'success');
      return;
    }
    if (myRating) {
      showToast(`Você já avaliou com ${myRating} estrela${myRating > 1 ? 's' : ''}.`, 'success');
      return;
    }
    setPending(i);
  };

  const handleConfirm = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      await submitReview({ productId: product.id, customerName: userProfile.name?.trim() || userId, customerPhone: userId, rating: pending });
      setMyRating(pending);
      setPending(null);
      const updated = await fetchRatingsBatch([product.id]);
      setRatingsMap(prev => ({ ...prev, ...updated }));
      showToast('Avaliação enviada! Obrigado 🙏', 'success');
    } catch (err) {
      if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
        showToast('Você já avaliou este produto.', 'success');
      } else {
        showToast('Erro ao enviar avaliação.', 'success');
      }
      setPending(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => { setPending(null); setHovered(null); };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => {
          const filled = i <= (pending ?? hovered ?? (myRating || mode));
          return (
            <motion.button
              key={i}
              type="button"
              whileTap={{ scale: 0.82 }}
              onMouseEnter={() => !pending && !myRating && setHovered(i)}
              onMouseLeave={() => !pending && setHovered(null)}
              onClick={(e) => { e.stopPropagation(); handleStarClick(i); }}
              className="touch-manipulation"
              style={{ background: 'none', border: 'none', padding: '1px', cursor: myRating ? 'default' : 'pointer' }}
            >
              <motion.svg
                width={13} height={13} viewBox="0 0 20 20" fill="none"
                animate={{ scale: filled && pending === i ? [1, 1.35, 1] : 1 }}
                transition={{ duration: 0.25 }}
              >
                <path
                  d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.1l-4.94 2.6.94-5.49-4-3.9 5.53-.8L10 1.5z"
                  fill={filled ? '#f59e0b' : 'rgba(255,255,255,0.22)'}
                  stroke={filled ? '#f59e0b' : 'rgba(255,255,255,0.45)'}
                  strokeWidth="1.5" strokeLinejoin="round"
                />
              </motion.svg>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {!pending ? (
          <motion.span
            key="count"
            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(113,113,122,0.9)', lineHeight: 1, userSelect: 'none' }}
          >
            {count === 0 ? '0 avaliações' : `${mode}★ · ${count}`}
          </motion.span>
        ) : (
          <motion.div
            key="actions"
            initial={{ opacity: 0, x: -6, scale: 0.85 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -6, scale: 0.85 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-1.5"
          >
            <motion.button type="button" whileTap={{ scale: 0.82 }} onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              className="touch-manipulation flex items-center justify-center"
              style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width={10} height={10} viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </motion.button>
            <motion.button type="button" whileTap={{ scale: 0.82 }} onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              disabled={submitting}
              className="touch-manipulation flex items-center justify-center"
              style={{ width: '22px', height: '22px', borderRadius: '50%', background: submitting ? 'oklch(0.91 0.012 264 / 0.08)' : 'oklch(0.91 0.012 264 / 0.15)', border: '1px solid oklch(0.91 0.012 264 / 0.35)', cursor: submitting ? 'default' : 'pointer', flexShrink: 0, boxShadow: submitting ? 'none' : '0 0 8px oklch(0.91 0.012 264 / 0.18)' }}
            >
              {submitting ? (
                <svg width={9} height={9} viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="10" cy="10" r="8" stroke="oklch(0.91 0.012 264 / 0.4)" strokeWidth="2.5"/>
                  <path d="M10 2a8 8 0 018 8" stroke="var(--flux-signal)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width={10} height={10} viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l5 5 7-8" stroke="var(--flux-signal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StarRatingInline;
