-- Real project verification. All fixture rows and rate counters are rolled back.
-- Reads one existing auth user only for FK validity; never changes auth.users.
begin;
do $$
declare
 actor uuid;
 rid uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid();
 doc jsonb;
 projection jsonb;
 result uuid;
 rows_seen integer;
begin
 select id into actor from auth.users order by id limit 1;
 if actor is null then raise exception 'verification needs one existing auth user'; end if;
 doc=jsonb_build_object('id',rid,'code','ZZTEST2345','version',0,'users',jsonb_build_array(actor,null),'ready',jsonb_build_array(false,false),'status','waiting','restartRequested',false,'game',1,'state',null,'expiresAt',now()+interval '24 hours');
 projection=jsonb_build_array(jsonb_build_object('user_id',actor,'snapshot',jsonb_build_object('id',rid,'version',0,'seat',0,'status','waiting','board',null)));
 perform set_config('role','service_role',true);
 result=public.hanamikoji_commit(doc,-1,actor,req,repeat('a',64),projection);
 if result<>rid then raise exception 'create failed'; end if;
 if public.hanamikoji_commit(doc,-1,actor,req,repeat('a',64),projection)<>rid then raise exception 'retry failed'; end if;
 begin
  perform public.hanamikoji_commit(doc,-1,actor,req,repeat('b',64),projection);
  raise exception 'mismatched key was allowed';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'request_id_reused' then raise; end if;
 end;
 doc=jsonb_set(doc,'{version}','1');
 projection=jsonb_set(projection,'{0,snapshot,version}','1');
 perform public.hanamikoji_commit(doc,0,actor,gen_random_uuid(),repeat('c',64),projection);
 begin
  perform public.hanamikoji_commit(doc,0,actor,gen_random_uuid(),repeat('d',64),projection);
  raise exception 'stale version was allowed';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'version_conflict' then raise; end if;
 end;
 perform set_config('role','authenticated',true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select count(*) into rows_seen from public.hanamikoji_player_views where room_id=rid;
 if rows_seen<>1 then raise exception 'owner view denied'; end if;
 begin
  perform 1 from public.hanamikoji_rooms limit 1;
  raise exception 'full room was readable';
 exception when insufficient_privilege then null;
 end;
 begin
  update public.hanamikoji_player_views set snapshot='{}' where room_id=rid;
  raise exception 'snapshot was writable';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.hanamikoji_rate_limit(actor);
  raise exception 'internal RPC was callable';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 select count(*) into rows_seen from public.hanamikoji_player_views where room_id=rid;
 if rows_seen<>0 then raise exception 'stranger read owner projection'; end if;
 perform set_config('role','none',true);
end $$;
rollback;
select 'PASS: remote RLS, service-only RPCs, idempotency and CAS; fixture writes rolled back' as verification;
