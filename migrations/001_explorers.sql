-- #17 摸金人花名册：名字全局唯一，回访按同名登录
create table if not exists explorers (
  name text not null,
  name_key text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists explorers_created_at_idx on explorers (created_at);
