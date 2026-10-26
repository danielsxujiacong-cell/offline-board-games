-- Additive only. No changes to any existing game table, RPC, data, or policies.
create table public.wavelength_rooms (
 id uuid primary key,
 code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 guest_id uuid references auth.users(id) on delete cascade,
 version bigint not null check (version >= 0),
 status text not null check (status in ('waiting','playing','closed')),
 document jsonb not null,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now(),
 check (host_id is distinct from guest_id)
);
create index wavelength_rooms_host_idx on public.wavelength_rooms(host_id,expires_at) where status <> 'closed';
create index wavelength_rooms_guest_idx on public.wavelength_rooms(guest_id) where guest_id is not null;

create table public.wavelength_player_views (
 room_id uuid not null references public.wavelength_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 version bigint not null,
 snapshot jsonb not null,
 expires_at timestamptz not null,
 primary key(room_id,user_id)
);
create index wavelength_player_views_owner_idx on public.wavelength_player_views(user_id,room_id);
create table public.wavelength_commands (
 actor_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 room_id uuid not null references public.wavelength_rooms(id) on delete cascade,
 fingerprint text not null check (length(fingerprint)=64),
 created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
create index wavelength_commands_room_idx on public.wavelength_commands(room_id);
create table public.wavelength_rate_limits (
 actor_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 requests integer not null
);

alter table public.wavelength_rooms enable row level security;
alter table public.wavelength_player_views enable row level security;
alter table public.wavelength_commands enable row level security;
alter table public.wavelength_rate_limits enable row level security;
revoke all on public.wavelength_rooms,public.wavelength_player_views,public.wavelength_commands,public.wavelength_rate_limits from public,anon,authenticated;
grant all on public.wavelength_rooms,public.wavelength_player_views,public.wavelength_commands,public.wavelength_rate_limits to service_role;
grant select on public.wavelength_player_views to authenticated;
create policy wavelength_owner_read on public.wavelength_player_views for select to authenticated
 using ((select auth.uid())=user_id and expires_at>now());
-- Authoritative rooms, commands and rate limits intentionally have no client policies.

create function public.wavelength_rate_limit(p_actor uuid) returns void
 language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
 insert into public.wavelength_rate_limits(actor_id,window_start,requests)
 values(p_actor,date_trunc('minute',now()),1)
 on conflict(actor_id) do update set
  requests=case when wavelength_rate_limits.window_start=date_trunc('minute',now()) then wavelength_rate_limits.requests+1 else 1 end,
  window_start=date_trunc('minute',now()) returning requests into total;
 if total>90 then raise exception 'rate_limit' using errcode='P0001'; end if;
end $$;
revoke all on function public.wavelength_rate_limit(uuid) from public,anon,authenticated;
grant execute on function public.wavelength_rate_limit(uuid) to service_role;

create function public.wavelength_commit(p_room jsonb,p_expected bigint,p_actor uuid,p_request uuid,p_fingerprint text,p_views jsonb) returns uuid
 language plpgsql security invoker set search_path='' as $$
declare
 old public.wavelength_rooms%rowtype;
 receipt public.wavelength_commands%rowtype;
 rid uuid := (p_room->>'id')::uuid;
 host uuid := (p_room->'users'->>0)::uuid;
 guest uuid := (p_room->'users'->>1)::uuid;
 v jsonb;
 seen uuid[] := '{}';
 uid uuid;
begin
 -- Serialize the same idempotency key even across different Edge isolates.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request::text,0));
 select * into receipt from public.wavelength_commands where actor_id=p_actor and request_id=p_request;
 if found then
  if receipt.fingerprint<>p_fingerprint then raise exception 'request_id_reused' using errcode='P0001'; end if;
  return receipt.room_id;
 end if;
 if p_expected=-1 then
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,1));
  if host<>p_actor or guest is not null or (p_room->>'version')::bigint<>0 then raise exception 'invalid_create'; end if;
  if (select count(*) from public.wavelength_rooms where host_id=p_actor and status<>'closed' and expires_at>now())>=3 then raise exception 'room_limit'; end if;
  insert into public.wavelength_rooms(id,code,host_id,guest_id,version,status,document,expires_at)
  values(rid,p_room->>'code',host,guest,0,p_room->>'status',p_room,(p_room->>'expiresAt')::timestamptz);
 else
  select * into old from public.wavelength_rooms where id=rid for update;
  if not found or old.version<>p_expected then raise exception 'version_conflict' using errcode='P0001'; end if;
  if old.expires_at<=now() or old.status='closed' then raise exception 'room_unavailable'; end if;
  if (p_room->>'version')::bigint<>p_expected+1 or host<>old.host_id or p_room->>'code'<>old.code then raise exception 'invalid_update'; end if;
  if old.guest_id is not null and guest is distinct from old.guest_id then raise exception 'invalid_member_change'; end if;
  if p_actor<>old.host_id and p_actor is distinct from old.guest_id then
   if old.status<>'waiting' or old.guest_id is not null or guest is distinct from p_actor then raise exception 'not_member'; end if;
  end if;
  update public.wavelength_rooms set guest_id=guest,version=p_expected+1,status=p_room->>'status',document=p_room,updated_at=now() where id=rid;
 end if;
 -- Full state and both owner-only projections change in the SAME transaction.
 for v in select value from jsonb_array_elements(p_views) loop
  uid=(v->>'user_id')::uuid;
  if uid is null or (uid is distinct from host and uid is distinct from guest) or uid=any(seen) then raise exception 'invalid_projection_owner'; end if;
  if v->'snapshot'->>'id'<>rid::text or (v->'snapshot'->>'version')::bigint<>(p_room->>'version')::bigint then raise exception 'invalid_projection_version'; end if;
  seen=array_append(seen,uid);
  insert into public.wavelength_player_views(room_id,user_id,version,snapshot,expires_at)
  values(rid,uid,(p_room->>'version')::bigint,v->'snapshot',(p_room->>'expiresAt')::timestamptz)
  on conflict(room_id,user_id) do update set version=excluded.version,snapshot=excluded.snapshot,expires_at=excluded.expires_at;
 end loop;
 if cardinality(seen)<>(case when guest is null then 1 else 2 end) then raise exception 'missing_projection'; end if;
 insert into public.wavelength_commands(actor_id,request_id,room_id,fingerprint) values(p_actor,p_request,rid,p_fingerprint);
 return rid;
end $$;
revoke all on function public.wavelength_commit(jsonb,bigint,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.wavelength_commit(jsonb,bigint,uuid,uuid,text,jsonb) to service_role;

-- Only the per-owner projection participates in Realtime; never publish full state.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wavelength_player_views') then
  alter publication supabase_realtime add table public.wavelength_player_views;
 end if;
end $$;
