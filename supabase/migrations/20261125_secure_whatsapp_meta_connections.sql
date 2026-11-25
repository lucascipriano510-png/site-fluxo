-- Corrige os privilégios herdados dos grants padrão do schema public.
-- A tabela contém token Meta cifrado e deve ser acessível só pelo backend.
REVOKE ALL ON TABLE public.whatsapp_meta_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_meta_connections TO service_role;
