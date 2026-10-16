import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createServer} from 'node:http'
import {once} from 'node:events'
import vm from 'node:vm'
import * as jose from 'jose'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const owner='00000000-0000-0000-0000-000000000001'
const company='00000000-0000-0000-0000-000000000002'
const jobId='00000000-0000-0000-0000-000000000003'
const resource='https://loftdesk.pl/api/assistant/mcp'
const issuer='https://project.supabase.co/auth/v1'
const env={SUPABASE_URL:'https://project.supabase.co',LOFTDESK_MCP_RESOURCE_URL:resource}
const {publicKey,privateKey}=await jose.generateKeyPair('ES256')
function load(path,deps,extra={}){
  const module={exports:{}}
  vm.runInNewContext(readFileSync(new URL(`../../${path}`,import.meta.url),'utf8'),{module,exports:module.exports,Buffer,URL,URLSearchParams,AbortSignal,console,process:{env},require:name=>{assert.ok(name in deps,`Unexpected dependency ${name}`);return deps[name]},...extra},{filename:path})
  return module.exports
}
async function token(patch={},key=privateKey){
  return new jose.SignJWT({role:'loftdesk_mcp_only',client_id:'chatgpt-client',scope:'email',loftdesk_mcp:true,loftdesk_company_id:company,loftdesk_mcp_version:1,loftdesk_mcp_write:true,...patch})
    .setProtectedHeader({alg:'ES256',kid:'test'}).setIssuer(issuer).setAudience(resource).setSubject(owner).setIssuedAt().setExpirationTime('15m').sign(key)
}
function fixture(){
  let grant={enabled:true,allow_write:true,resource_url:resource,token_version:1}
  const jobs=new Map(),queries=[]
  const ctx={ownerId:owner,companyId:company,sb:{
    from:table=>{
      const filters={}
      const q={select:()=>q,eq:(key,value)=>{filters[key]=value;return q},order:()=>q,limit:()=>q,lt:()=>q,ilike:(field,value)=>{queries.push({field,value});return q},
        maybeSingle:async()=>({data:filters.client_id==='chatgpt-client'?grant:null}),single:async()=>({data:table==='automation_jobs'?jobs.get(filters.id):{id:jobId}}),then:resolve=>{queries.push({table,filters});resolve({data:[]})}}
      return q
    },
    rpc:async(name,args)=>{assert.equal(name,'private_enqueue_job');assert.equal(args.p_company_id,company);if(!jobs.has(jobId))jobs.set(jobId,{id:jobId,status:'queued',kind:args.p_kind});return{data:jobs.get(jobId)}}
  }}
  const runtime={privateContext:async()=>ctx,mcpContext:async()=>ctx,checked:async p=>{const r=await p;if(r.error)throw r.error;return r.data},json:(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)})}
  const auth=load('netlify/functions/shared/mcp-auth.cjs',{'jose':{...jose,createRemoteJWKSet:()=>publicKey},'./private-runtime.cjs':runtime,'./private-owner.cjs':{secretMatches:()=>false}})
  const {handler}=load('netlify/functions/assistant-mcp.js',{'./shared/private-runtime.cjs':runtime,'./shared/mcp-auth.cjs':auth})
  return{auth,handler,jobs,queries,revoke:()=>{grant={...grant,enabled:false,token_version:2}},readOnly:()=>{grant={...grant,allow_write:false}}}
}
const event=(jwt,request,headers={})=>({httpMethod:'POST',headers:{authorization:`Bearer ${jwt}`,...headers},body:JSON.stringify(request)})
test('OAuth verification accepts only signed owner tokens bound to this MCP resource',async()=>{
  const f=fixture(),good=await token()
  assert.equal((await f.auth.authenticate(event(good))).ownerId,owner)
  const wrongKey=await jose.generateKeyPair('ES256')
  await assert.rejects(f.auth.authenticate(event(await token({},wrongKey.privateKey))))
  for(const patch of [{aud:'other'},{iss:'https://other.example/auth/v1'},{sub:jobId},{exp:1},{loftdesk_company_id:'other'},{loftdesk_mcp_version:2},{role:'authenticated'},{client_id:'other'}, {scope:'profile'}]){
    // Standard claims are overridden after signing helper defaults.
    const claims=jose.decodeJwt(await token(patch))
    Object.assign(claims,patch)
    const jwt=await new jose.SignJWT(claims).setProtectedHeader({alg:'ES256'}).sign(privateKey)
    await assert.rejects(f.auth.authenticate(event(jwt)),JSON.stringify(patch))
  }
  f.revoke()
  await assert.rejects(f.auth.authenticate(event(good)))
})
test('unauthenticated MCP returns OAuth discovery challenge without invoking tools',async()=>{
  const f=fixture(),response=await f.handler({httpMethod:'POST',headers:{},body:'{}'})
  assert.equal(response.statusCode,401)
  assert.match(response.headers['WWW-Authenticate'],/resource_metadata="https:\/\/loftdesk.pl\/\.well-known\/oauth-protected-resource\/api\/assistant\/mcp"/)
  assert.equal(f.jobs.size,0)
  assert.equal(f.auth.metadata().authorization_servers[0],issuer)
  assert.equal(f.auth.metadata().resource,resource)
})
test('MCP negotiates versions, handles notifications and rejects malformed requests',async()=>{
  const f=fixture(),jwt=await token()
  const request={jsonrpc:'2.0',id:'init',method:'initialize',params:{protocolVersion:'2025-03-26'}}
  assert.equal(JSON.parse((await f.handler(event(jwt,request))).body).result.protocolVersion,'2025-03-26')
  assert.equal((await f.handler(event(jwt,{jsonrpc:'2.0',method:'notifications/initialized'}))).statusCode,202)
  for(const request of [[{jsonrpc:'2.0',id:1,method:'ping'}],{jsonrpc:'2.0',id:null,method:'ping'},{jsonrpc:'2.0',id:1,method:4}])assert.equal((await f.handler(event(jwt,request))).statusCode,400)
  assert.equal((await f.handler(event(jwt,{jsonrpc:'2.0',id:1,method:'ping'},{'mcp-protocol-version':'9999'}))).statusCode,400)
  assert.equal((await f.handler({...event(jwt,{}),httpMethod:'GET'})).statusCode,405)
})
test('read-only grant hides writes and rejects direct write calls',async()=>{
  const f=fixture(),jwt=await token();f.readOnly()
  const list=JSON.parse((await f.handler(event(jwt,{jsonrpc:'2.0',id:1,method:'tools/list'}))).body)
  assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint))
  const response=JSON.parse((await f.handler(event(jwt,{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'add_note',arguments:{idempotency_key:'test-note-key',content:'Owner note'}}}))).body)
  assert.equal(response.result.isError,true);assert.equal(f.jobs.size,0)
})
test('official MCP SDK connects over HTTP, reads scoped records and tracks queued work',async()=>{
  const f=fixture(),jwt=await token(),requests=[]
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk
    requests.push(req.method)
    try{const result=await f.handler({httpMethod:req.method,headers:req.headers,body});res.writeHead(result.statusCode,result.headers);res.end(result.body)}catch{res.writeHead(500);res.end()}
  })
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const client=new Client({name:'loftdesk-chat-test',version:'1.0.0'})
  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${jwt}`}}}))
    const listed=await client.listTools()
    assert.equal(listed.tools.length,11)
    await client.callTool({name:'list_records',arguments:{entity:'clients'}})
    assert.ok(f.queries.some(q=>q.table==='clients'&&q.filters.company_id===company))
    await client.callTool({name:'search_records',arguments:{entity:'clients',query:'50%_discount'}})
    assert.equal(f.queries.find(q=>q.field==='name').value,'%50\\%\\_discount%')
    await client.callTool({name:'get_document',arguments:{entity:'estimates',id:jobId}})
    assert.ok(f.queries.some(q=>q.table==='cost_estimate_items'&&q.filters.cost_estimate_id===jobId))
    assert.ok(!f.queries.some(q=>q.table==='cost_estimate_items'&&'estimate_id' in q.filters))
    const queued=await client.callTool({name:'add_note',arguments:{idempotency_key:'site-note-20261016',content:'Owner site note'}})
    assert.equal(queued.structuredContent.status,'queued')
    await client.callTool({name:'add_note',arguments:{idempotency_key:'site-note-20261016',content:'Owner site note'}})
    assert.equal(f.jobs.size,1)
    const result=await client.callTool({name:'get_record',arguments:{entity:'jobs',id:jobId}})
    assert.equal(result.structuredContent.record.id,jobId)
  }finally{await client.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  assert.ok(requests.includes('POST'))
})
test('CRM tools validate inputs and respect read-only grants',async()=>{
  for (const [name,args,kind] of [
    ['create_client',{name:'Client',email:'client@example.com'},'client.create'],
    ['create_project',{name:'Bathroom',client_id:jobId},'project.create'],
    ['assign_estimate',{estimate_id:jobId,project_id:jobId},'estimate.assign'],
  ]) {
    const f=fixture(),jwt=await token()
    const request={jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{idempotency_key:'crm-test-key',...args}}}
    let result=JSON.parse((await f.handler(event(jwt,request))).body)
    assert.equal(result.result.structuredContent.kind,kind)
    f.readOnly()
    result=JSON.parse((await f.handler(event(jwt,request))).body)
    assert.equal(result.result.isError,true)
  }
  const f=fixture(),jwt=await token()
  const invalid=JSON.parse((await f.handler(event(jwt,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_client',arguments:{idempotency_key:'crm-test-key',name:'Client',email:'bad email'}}}))).body)
  assert.equal(invalid.error.code,-32602)
  assert.equal(f.jobs.size,0)
})
test('consent callback requires an exact registered HTTPS destination',()=>{
  const {allowedCallback}=load('netlify/functions/mcp-consent.js',{'./shared/private-runtime.cjs':{},'./shared/mcp-auth.cjs':{}})
  const allowed=['https://chatgpt.com/connector_platform_oauth_redirect']
  assert.equal(allowedCallback(`${allowed[0]}?code=one&state=two&iss=issuer`,allowed),true)
  for(const url of ['https://chatgpt.com.evil.test/connector_platform_oauth_redirect','https://chatgpt.com/another','http://chatgpt.com/connector_platform_oauth_redirect','https://chatgpt.com/connector_platform_oauth_redirect?next=evil','https://user@chatgpt.com/connector_platform_oauth_redirect'])assert.equal(allowedCallback(url,allowed),false)
})

test('consent verifies owner, approved client and callback before forwarding approval',async()=>{
  const calls=[],row={client_id:'chatgpt-client',display_name:'Private ChatGPT',resource_url:resource,redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect'],allow_write:true}
  let details={client:{id:'chatgpt-client'},user:{id:owner},scope:'email',redirect_uri:row.redirect_uris[0]}
  const runtime={mcpOwnerContext:async()=>({ownerId:owner,sb:{from:()=>{const q={select:()=>q,eq:()=>q,then:resolve=>resolve({data:[row]})};return q}}}),checked:async p=>(await p).data,json:(statusCode,body)=>({statusCode,body:JSON.stringify(body)})}
  const {handler}=load('netlify/functions/mcp-consent.js',{'./shared/private-runtime.cjs':runtime,'./shared/mcp-auth.cjs':{config:()=>({resource,issuer})}},
    {process:{env:{...env,SUPABASE_ANON_KEY:'public-key'}},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>options.method==='POST'?{redirect_url:`${row.redirect_uris[0]}?code=one&state=two`}:details}}})
  const authorizationId='abcdefghijklmnopqrstuv0123456789'
  const request={httpMethod:'POST',headers:{authorization:'Bearer owner-session',origin:'https://loftdesk.pl'},body:JSON.stringify({action:'approve',authorization_id:authorizationId})}
  assert.equal((await handler(request)).statusCode,200)
  assert.equal(calls.filter(c=>c.options.method==='POST').length,1)
  assert.equal(calls[0].url,`${issuer}/oauth/authorizations/${authorizationId}`)
  for(const invalidId of ['short','../'.repeat(8),'a'.repeat(257),'https://evil.example/consent','abc?next=123456789']){
    calls.length=0
    assert.equal((await handler({...request,body:JSON.stringify({action:'approve',authorization_id:invalidId})})).statusCode,400)
    assert.equal(calls.length,0)
  }
  for(const patch of [{client:{id:'other'}},{user:{id:jobId}},{scope:'email phone'},{redirect_uri:'https://other.example/callback'}]){
    calls.length=0;const before=details;details={...details,...patch}
    assert.equal((await handler(request)).statusCode,400)
    assert.equal(calls.filter(c=>c.options.method==='POST').length,0)
    details=before
  }
  calls.length=0
  assert.equal((await handler({...request,headers:{...request.headers,origin:'https://evil.example'}})).statusCode,403)
  assert.equal(calls.length,0)
})

test('MCP activation keeps legacy private mode off and still requires the exact owner',async()=>{
  let settings={mcp_enabled:true,owner_user_id:owner,company_id:company},userId=owner
  const sb={from:()=>({select:()=>({eq:()=>({single:async()=>({data:settings})})})}),auth:{getUser:async()=>({data:{user:{id:userId}}})}}
  const runtime=load('netlify/functions/shared/private-runtime.cjs',{'@supabase/supabase-js':{createClient:()=>sb},'./private-owner.cjs':{privateOwnerAllowed:()=>true}},
    {process:{env:{...env,SUPABASE_SERVICE_ROLE_KEY:'fixture',LOFTDESK_MCP_ENABLED:'true',LOFTDESK_OWNER_USER_ID:owner,LOFTDESK_COMPANY_ID:company}}})
  assert.equal((await runtime.mcpContext()).ownerId,owner)
  await assert.rejects(runtime.privateContext())
  assert.equal((await runtime.mcpOwnerContext(event('owner-session'))).ownerId,owner)
  userId=jobId
  await assert.rejects(runtime.mcpOwnerContext(event('other-session')),/Owner authentication required/)
  settings={...settings,mcp_enabled:false}
  await assert.rejects(runtime.mcpContext())
  settings={...settings,mcp_enabled:true,company_id:jobId}
  await assert.rejects(runtime.mcpContext())
})

test('static token authentication is disabled unless explicitly enabled',async()=>{
  const runtime={privateContext:async()=>({ownerId:owner,companyId:company})}
  for(const enabled of [undefined,'false','true']){
    const auth=load('netlify/functions/shared/mcp-auth.cjs',{'jose':{...jose,createRemoteJWKSet:()=>publicKey},'./private-runtime.cjs':runtime,'./private-owner.cjs':{secretMatches:(a,b)=>a===b&&!!b}}, {process:{env:{...env,LOFTDESK_ASSISTANT_TOKEN:'admin-token',LOFTDESK_MCP_ALLOW_STATIC_TOKEN:enabled}}})
    if(enabled==='true')assert.equal((await auth.authenticate(event('admin-token'))).clientId,'static-admin')
    else await assert.rejects(auth.authenticate(event('admin-token')))
  }
})
