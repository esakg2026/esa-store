-- SQL-база магазина ESA Store (Postgres / Neon). Сервер выполняет этот файл сам при запуске.
-- Все таблицы магазина начинаются с store_, чтобы не пересекаться с сайтом услуг (esa_kv).
create table if not exists store_kv (
  bucket     text        not null,           -- orders / misc
  key        text        not null,           -- ESS-123456, state/123, rl/...
  value      jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, key)
);
create index if not exists store_kv_updated on store_kv (bucket, updated_at);

-- Удобный просмотр заказов в консоли Neon: select * from store_orders_view;
create or replace view store_orders_view as
select key as id,
       value->>'status'   as status,
       value->>'name'     as name,
       value->>'phone'    as phone,
       value->>'city'     as city,
       value->>'delivery' as delivery,
       jsonb_array_length(coalesce(value->'items', '[]'::jsonb)) as lines,
       value->>'total'    as total,
       to_timestamp((value->>'createdAt')::bigint / 1000.0) as created
from store_kv where bucket = 'orders'
order by created desc;
