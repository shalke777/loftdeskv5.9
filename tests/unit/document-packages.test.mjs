import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {preparePackage,listPackages,sendPackage}=require('../../netlify/functions/shared/document-packages.cjs')
const co='00000000-0000-0000-0000-000000000001', pr='00000000-0000-0000-0000-000000000002', est='00000000-0000-0000-0000-000000000003', ct='00000000-0000-0000-0000-000000000004', foreign='00000000-0000-0000-0000-000000000005'
function fixture(){
  const rows={projects:[{id:pr,company_id:co,name:'Łazienka — test'}],companies:[{id:co,name:'Firma',email:'owner@example.test'}],cost_estimates:[{id:est,company_id:co,project_id:pr,number:'WY/1',total_net:100}],contracts:[{id:ct,company_id:co,project_id:pr,estimate_id:est,number:'UM/1',notes:'Zakończenie 27 listopada 2026'}],project_documents:[],cost_estimate_items:[],invoice_items:[]}
  const files=new Map()
  const storage={getBucket:async()=>({data:{public:false}}),from:()=>({
    upload:async(path,body,{upsert})=>{
      if(files.has(path)&&!upsert)return {error:{message:'The resource already exists'}}
      files.set(path,Buffer.from(body));return{data:{path}}
    },
    createSignedUrl:async(path,ttl)=>{assert.ok(files.has(path));assert.equal(ttl,300);return {data:{signedUrl:`https://storage.example.test/${path}?signed=test`}}},
    download:async path=>files.has(path)?{data:new Blob([files.get(path)])}:{error:{message:'not found'}},
    list:async dir=>({data:[...files.keys()].filter(k=>k.startsWith(dir+'/')).map(k=>({name:k.slice(dir.length+1)}))}),
  })}
  const ctx={canWrite:true,companyId:co,sb:{storage,from(table){let filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q},is:(k,v)=>{filters.push(r=>(r[k]??null)===v);return q},order:()=>q,single:async()=>{const data=rows[table]?.filter(r=>filters.every(f=>f(r)))[0];return data?{data:structuredClone(data)}:{error:new Error('not found')}},maybeSingle:async()=>({data:structuredClone(rows[table]?.filter(r=>filters.every(f=>f(r)))[0]||null)}),then(resolve){resolve({data:structuredClone(rows[table]?.filter(r=>filters.every(f=>f(r)))||[])})}};return q}}}
  const render=async s=>s.documents.map(d=>({pdf:Buffer.from(`%PDF-1.4\n${d.row.number}\n%%EOF`)}))
  return {ctx,render,rows,files}
}
process.env.RESEND_API_KEY='test-provider-key'
test('saves a complete immutable package, lists metadata only, and prepares without sending',async()=>{
  const f=fixture(), p=await preparePackage(f.ctx,{project_id:pr},f.render)
  assert.equal(p.documents.length,2);assert.equal(p.status,'ready');assert.ok(p.documents.every(d=>!('base64'in d)))
  assert.equal((await preparePackage(f.ctx,{project_id:pr},f.render)).id,p.id)
  const listed=await listPackages(f.ctx,{project_id:pr})
  assert.equal(listed.packages.length,1)
  assert.ok(listed.packages[0].review_url.includes(`${co}/${pr}/packages/${p.id}.json`))
  assert.equal(listed.packages[0].review_url_expires_in,300)
  assert.equal(f.rows.contracts[0].notes,'Zakończenie 27 listopada 2026')
})
test('tenant boundaries and read-only grants prevent creation and sending',async()=>{
  const f=fixture()
  await assert.rejects(preparePackage({...f.ctx,canWrite:false},{project_id:pr},f.render),/odczytu/)
  await assert.rejects(preparePackage({...f.ctx,companyId:foreign},{project_id:pr},f.render),/not found/)
  f.rows.contracts[0].company_id=foreign
  await assert.rejects(preparePackage(f.ctx,{project_id:pr,documents:[{type:'contract',id:ct}]},f.render),/not found/)
  assert.equal(f.files.size,0)
})
test('an edited contract invalidates the old snapshot and cannot trigger an email',async()=>{
  const f=fixture(),p=await preparePackage(f.ctx,{project_id:pr},f.render)
  f.rows.contracts[0].notes='Changed after export'
  await assert.rejects(sendPackage(f.ctx,{project_id:pr,package_id:p.id,to:'owner@example.test',idempotency_key:'send-test-1'},()=>assert.fail('must not send stale data')),/zmieniły/)
  const next=await preparePackage(f.ctx,{project_id:pr},f.render)
  assert.notEqual(next.id,p.id)
})
test('concurrent retries send both PDFs once, persist provider receipt, and reject key reuse',async()=>{
  const f=fixture(),p=await preparePackage(f.ctx,{project_id:pr},f.render)
  let calls=0
  const provider=async(_,req)=>{calls++;const body=JSON.parse(req.body);assert.equal(body.attachments.length,2);assert.ok(body.attachments.every(d=>Buffer.from(d.content,'base64').subarray(0,5).toString()==='%PDF-'));return{ok:true,json:async()=>({id:'email-test'})}}
  const args={project_id:pr,package_id:p.id,to:'owner@example.test',idempotency_key:'send-test-2'}
  await Promise.all([sendPackage(f.ctx,args,provider),sendPackage(f.ctx,args,provider)])
  const result=await sendPackage(f.ctx,args,provider)
  assert.equal(result.status,'sent');assert.equal(result.provider_id,'email-test');assert.equal(calls,1)
  await assert.rejects(sendPackage(f.ctx,{...args,to:'other@example.test'},provider),/innej wiadomości/)
})
test('ambiguous network failure never becomes sent and never automatically sends again',async()=>{
  const f=fixture(),p=await preparePackage(f.ctx,{project_id:pr},f.render);let calls=0
  const args={project_id:pr,package_id:p.id,to:'owner@example.test',idempotency_key:'send-test-3'}
  const provider=async()=>{calls++;throw new Error('connection dropped')}
  assert.equal((await sendPackage(f.ctx,args,provider)).status,'unknown')
  assert.equal((await sendPackage(f.ctx,args,provider)).status,'unknown');assert.equal(calls,1)
})
test('partial or invalid PDF generation does not save a ready package',async()=>{
  const f=fixture()
  await assert.rejects(preparePackage(f.ctx,{project_id:pr},async()=>[]),/Niekompletny/)
  await assert.rejects(preparePackage(f.ctx,{project_id:pr},async s=>s.documents.map(()=>({pdf:Buffer.from('<html>not a pdf</html>')}))),/PDF/)
  assert.equal(f.files.size,0)
})
