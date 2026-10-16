const { createHash } = require('node:crypto')
const { checked } = require('./private-runtime.cjs')
const BUCKET = 'assistant-document-packages'
const TABLES = { estimate: 'cost_estimates', contract: 'contracts', invoice: 'invoices' }
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid = value => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value || '')
const safeName = value => String(value).replace(/[\\/:*?"<>|\r\n]/g, '-').slice(0, 100)
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function requireWrite(ctx) { if (!ctx.canWrite) throw new Error('Połączenie ma dostęp tylko do odczytu.') }
async function bucket(ctx) {
  const { data, error } = await ctx.sb.storage.getBucket(BUCKET)
  if (error) {
    if (!['404', '400'].includes(String(error.status || error.statusCode)) || !/not found/i.test(error.message)) throw error
    const created = await ctx.sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20000000, allowedMimeTypes: ['application/json'] })
    if (created.error && !/already exists/i.test(created.error.message)) throw created.error
  } else if (data.public) throw new Error('Archiwum pakietów musi być prywatne.')
  return ctx.sb.storage.from(BUCKET)
}
async function project(ctx, id) {
  if (!uuid(id)) throw new Error('Nieprawidłowy projekt.')
  return checked(ctx.sb.from('projects').select('id,name,client_id').eq('company_id',ctx.companyId).eq('id',id).single())
}
async function loadSources(ctx, projectId, selection) {
  const p = await project(ctx, projectId)
  let refs = selection
  if (!refs) {
    const [estimates, contracts, links] = await Promise.all([
      checked(ctx.sb.from('cost_estimates').select('id').eq('company_id',ctx.companyId).eq('project_id',projectId).order('id')),
      checked(ctx.sb.from('contracts').select('id').eq('company_id',ctx.companyId).eq('project_id',projectId).order('id')),
      checked(ctx.sb.from('project_documents').select('doc_type,doc_id').eq('company_id',ctx.companyId).eq('project_id',projectId).is('archived_at',null)),
    ])
    refs = [...new Map([...estimates.map(d=>({type:'estimate',id:d.id})), ...contracts.map(d=>({type:'contract',id:d.id})), ...links.filter(d=>['estimate','contract'].includes(d.doc_type)).map(d=>({type:d.doc_type,id:d.doc_id}))].map(r=>[`${r.type}/${r.id}`,r])).values()]
  }
  if (!Array.isArray(refs) || !refs.length || refs.length > 10) throw new Error('Wybierz od 1 do 10 dokumentów.')
  refs = refs.map(r=>({type:r.type,id:r.id})).sort((a,b)=>`${a.type}/${a.id}`.localeCompare(`${b.type}/${b.id}`))
  if (new Set(refs.map(r=>`${r.type}/${r.id}`)).size !== refs.length) throw new Error('Powtórzony dokument.')
  const co = await checked(ctx.sb.from('companies').select('*').eq('id',ctx.companyId).single())
  const documents = []
  for (const ref of refs) {
    if (!TABLES[ref.type] || !uuid(ref.id)) throw new Error('Nieprawidłowy dokument.')
    const row = await checked(ctx.sb.from(TABLES[ref.type]).select('*').eq('company_id',ctx.companyId).eq('id',ref.id).single())
    // Both native assignment and explicit project-document links are supported.
    if (row.project_id !== projectId) {
      const link = await checked(ctx.sb.from('project_documents').select('id').eq('company_id',ctx.companyId).eq('project_id',projectId).eq('doc_type',ref.type).eq('doc_id',ref.id).is('archived_at',null).maybeSingle())
      if (!link) throw new Error('Dokument nie należy do tego projektu.')
    }
    const client = row.client_id ? await checked(ctx.sb.from('clients').select('*').eq('company_id',ctx.companyId).eq('id',row.client_id).single()) : null
    if (ref.type === 'estimate' || ref.type === 'invoice') {
      const items = await checked(ctx.sb.from(ref.type==='estimate'?'cost_estimate_items':'invoice_items').select('*').eq(ref.type==='estimate'?'cost_estimate_id':'invoice_id',ref.id).order('sort_order').order('id'))
      row.items = items
    }
    let estimate = null
    if (ref.type === 'contract' && row.estimate_id) estimate = await checked(ctx.sb.from('cost_estimates').select('id,number,name').eq('company_id',ctx.companyId).eq('id',row.estimate_id).single())
    documents.push({type:ref.type,row,client,estimate})
  }
  return {project:p,company:co,documents,refs}
}
const prefix = (ctx,id) => `${ctx.companyId}/${id}`
async function read(store,path) {
  const {data,error}=await store.download(path)
  if (error) throw error
  return JSON.parse(await data.text())
}
async function write(store,path,value,upsert=false) {
  return store.upload(path,Buffer.from(JSON.stringify(value)),{contentType:'application/json',upsert})
}
function summary(p) { return {id:p.id,project_id:p.project_id,name:p.name,created_at:p.created_at,documents:p.documents.map(({type,id,number,filename,sha256,size})=>({type,id,number,filename,sha256,size})),status:'ready'} }
async function preparePackage(ctx,args,render) {
  requireWrite(ctx)
  const sources=await loadSources(ctx,args.project_id,args.documents)
  const fingerprint=hash(sources)
  const id=fingerprint
  const store=await bucket(ctx)
  const path=`${prefix(ctx,args.project_id)}/packages/${id}.json`
  // Content-addressed immutable snapshots. Preparing again cannot overwrite files.
  const files=await render(sources)
  if (files.length!==sources.documents.length) throw new Error('Niekompletny pakiet PDF.')
  let total=0
  const documents=files.map((file,i)=>{
    const pdf=Buffer.from(file.pdf)
    if (pdf.subarray(0,5).toString()!=='%PDF-') throw new Error('Generator nie zwrócił pliku PDF.')
    total+=pdf.length
    return {type:sources.documents[i].type,id:sources.documents[i].row.id,number:sources.documents[i].row.number,filename:safeName(`${sources.documents[i].type}_${sources.documents[i].row.number}`)+'.pdf',sha256:createHash('sha256').update(pdf).digest('hex'),size:pdf.length,base64:pdf.toString('base64')}
  })
  if (total>12000000) throw new Error('Pakiet przekracza limit 12 MB.')
  const snapshot={id,project_id:args.project_id,name:sources.project.name,created_at:new Date().toISOString(),fingerprint,refs:sources.refs,documents}
  const result=await write(store,path,snapshot)
  if (result.error) {
    if (!/already exists|duplicate/i.test(result.error.message)) throw result.error
    const existing=await read(store,path)
    const index=await write(store,`${prefix(ctx,args.project_id)}/index/${id}.json`,summary(existing),true)
    if(index.error)throw index.error
    return summary(existing)
  }
  const index=await write(store,`${prefix(ctx,args.project_id)}/index/${id}.json`,summary(snapshot),true)
  if(index.error)throw index.error
  return summary(snapshot)
}
async function getPackage(ctx,args) {
  await project(ctx,args.project_id)
  if (!/^[a-f\d]{64}$/.test(args.package_id||'')) throw new Error('Nieprawidłowy pakiet.')
  return read(await bucket(ctx),`${prefix(ctx,args.project_id)}/packages/${args.package_id}.json`)
}
async function listPackages(ctx,args) {
  await project(ctx,args.project_id)
  const store=await bucket(ctx), dir=`${prefix(ctx,args.project_id)}/index`
  const {data,error}=await store.list(dir,{limit:50,sortBy:{column:'created_at',order:'desc'}})
  if(error)throw error
  const packages=[]
  for(const file of data) if(/^[a-f\d]{64}\.json$/.test(file.name)) packages.push(await read(store,`${dir}/${file.name}`))
  return {packages}
}
async function sendPackage(ctx,args,fetcher=fetch) {
  requireWrite(ctx)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(args.to||'')) throw new Error('Nieprawidłowy adres odbiorcy.')
  if (typeof args.idempotency_key!=='string'||args.idempotency_key.length<8||args.idempotency_key.length>160) throw new Error('Wymagany stały identyfikator wysyłki.')
  const p=await getPackage(ctx,args)
  const current=await loadSources(ctx,args.project_id,p.refs)
  if(hash(current)!==p.fingerprint) throw new Error('Dokumenty zmieniły się. Przygotuj nowy pakiet przed wysyłką.')
  if(!process.env.RESEND_API_KEY) throw new Error('Wysyłka email nie jest skonfigurowana.')
  const store=await bucket(ctx)
  const path=`${ctx.companyId}/sends/${hash(args.idempotency_key)}.json`
  const intent=hash({package:p.id,to:args.to.toLowerCase(),subject:args.subject||'',message:args.message||''})
  const receipt={status:'sending',intent,package_id:p.id,to:args.to.toLowerCase(),created_at:new Date().toISOString()}
  const lock=await write(store,path,receipt)
  if(lock.error) {
    if(!/already exists|duplicate/i.test(lock.error.message))throw lock.error
    const previous=await read(store,path)
    if(previous.intent!==intent)throw new Error('Ten identyfikator wysyłki został użyty dla innej wiadomości.')
    return previous
  }
  let result
  try {
    const from=process.env.RESEND_FROM_EMAIL||'noreply@mail.loftdesk.pl'
    const resp=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':hash(`${ctx.companyId}/${args.idempotency_key}`)},body:JSON.stringify({from:`LoftDesk <${from}>`,to:[receipt.to],reply_to:current.company.email||undefined,subject:args.subject||`Dokumenty projektu — ${p.name}`,html:`<p>${escape(args.message||'W załączeniu przesyłam dokumenty projektu do wglądu.').replace(/\n/g,'<br>')}</p><ul>${p.documents.map(d=>`<li>${escape(d.number)}</li>`).join('')}</ul>`,attachments:p.documents.map(d=>({filename:d.filename,content:d.base64}))})})
    const body=await resp.json()
    result=resp.ok&&body.id?{...receipt,status:'sent',provider_id:body.id,sent_at:new Date().toISOString()}:{...receipt,status:'failed',error:`Dostawca poczty odrzucił wysyłkę (${resp.status}).`}
  }catch { result={...receipt,status:'unknown',error:'Nie udało się potwierdzić wyniku. Nie ponawiaj z nowym identyfikatorem bez sprawdzenia poczty.'} }
  const saved=await write(store,path,result,true)
  if(saved.error)throw new Error('Wynik wysyłki wymaga sprawdzenia. Nie ponawiaj z nowym identyfikatorem.')
  return result
}
module.exports={loadSources,preparePackage,getPackage,listPackages,sendPackage,summary,hash}
