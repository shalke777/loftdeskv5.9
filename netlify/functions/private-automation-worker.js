const {mcpContext,checked}=require('./shared/private-runtime.cjs')
exports.handler=async()=>{
 if(process.env.LOFTDESK_AUTOMATION_ENABLED!=='true')return{statusCode:200,body:'disabled'}
 const ctx=await mcpContext()
 if(process.env.GMAIL_SYNC_ENABLED==='true'){
  const account=await checked(ctx.sb.from('private_integrations').select('last_sync_at').eq('company_id',ctx.companyId).eq('provider','gmail').maybeSingle())
  if(account&&(!account.last_sync_at||Date.now()-Date.parse(account.last_sync_at)>120000)){
   const waiting=await checked(ctx.sb.from('automation_jobs').select('id').eq('company_id',ctx.companyId).eq('kind','gmail.sync').in('status',['queued','running']).limit(1))
   if(!waiting.length)await checked(ctx.sb.rpc('private_enqueue_job',{p_company_id:ctx.companyId,p_kind:'gmail.sync',p_key:`gmail-periodic/${new Date().toISOString().slice(0,16)}`,p_payload:{}}))
  }
 }
 const jobs=await checked(ctx.sb.rpc('private_claim_job',{p_company_id:ctx.companyId}))
 const job=jobs?.[0];if(!job)return{statusCode:200,body:'idle'}
 try{
  if(['estimate.draft','note.add'].includes(job.kind))await checked(ctx.sb.rpc('private_execute_db_job',{p_id:job.id,p_lease:job.lease_id}))
  else{
   const gmail=require('./shared/gmail.cjs')
   const result=job.kind==='gmail.sync'?await gmail.sync(ctx):await gmail.draft(ctx,job.payload)
   await checked(ctx.sb.from('automation_jobs').update({status:'done',result,lease_id:null,lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_id',job.lease_id))
  }
 }catch(e){
  // External writes are ambiguous after a timeout; never blindly recreate a draft.
  await checked(ctx.sb.from('automation_jobs').update({status:job.kind==='gmail.draft'?'unknown':job.kind==='gmail.sync'&&job.attempts<5?'queued':'failed',last_error:e.message||'Job failed',lease_id:null,lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_id',job.lease_id))
 }
 return{statusCode:200,body:'processed'}
}
