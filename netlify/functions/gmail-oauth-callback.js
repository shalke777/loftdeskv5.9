const crypto=require('node:crypto')
const {privateContext,checked,json}=require('./shared/private-runtime.cjs')
const {google,encrypt}=require('./shared/gmail.cjs')
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'Use GET'})
 try{
  const ctx=await privateContext(),params=event.queryStringParameters||{}
  if(!params.state||params.state.length>128||!params.code)throw new Error('Invalid OAuth callback')
  const hash=crypto.createHash('sha256').update(params.state).digest('hex')
  const state=await checked(ctx.sb.from('integration_oauth_states').delete().eq('state_hash',hash).eq('company_id',ctx.companyId).gt('expires_at',new Date().toISOString()).select('state_hash').single())
  if(!state)throw new Error('Expired OAuth state')
  const tokens=await google('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',redirect_uri:process.env.GOOGLE_REDIRECT_URI||'',code:params.code,grant_type:'authorization_code'})})
  if(!tokens.refresh_token||!tokens.access_token)throw new Error('Google did not return offline access')
  const profile=await google('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:`Bearer ${tokens.access_token}`}})
  if(!process.env.GMAIL_ACCOUNT_EMAIL||profile.emailAddress?.toLowerCase()!==process.env.GMAIL_ACCOUNT_EMAIL.toLowerCase())throw new Error('The selected Gmail account does not match the configured account')
  await checked(ctx.sb.from('private_integrations').upsert({company_id:ctx.companyId,provider:'gmail',account_email:profile.emailAddress,encrypted_refresh_token:encrypt(tokens.refresh_token)},{onConflict:'company_id,provider'}))
  return json(200,{connected:true,account:profile.emailAddress,message:'Gmail połączony. Wróć do ustawień LoftDesk.'})
 }catch{return json(400,{error:'Nie udało się połączyć Gmail. Wróć do LoftDesk i rozpocznij łączenie ponownie.'})}
}
