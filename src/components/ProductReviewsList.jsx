import React from 'react';
import { fetchProductReviews } from '../lib/reviews';

// Lista de avaliações de um produto (somente leitura).
// Carrega sob demanda pelo productId; não renderiza nada enquanto carrega
// ou se não houver avaliações.
export default function ProductReviewsList({ productId }) {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetchProductReviews(productId)
      .then(data => setReviews(data))
      .finally(() => setLoading(false));
  }, [productId]);
  if (loading || reviews.length === 0) return null;
  return (
    <div className="space-y-2.5 pt-4 mt-2 border-t border-white/5">
      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Avaliações ({reviews.length})</p>
      {reviews.map(rv => (
        <div key={rv.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width={11} height={11} viewBox="0 0 20 20" fill="none">
                  <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.1l-4.94 2.6.94-5.49-4-3.9 5.53-.8L10 1.5z"
                    fill={i <= rv.rating ? '#f59e0b' : 'none'} stroke={i <= rv.rating ? '#f59e0b' : 'rgba(255,255,255,0.12)'}
                    strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              ))}
            </div>
            <span className="text-[9px] text-zinc-600 font-bold">{new Date(rv.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-wide">{rv.customer_name.split(' ')[0]}</p>
          {rv.comment && <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">{rv.comment}</p>}
        </div>
      ))}
    </div>
  );
}
