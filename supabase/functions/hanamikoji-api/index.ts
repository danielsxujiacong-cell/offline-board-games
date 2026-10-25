import {makeHandler} from '../_shared/hanamikoji/service.mjs';
import {RestStore} from '../_shared/hanamikoji/rest-store.mjs';

const url=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=(Deno.env.get('HANAMIKOJI_ALLOWED_ORIGINS')||'https://games.danielxu.cn,http://127.0.0.1:8080,http://localhost:8080').split(',').map(s=>s.trim());
const handler=makeHandler({store:new RestStore(url,secret),origins,authenticate:async(token:string)=>{
  const response=await fetch(url+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+token}});
  if(!response.ok)return null;
  const user=await response.json();return user.id; // Verified by Supabase Auth, never decoded or trusted from request data.
}});
Deno.serve(handler);
