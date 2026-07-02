// =====================================================================
// FLUXO OUTLET — /qr/:sku (Vercel Function)
// QR code do produto pra ETIQUETA DA LOJA FÍSICA: o cliente escaneia e
// cai na página da peça (/p/:sku, com foto/preço/descrição no site).
// Uso: abrir fluxooutlet.com.br/qr/0001 -> salvar/imprimir o PNG.
// ?size=600 controla o tamanho (300 a 1200px).
// Rewrite em vercel.json: /qr/:sku -> /api/qr?sku=:sku
// =====================================================================

import QRCode from 'qrcode';

const SITE = 'https://www.fluxooutlet.com.br';

export default async function handler(req, res) {
  const sku = String(req.query.sku || '').slice(0, 64).replace(/[^\w-]/g, '');
  if (!sku) { res.statusCode = 400; res.end('sku obrigatório'); return; }

  const size = Math.min(1200, Math.max(300, parseInt(req.query.size, 10) || 600));
  const url = `${SITE}/p/${encodeURIComponent(sku)}`;

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M', // aguenta impressão pequena/etiqueta amassada
    color: { dark: '#09090b', light: '#ffffff' },
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.end(png);
}
