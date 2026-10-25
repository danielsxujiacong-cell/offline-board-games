import {Fault} from './service.mjs';
// All uses of the secret stay in the server adapter. No browser imports this module.
export class RestStore{
  constructor(url,key,fetcher=fetch){this.url=url;this.key=key;this.fetcher=fetcher;}
  async request(route,body){
    const response=await this.fetcher(this.url+'/rest/v1/'+route,{method:body===undefined?'GET':'POST',headers:{apikey:this.key,Authorization:'Bearer '+this.key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();
    const data=text?JSON.parse(text):null; // PostgREST returns 204/empty for void RPCs.
    if(!response.ok){const message=data?.message||'';if(/version_conflict/.test(message))throw new Fault('version_conflict',409);if(/request_id_reused/.test(message))throw new Fault('request_id_reused',409);if(/rate_limit|room_limit/.test(message))throw new Fault('rate_limited',429);throw new Error('Database request failed: '+(data?.code||response.status));}
    return data;
  }
  async getRoom(id){return (await this.request(`hanamikoji_rooms?select=document&id=eq.${encodeURIComponent(id)}`))[0]?.document;}
  async findCode(code){return (await this.request(`hanamikoji_rooms?select=document&code=eq.${encodeURIComponent(code)}`))[0]?.document;}
  async receipt(actor,id){return (await this.request(`hanamikoji_commands?select=fingerprint,room_id&actor_id=eq.${actor}&request_id=eq.${id}`))[0];}
  async rateLimit(actor){await this.request('rpc/hanamikoji_rate_limit',{p_actor:actor});}
  async commit({room,expected,actor,requestId,hash,views}){return await this.request('rpc/hanamikoji_commit',{p_room:room,p_expected:expected,p_actor:actor,p_request:requestId,p_fingerprint:hash,p_views:views});}
}
