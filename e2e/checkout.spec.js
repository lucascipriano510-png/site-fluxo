// =====================================================================
// FLUXO OUTLET — E2E do caminho do dinheiro (mobile)
// home → produto → tamanho → sacola → checkout → sucesso
// O INSERT do pedido e o webhook-meta são mockados: nenhum pedido falso
// no banco, nenhum evento falso na Meta. Produtos são lidos do Supabase real.
// =====================================================================
import { test, expect } from '@playwright/test';

test('cliente consegue comprar: do catálogo até o pedido pronto', async ({ page, context }) => {
  // ── Mocks: pedido + Meta (NUNCA gravar de verdade a partir do teste) ──
  await context.route('**/rest/v1/orders*', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 999999, order_number: '99999', name: 'Teste E2E', phone: '34999999999', items: [], value: 1, status: 'NOVO' }),
      });
    }
    return route.continue();
  });
  await context.route('**/functions/v1/webhook-meta*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await context.route('**/atendimentos*', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 201, body: '{}' }) : route.continue(),
  );
  // Bloqueia o script real do Pixel (teste não é tráfego real)
  await context.route('**connect.facebook.net/**', (route) => route.fulfill({ status: 200, body: '' }));

  // ── 1. Home carrega e o catálogo aparece ──
  await page.goto('/');
  const grid = page.getByTestId('products-grid');
  await expect(grid).toBeVisible({ timeout: 30_000 });
  const firstCard = page.locator('[data-testid^="product-card-"]').first();
  await expect(firstCard).toBeVisible();

  // ── 2. Abre o primeiro produto pelo botão COMPRAR ──
  await firstCard.getByText('COMPRAR').click();
  await expect(page.getByText('Selecione o Tamanho').first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Escolhe o primeiro tamanho DISPONÍVEL (a grade agora mostra a grade
  // completa da loja: esgotado vem riscado com "Avise-me" e abre modal de lead,
  // não seleção — então pula esses) ──
  const sizeBtn = page.locator('.grid.grid-cols-4 > button:not(:has-text("Avise-me"))').first();
  await sizeBtn.click();

  // ── 4. CTA fixo vira "Adicionar à Sacola" e funciona ──
  const cta = page.getByRole('button', { name: /Adicionar à Sacola/i });
  await expect(cta).toBeEnabled();
  await cta.click();

  // ── 5. Modal "Adicionado ao Carrinho" → ir pro carrinho ──
  await expect(page.getByText('Adicionado ao Carrinho')).toBeVisible();
  await page.getByRole('button', { name: /Ir para o Carrinho/i }).click();

  // ── 6. Sacola mostra total e finaliza ──
  await expect(page.getByText('Sua Sacola')).toBeVisible();
  await expect(page.getByText('Total no Pix')).toBeVisible();
  await page.getByRole('button', { name: /Finalizar Pedido/i }).click();

  // ── 7. Dados de entrega → preenche → finaliza (mockado) ──
  await expect(page.getByText('Dados de Entrega')).toBeVisible();
  await page.getByPlaceholder('Ex: João da Silva').fill('Teste E2E');
  await page.getByPlaceholder('Ex: 34999999999').fill('34999999999');
  await page.getByRole('button', { name: /Finalizar Pedido via WhatsApp/i }).click();

  // ── 8. Tela de sucesso com número do pedido ──
  await expect(page.getByText('Pedido Pronto!')).toBeVisible({ timeout: 15_000 });
  // O nº do pedido é gerado no CLIENTE (5 dígitos) — o mock não o controla.
  await expect(page.getByText(/#\d{5}/)).toBeVisible();
});

test('filtro de categoria e busca não quebram o catálogo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('products-grid')).toBeVisible({ timeout: 30_000 });
  // Loop infinito = 3 cópias; a fileira começa na cópia do MEIO. Clicar num tile
  // da cópia 0 faz o auto-scroll do Playwright disparar o teleporte e o elemento
  // "foge". Solução: clicar num tile da cópia do meio (já visível, estável).
  const tiles = page.locator('[data-testid^="category-filter-"]:not([data-testid="category-filter-KITS"])');
  const perCopy = (await tiles.count()) / 3;
  const catTile = tiles.nth(Math.floor(perCopy)); // 1º tile da cópia do meio
  await catTile.click();
  await expect(page.getByTestId('products-count')).toBeVisible();
  // Clicar de novo desmarca (toggle) e o catálogo continua vivo
  await catTile.click();
  await expect(page.getByTestId('products-grid')).toBeVisible();
});
