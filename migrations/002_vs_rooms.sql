-- 联机房间落库，避免 Vercel 多实例内存互不可见
create table if not exists vs_rooms (
  id text primary key,
  host_id text not null,
  mode text not null,
  map_id text not null,
  ai boolean not null default true,
  max_players integer not null default 2,
  started boolean not null default false,
  next_event_id integer not null default 1,
  last_active bigint not null,
  created_at bigint not null
);

create table if not exists vs_players (
  room_id text not null references vs_rooms(id) on delete cascade,
  id text not null,
  name text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  z double precision not null default 0,
  yaw double precision not null default 0,
  hp double precision not null default 100,
  gun text not null default '',
  dead boolean not null default false,
  ts bigint not null,
  primary key (room_id, id)
);

create table if not exists vs_events (
  room_id text not null references vs_rooms(id) on delete cascade,
  id integer not null,
  type text not null,
  from_id text not null,
  to_id text,
  dmg double precision,
  ts bigint not null,
  primary key (room_id, id)
);

create index if not exists vs_rooms_last_active_idx on vs_rooms (last_active);
create index if not exists vs_events_room_id_idx on vs_events (room_id, id);
