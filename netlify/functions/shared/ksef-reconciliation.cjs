const crypto=require('node:crypto')
const {checked}=require('./private-runtime.cjs')
const {encrypt,decrypt}=require('./gmail.cjs')
const BASE={test:'https://api-test.ksef.mf.gov.pl/v2',demo:'https://api-demo.ksef.mf.gov.pl/v2',prod:'https://api.ksef.mf.gov.pl/v2'}
async function request(url,token,method='GET',xml=false){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,Accept:xml?'application/xml':'application/json'},signal:AbortSignal.timeout(8000)})
 if(!response.ok)throw new Error(`KSeF request failed (${response.status})`)
 return xml?response.text():response.json()
}
async function reconcileOne(ctx,env){
 if(!BASE[env])throw new Error('KSeF environment is not configured')
 const invoice=await checked(ctx.sb.from('invoices').select('id,company_id,ksef_ref,ksef_session_ref,ksef_number,ksef_upo_path')
 .eq('company_id',ctx.companyId).eq('ksef_env',env).not('ksef_ref','is',null).not('ksef_session_ref','is',null)
 .in('ksef_status',['ksef_pending','ksef_sent']).or('ksef_number.is.null,ksef_upo_path.is.null')
 .order('ksef_checked_at',{ascending:true,nullsFirst:true}).limit(1).maybeSingle())
 if(!invoice)return{checked:false}
 let patch={ksef_checked_at:new Date().toISOString()}
 try{
  const credential=await checked(ctx.sb.from('private_ksef_credentials').select('*').eq('company_id',ctx.companyId).eq('env',env).single())
  let token=decrypt(credential.encrypted_access_token)
  if(!credential.access_expires_at||Date.parse(credential.access_expires_at)<Date.now()+60000){
   const refreshed=await request(`${BASE[env]}/auth/token/refresh`,decrypt(credential.encrypted_refresh_token),'POST')
   token=refreshed.accessToken?.token
   if(!token)throw new Error('KSeF did not return a refreshed token')
   await checked(ctx.sb.from('private_ksef_credentials').update({encrypted_access_token:encrypt(token),access_expires_at:refreshed.accessToken.validUntil,last_error:null,updated_at:new Date().toISOString()}).eq('company_id',ctx.companyId).eq('env',env))
  }
  const route=`${BASE[env]}/sessions/${encodeURIComponent(invoice.ksef_session_ref)}/invoices/${encodeURIComponent(invoice.ksef_ref)}`
  const status=await request(route,token)
  const code=typeof status.status?.code==='number'?status.status.code:null
  patch.ksef_status_code=code
  if(code===200&&status.ksefNumber){
   patch={...patch,ksef_status:'ksef_sent',ksef_number:status.ksefNumber,ksef_last_error:null}
   if(!invoice.ksef_upo_path){
    try{
     const xml=await request(`${route}/upo`,token,'GET',true)
     if(!xml.trim().startsWith('<')||Buffer.byteLength(xml)>5242880)throw new Error('Invalid UPO XML')
     const path=`${ctx.companyId}/${invoice.id}/upo.xml`
     await checked(ctx.sb.storage.from('ksef-documents').upload(path,xml,{contentType:'application/xml',upsert:true}))
     patch.ksef_upo_path=path;patch.ksef_upo_sha256=crypto.createHash('sha256').update(xml).digest('hex')
    }catch{patch.ksef_last_error='Faktura przyjęta. Pobranie urzędowego UPO wymaga ponowienia.'}
   }
  }else if(code!=null&&code>=400){patch={...patch,ksef_status:'ksef_error',ksef_last_error:`KSeF: ${code} ${status.status?.description||''}`.trim()}}
  else if(!invoice.ksef_number){patch={...patch,ksef_status:'ksef_pending',ksef_last_error:null}}
  await checked(ctx.sb.from('private_ksef_credentials').update({last_error:null}).eq('company_id',ctx.companyId).eq('env',env))
 }catch(e){
  patch.ksef_last_error=e.message||'KSeF verification unavailable'
  await checked(ctx.sb.from('private_ksef_credentials').update({last_error:patch.ksef_last_error}).eq('company_id',ctx.companyId).eq('env',env))
 }
 await checked(ctx.sb.from('invoices').update(patch).eq('id',invoice.id).eq('company_id',ctx.companyId))
 return{checked:true,invoiceId:invoice.id}
}
module.exports={reconcileOne}
