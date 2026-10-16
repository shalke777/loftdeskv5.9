const {mcpOwnerContext,checked,json}=require('./shared/private-runtime.cjs')
const {config}=require('./shared/mcp-auth.cjs')
function allowedCallback(url,uris){
  try{
    const parsed=new URL(url)
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)return false
    for(const key of ['code','state','iss','error','error_description','error_uri'])parsed.searchParams.delete(key)
    return uris.some(uri=>new URL(uri).href===parsed.href)
  }catch{return false}
}
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return json(204,null)
  if(event.httpMethod!=='POST')return json(405,{error:'Use POST'})
  if((event.body||'').length>8000)return json(413,{error:'Request too large'})
  try{
    const c=config(),origin=event.headers?.origin||event.headers?.Origin
    if(origin&&origin!==new URL(c.resource).origin)return json(403,{error:'Origin not allowed'})
    const ctx=await mcpOwnerContext(event)
    const input=JSON.parse(event.body||'{}')
    if(input.action==='list')return json(200,{resource:c.resource,clients:await checked(ctx.sb.from('private_mcp_clients').select('client_id,display_name,enabled,allow_write').order('created_at'))})
    if(input.action==='revoke'){
      const row=await checked(ctx.sb.from('private_mcp_clients').select('token_version').eq('client_id',input.client_id).single())
      // Immediate denial on every MCP call, including already issued JWTs.
      await checked(ctx.sb.from('private_mcp_clients').update({enabled:false,token_version:row.token_version+1}).eq('client_id',input.client_id))
      return json(200,{revoked:true})
    }
    if(!['details','approve','deny'].includes(input.action)||typeof input.authorization_id!=='string'||!/^[a-f\d-]{36}$/i.test(input.authorization_id))return json(400,{error:'Invalid authorization request'})
    const auth=event.headers?.authorization||event.headers?.Authorization
    const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY
    if(!key)throw new Error('OAuth public API key missing')
    const endpoint=`${c.issuer}/oauth/authorizations/${input.authorization_id}`
    const request=async(url,body)=>{
      const response=await fetch(url,{method:body?'POST':'GET',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'})
      if(!response.ok)throw new Error('Żądanie zgody wygasło lub OAuth nie jest skonfigurowany. Rozpocznij połączenie ponownie w ChatGPT.')
      return response.json()
    }
    const details=await request(endpoint)
    const clients=await checked(ctx.sb.from('private_mcp_clients').select('client_id,display_name,resource_url,redirect_uris,allow_write').eq('enabled',true).eq('resource_url',c.resource))
    if(details.redirect_url){
      const client=clients.find(row=>allowedCallback(details.redirect_url,row.redirect_uris))
      if(!client)throw new Error('Nieznany adres powrotu OAuth.')
      return json(200,{redirect_url:details.redirect_url,client_name:client.display_name,allow_write:client.allow_write})
    }
    const client=clients.find(row=>row.client_id===details.client?.id)
    if(!client||details.user?.id!==ctx.ownerId||!client.redirect_uris.includes(details.redirect_uri))throw new Error('To połączenie nie jest dozwolone dla prywatnego LoftDesk.')
    if((details.scope||'').split(' ').some(scope=>scope!=='email'))throw new Error('Nieobsługiwany zakres OAuth. Dla tego połączenia użyj wyłącznie email.')
    if(input.action==='details')return json(200,{client_name:client.display_name,allow_write:client.allow_write,scope:details.scope})
    const result=await request(`${endpoint}/consent`,{action:input.action})
    if(!allowedCallback(result.redirect_url,client.redirect_uris))throw new Error('Nieprawidłowy adres powrotu OAuth.')
    return json(200,{redirect_url:result.redirect_url})
  }catch(e){return json(400,{error:e instanceof Error?e.message:'Nie udało się potwierdzić dostępu.'})}
}
exports.allowedCallback=allowedCallback
