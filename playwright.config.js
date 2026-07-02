// E2E do caixa (Playwright). Roda contra `vite preview` local (dist buildado).
// Leituras batem no Supabase REAL (só SELECT de produtos); a criação do pedido
// e o webhook da Meta são MOCKADOS no teste — nada de dado falso em produção.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
  },
  projects: [
    // Mobile primeiro: é onde a loja vende.
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run preview',
    port: 5000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
