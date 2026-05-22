-- Central de Atendimento / WhatsApp CRM — Fase 1
-- Executar no SQL Editor do Supabase

-- 1. Contatos / Leads
create table if not exists crm_contatos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  telefone text not null,
  origem text default 'checkout',
  produto_interesse text,
  pedido_id uuid references orders(id) on delete set null,
  valor_potencial numeric(10,2),
  status text default 'novo',
  prioridade text default 'normal',
  observacoes text,
  criado_em timestamptz default now(),
  ultima_interacao timestamptz default now()
);

-- 2. Atendimentos / Conversas
create table if not exists crm_atendimentos (
  id uuid default gen_random_uuid() primary key,
  contato_id uuid references crm_contatos(id) on delete cascade,
  pedido_id uuid references orders(id) on delete set null,
  canal text default 'whatsapp',
  status text default 'novo',
  responsavel text,
  ultima_mensagem text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 3. Mensagens
create table if not exists crm_mensagens (
  id uuid default gen_random_uuid() primary key,
  atendimento_id uuid references crm_atendimentos(id) on delete cascade,
  direcao text not null check (direcao in ('cliente', 'loja')),
  tipo text default 'sistema' check (tipo in ('texto', 'sistema', 'ia_sugestao')),
  conteudo text not null,
  criado_em timestamptz default now()
);

-- Índices para performance
create index if not exists idx_crm_atendimentos_status on crm_atendimentos(status);
create index if not exists idx_crm_atendimentos_contato on crm_atendimentos(contato_id);
create index if not exists idx_crm_atendimentos_pedido on crm_atendimentos(pedido_id);
create index if not exists idx_crm_mensagens_atendimento on crm_mensagens(atendimento_id);
create index if not exists idx_crm_contatos_telefone on crm_contatos(telefone);

-- RLS
alter table crm_contatos enable row level security;
alter table crm_atendimentos enable row level security;
alter table crm_mensagens enable row level security;

-- crm_contatos: anon pode inserir (criado no checkout), autenticado faz tudo
create policy "anon_insert_crm_contatos" on crm_contatos
  for insert to anon with check (true);

create policy "auth_all_crm_contatos" on crm_contatos
  for all to authenticated using (true) with check (true);

-- crm_atendimentos: anon pode inserir (criado no checkout), autenticado faz tudo
create policy "anon_insert_crm_atendimentos" on crm_atendimentos
  for insert to anon with check (true);

create policy "auth_all_crm_atendimentos" on crm_atendimentos
  for all to authenticated using (true) with check (true);

-- crm_mensagens: anon pode inserir (mensagem inicial do sistema), autenticado faz tudo
create policy "anon_insert_crm_mensagens" on crm_mensagens
  for insert to anon with check (true);

create policy "auth_all_crm_mensagens" on crm_mensagens
  for all to authenticated using (true) with check (true);
