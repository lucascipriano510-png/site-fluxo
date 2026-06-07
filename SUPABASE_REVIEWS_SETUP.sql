create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null,
  customer_phone text not null,
  customer_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique(product_id, customer_phone)
);

create index if not exists idx_reviews_product_id
  on product_reviews(product_id);
create index if not exists idx_reviews_phone
  on product_reviews(customer_phone);

alter table product_reviews enable row level security;
create policy "reviews_select" on product_reviews
  for select using (true);
create policy "reviews_insert" on product_reviews
  for insert with check (true);
