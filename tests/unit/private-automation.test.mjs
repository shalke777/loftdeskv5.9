import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
function load(path,deps={},globals={}){
 const module={exports:{}}
 vm.runInNewContext(readFileSync(new URL(`../../${path}`,import.meta.url),'utf8'),{
  module,exports:module.exports,Buffer,URLSearchParams,AbortSignal,Date,
  console:{log(){},warn(){},error(){}},process:{env:{}},
  require(name){if(name==='node:crypto')return crypto;assert.ok(name in deps,`Unexpected dependency ${name}`);return deps[name]},...globals,
 },{filename:path})
 return module.exports
}
const key=crypto.randomBytes(32).toString('base64')
const gmail=()=>load('netlify/functions/shared/gmail.cjs',{'./private-runtime.cjs':{checked:async p=>{const r=await p;if(r.error)throw r.error;return r.data}}},{process:{env:{LOFTDESK_ENCRYPTION_KEY:key}}})
test('Gmail refresh token encryption authenticates ciphertext',()=>{
 const g=gmail(),encrypted=g.encrypt('refresh-token')
 assert.equal(g.decrypt(encrypted),'refresh-token')
 const damaged=Buffer.from(encrypted,'base64');damaged[15]^=1
 assert.throws(()=>g.decrypt(damaged.toString('base64')))
 assert.notEqual(g.encrypt('refresh-token'),encrypted)
})
test('missing encryption configuration fails closed',()=>{
 const g=load('netlify/functions/shared/gmail.cjs',{'./private-runtime.cjs':{}},{process:{env:{}}})
 assert.throws(()=>g.encrypt('secret'))
})
test('email header injection is rejected before contacting Gmail',async()=>{
 await assert.rejects(gmail().draft({}, {to:'client@example.com\r\nBcc:other@example.com',subject:'Offer',body:'Body'}),/recipient/)
 await assert.rejects(gmail().draft({}, {to:'client@example.com',subject:'Offer\nBcc:other@example.com',body:'Body'}),/content/)
})
test('private mode accepts only the configured owner',()=>{
 const {privateOwnerAllowed,secretMatches}=load('netlify/functions/shared/private-owner.cjs',{}, {process:{env:{LOFTDESK_PRIVATE_MODE:'true',LOFTDESK_OWNER_USER_ID:'owner'}}})
 assert.equal(privateOwnerAllowed('owner'),true);assert.equal(privateOwnerAllowed('other'),false)
 assert.equal(secretMatches('same','same'),true);assert.equal(secretMatches('same','different'),false);assert.equal(secretMatches('',''),false)
})
function mcp(){
 const calls=[]
 const handler=load('netlify/functions/assistant-mcp.js',{
  './shared/private-runtime.cjs':{privateContext:async()=>({companyId:'company',sb:{rpc:(name,args)=>{calls.push({name,args});return{data:{id:'job',status:'queued'}}}}}),checked:async p=>(await p).data,json:(statusCode,body)=>({statusCode,body:JSON.stringify(body)})},
  './shared/mcp-auth.cjs':{authenticate:async event=>{if(event.headers?.authorization!=='Bearer private-key')throw new Error('Unauthorized');return{companyId:'company',canWrite:true,sb:{rpc:(name,args)=>{calls.push({name,args});return{data:{id:'job',status:'queued'}}}}}},challenge:()=> 'Bearer resource_metadata="https://loftdesk.pl/.well-known/oauth-protected-resource"'},
 },{process:{env:{LOFTDESK_ASSISTANT_TOKEN:'private-key'}}}).handler
 return{handler,calls}
}
const event=(method,args,headers={})=>({httpMethod:'POST',headers:{authorization:'Bearer private-key',...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:args})})
test('MCP rejects absent credentials and foreign browser origins',async()=>{
 const {handler}=mcp()
 assert.equal((await handler({...event('tools/list'),headers:{}})).statusCode,401)
 assert.equal((await handler(event('tools/list',{}, {origin:'https://foreign.example'}))).statusCode,403)
})
test('MCP initializes and advertises tools without exposing credentials',async()=>{
 const {handler}=mcp()
 const init=JSON.parse((await handler(event('initialize'))).body)
 assert.equal(init.result.serverInfo.name,'loftdesk-private')
 const listed=JSON.parse((await handler(event('tools/list'))).body)
 assert.ok(listed.result.tools.some(t=>t.name==='prepare_estimate'))
 assert.ok(!JSON.stringify(listed).includes('private-key'))
})
test('MCP queues a draft with the same caller idempotency key',async()=>{
 const {handler,calls}=mcp()
 const args={idempotency_key:'stable-key-123',name:'Bathroom',items:[{name:'Stage',quantity:1,unit_price:1000,vat_rate:8}]}
 await handler(event('tools/call',{name:'prepare_estimate',arguments:args}))
 assert.equal(calls.length,1);assert.equal(calls[0].args.p_key,'stable-key-123');assert.equal(calls[0].args.p_company_id,'company');assert.equal(calls[0].args.p_kind,'estimate.draft')
})
test('MCP validates money values before enqueuing a write',async()=>{
 const {handler,calls}=mcp()
 const response=JSON.parse((await handler(event('tools/call',{name:'prepare_estimate',arguments:{idempotency_key:'stable-key-123',name:'Offer',items:[{name:'Invalid',quantity:1,unit_price:'NaN',vat_rate:8}]}}))).body)
 assert.equal(response.error.code,-32602);assert.equal(calls.length,0)
})
test('KSeF status reads do not exhaust the ten-write submission budget',async()=>{
 const sb={auth:{getUser:async()=>({data:{user:{id:'owner'}}})}}
 const {requireKsefAccess}=load('netlify/functions/ksef-auth.js',{
  '@supabase/supabase-js':{createClient:()=>sb},
  './shared/private-owner.cjs':{privateOwnerAllowed:id=>id==='owner',isPrivateMode:()=>true},
 },{process:{env:{SUPABASE_URL:'https://project.example',SUPABASE_SERVICE_ROLE_KEY:'key'}}})
 for(let i=0;i<20;i++)assert.equal((await requireKsefAccess({headers:{authorization:'Bearer jwt'}},{readOnly:true})).error,null)
 for(let i=0;i<10;i++)assert.equal((await requireKsefAccess({headers:{authorization:'Bearer jwt'}})).error,null)
 assert.equal((await requireKsefAccess({headers:{authorization:'Bearer jwt'}})).status,429)
})
test('KSeF authorization refuses an unconfigured server',async()=>{
 const {requireKsefAccess}=load('netlify/functions/ksef-auth.js',{'@supabase/supabase-js':{},'./shared/private-owner.cjs':{}})
 assert.equal((await requireKsefAccess({headers:{}})).status,503)
})
test('an ambiguous Gmail draft failure is not automatically retried',async()=>{
 const updates=[]
 const query={update(data){updates.push(data);return this},eq(){return this},then(resolve){resolve({data:null})}}
 const {handler}=load('netlify/functions/private-automation-worker.js',{
  './shared/private-runtime.cjs':{privateContext:async()=>({companyId:'company',sb:{from:()=>query,rpc:async()=>({data:[{id:'job',kind:'gmail.draft',lease_id:'lease',attempts:1,payload:{}}]})}}),checked:async p=>(await p).data},
  './shared/gmail.cjs':{draft:async()=>{throw new Error('Network timeout after request')}}
 },{process:{env:{LOFTDESK_AUTOMATION_ENABLED:'true'}}})
 await handler()
 assert.equal(updates[0].status,'unknown')
})

test('closing an invoice session does not revoke authentication before status verification',async()=>{
 const urls=[]
 const {handler}=load('netlify/functions/ksef-session.js',{
  crypto,
  './ksef-http':{ksefFetch:async url=>{urls.push(url);return{ok:true,status:200,json:()=>({})}}},
  './ksef-mock':{},'./ksef-auth':{requireKsefAccess:async()=>({error:null})},
 })
 const result=await handler({httpMethod:'POST',headers:{},body:JSON.stringify({action:'close',sessionToken:'token',referenceNumber:'session-ref',env:'test'})})
 assert.equal(result.statusCode,200);assert.equal(urls.length,1);assert.ok(urls[0].endsWith('/sessions/online/session-ref/close'))
})
for(const code of [100,200,450]){
 test(`server reconciliation never resubmits and persists final state/UPO: ${code}`,async()=>{
  const g=gmail(),writes=[],requests=[],uploads=[]
  const credential={encrypted_access_token:g.encrypt('access'),encrypted_refresh_token:g.encrypt('refresh'),access_expires_at:new Date(Date.now()+3600000).toISOString()}
  const original={id:'invoice',company_id:'company',ksef_ref:'original-ref',ksef_session_ref:'original-session',ksef_number:null,ksef_upo_path:null}
  const query=table=>({
   select(){return this},eq(){return this},not(){return this},in(){return this},or(){return this},order(){return this},limit(){return this},
   maybeSingle:async()=>({data:original}),single:async()=>({data:credential}),
   update(data){writes.push({table,data});return this},then(resolve){resolve({data:null})},
  })
  const {reconcileOne}=load('netlify/functions/shared/ksef-reconciliation.cjs',{
   './private-runtime.cjs':{checked:async p=>{const r=await p;if(r.error)throw r.error;return r.data}},
   './gmail.cjs':{encrypt:g.encrypt,decrypt:g.decrypt},
  },{fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({status:{code},ksefNumber:code===200?'official-number':null}),text:async()=>'<UPO>signed MF document</UPO>'}}})
  await reconcileOne({companyId:'company',sb:{from:query,storage:{from:()=>({upload:async(...args)=>{uploads.push(args);return{data:{}}}})}}},'test')
  const patch=writes.find(w=>w.table==='invoices').data
  assert.ok(requests.every(r=>r.options.method==='GET'))
  assert.ok(requests[0].url.includes('/original-session/invoices/original-ref'))
  assert.equal(patch.ksef_status,code===200?'ksef_sent':code===450?'ksef_error':'ksef_pending')
  if(code===200){assert.equal(patch.ksef_number,'official-number');assert.equal(patch.ksef_upo_path,'company/invoice/upo.xml');assert.equal(uploads.length,1);assert.ok(patch.ksef_upo_sha256)}
  else assert.equal(uploads.length,0)
 })
}

test('Gmail text and attachment metadata are decoded without executing message content',()=>{
 const g=gmail()
 assert.equal(g.textPart({mimeType:'multipart/mixed',parts:[{mimeType:'text/plain',body:{data:Buffer.from('Mail content').toString('base64url')}},{filename:'plan.pdf',mimeType:'application/pdf',body:{attachmentId:'att',size:100}}]}),'Mail content')
 assert.equal(g.attachments({parts:[{filename:'plan.pdf',mimeType:'application/pdf',body:{attachmentId:'att',size:100}}]})[0].attachmentId,'att')
})

test('Gmail pagination stores the cursor without advancing the completed sync window',async()=>{
 const writes=[],imports=[]
 const query={select(){return this},eq(){return this},single:async()=>({data:{encrypted_refresh_token:g.encrypt('refresh')}}),update(data){writes.push(data);return this},upsert(data){imports.push(data);return this},then(resolve){resolve({data:null})}}
 const g=load('netlify/functions/shared/gmail.cjs',{'./private-runtime.cjs':{checked:async p=>(await p).data}},{process:{env:{LOFTDESK_ENCRYPTION_KEY:key}},fetch:async url=>({ok:true,json:async()=>url.includes('oauth2.googleapis.com')?{access_token:'access'}:url.includes('/messages?')?{messages:[{id:'message'}],nextPageToken:'next-page'}:{id:'message',threadId:'thread',internalDate:'1792080000000',payload:{mimeType:'text/plain',headers:[{name:'From',value:'Client <client@example.com>'},{name:'Subject',value:'Quote'}],body:{data:Buffer.from('Please prepare an offer').toString('base64url')}}}})})
 const result=await g.sync({companyId:'company',sb:{from:()=>query}})
 assert.equal(result.more,true);assert.equal(imports[0][0].body,'Please prepare an offer')
 assert.equal(writes.at(-1).sync_page_token,'next-page');assert.equal(writes.at(-1).last_sync_at,undefined)
})

test('a failed Gmail message read does not advance the sync cursor',async()=>{
 const writes=[]
 const query={select(){return this},eq(){return this},single:async()=>({data:{encrypted_refresh_token:g.encrypt('refresh')}}),update(data){writes.push(data);return this},then(resolve){resolve({data:null})}}
 const g=load('netlify/functions/shared/gmail.cjs',{'./private-runtime.cjs':{checked:async p=>(await p).data}},{process:{env:{LOFTDESK_ENCRYPTION_KEY:key}},fetch:async url=>({ok:!url.includes('/messages/message?'),status:503,json:async()=>url.includes('oauth2.googleapis.com')?{access_token:'access'}:{messages:[{id:'message'}]}})})
 await assert.rejects(g.sync({companyId:'company',sb:{from:()=>query}}))
 assert.equal(writes.length,1);assert.equal(writes[0].last_sync_at,undefined);assert.equal(writes[0].sync_page_token,undefined)
})
