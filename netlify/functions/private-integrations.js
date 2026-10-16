const crypto=require('node:crypto')
const {ownerContext,checked,json}=require('./shared/private-runtime.cjs')
exports.handler=async event=>{
 if(event.httpMethod==='OPTIONS')return json(204,null)
 if(event.httpMethod!=='POST')return json(405,{error:'Use POST'})
 try{
  const ctx=await ownerContext(event),body=JSON.parse(event.body||'{}')
  if(body.action==='status'){
   const account=await checked(ctx.sb.from('private_integrations').select('account_email,last_sync_at').eq('company_id',ctx.companyId).eq('provider','gmail').maybeSingle())
   const jobs=await checked(ctx.sb.from('automation_jobs').select('id,kind,status,result,last_error,created_at').eq('company_id',ctx.companyId).order('created_at',{ascending:false}).limit(30))
   const ksef=await checked(ctx.sb.from('private_ksef_credentials').select('env,refresh_expires_at,last_error').eq('company_id',ctx.companyId).eq('env',process.env.KSEF_ENV||'test').maybeSingle())
   return json(200,{gmail:account,ksef,assistantConfigured:!!process.env.LOFTDESK_ASSISTANT_TOKEN,jobs})
  }
  if(body.action==='download_upo'){
   const invoice=await checked(ctx.sb.from('invoices').select('ksef_upo_path').eq('id',body.invoice_id).eq('company_id',ctx.companyId).single())
   if(!invoice.ksef_upo_path)throw new Error('Urzędowe UPO nie zostało jeszcze pobrane.')
   const signed=await checked(ctx.sb.storage.from('ksef-documents').createSignedUrl(invoice.ksef_upo_path,60))
   return json(200,{url:signed.signedUrl})
  }
  if(body.action==='connect_gmail'){
   if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!process.env.GOOGLE_REDIRECT_URI||!process.env.GMAIL_ACCOUNT_EMAIL)throw new Error('Google OAuth configuration missing')
   const {encrypt}=require('./shared/gmail.cjs');encrypt('configuration-check')
   const state=crypto.randomBytes(32).toString('base64url')
   await checked(ctx.sb.from('integration_oauth_states').insert({state_hash:crypto.createHash('sha256').update(state).digest('hex'),company_id:ctx.companyId,expires_at:new Date(Date.now()+600000).toISOString()}))
   const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:process.env.GOOGLE_REDIRECT_URI,response_type:'code',access_type:'offline',prompt:'consent',state,scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose'})
   return json(200,{url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`})
  }
  if(body.action==='sync_gmail')return json(200,await checked(ctx.sb.rpc('private_enqueue_job',{p_company_id:ctx.companyId,p_kind:'gmail.sync',p_key:`owner-sync/${crypto.randomUUID()}`,p_payload:{}})))
  return json(400,{error:'Unknown action'})
 }catch(e){return json(400,{error:e.message||'Request failed'})}
}
