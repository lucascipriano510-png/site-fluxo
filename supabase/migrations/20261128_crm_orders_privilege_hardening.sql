-- Remove privilégios e policies de INSERT legados redundantes em orders.
-- O checkout permanece com INSERT; leitura e escrita administrativa ficam no backend.
DROP POLICY IF EXISTS allow_insert_anon ON public.orders;
DROP POLICY IF EXISTS orders_anon_insert ON public.orders;
REVOKE ALL PRIVILEGES ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.orders TO anon, authenticated;
