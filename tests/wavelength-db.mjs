import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Fault} from '../supabase/functions/_shared/wavelength/service.mjs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function database(){
 const {PGlite}=require(path.join(process.env.WAVELENGTH_TOOLS||path.join(root,'.openai/wavelength-tools/node_modules'),'@electric-sql/pglite'));
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile(path.join(root,'supabase/migrations/20261026044421_wavelength_online.sql'),'utf8'));
 const store=new SQLStore(db);return {db,store};
}
export class SQLStore{
 constructor(db){this.db=db;this.listeners=new Set();}
 async getRoom(id){return (await this.db.query('select document from public.wavelength_rooms where id=$1',[id])).rows[0]?.document;}
 async findCode(code){return (await this.db.query('select document from public.wavelength_rooms where code=$1',[code])).rows[0]?.document;}
 async receipt(actor,id){return (await this.db.query('select fingerprint,room_id from public.wavelength_commands where actor_id=$1 and request_id=$2',[actor,id])).rows[0];}
 async rateLimit(actor){try{await this.db.query('select public.wavelength_rate_limit($1)',[actor]);}catch(e){if(/rate_limit/.test(e.message))throw new Fault('rate_limited',429);throw e;}}
 async commit({room,expected,actor,requestId,hash,views}){
  try{
   const result=await this.db.transaction(async tx=>{await tx.exec('set local role service_role');return await tx.query('select public.wavelength_commit($1::jsonb,$2::bigint,$3::uuid,$4::uuid,$5,$6::jsonb) as id',[JSON.stringify(room),expected,actor,requestId,hash,JSON.stringify(views)]);});
   for(const listener of this.listeners)listener(room.id);
   return result.rows[0].id;
  }catch(e){if(/version_conflict|request_id_reused/.test(e.message))throw new Fault(e.message,409);if(/room_limit/.test(e.message))throw new Fault('rate_limited',429);throw e;}
 }
}
