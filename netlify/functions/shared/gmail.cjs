const crypto=require('node:crypto')
const {checked}=require('./private-runtime.cjs')
function encryptionKey(){const key=Buffer.from(process.env.LOFTDESK_ENCRYPTION_KEY||'','base64');if(key.length!==32)throw new Error('A 32-byte encryption key is required');return key}
function encrypt(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64')}
function decrypt(value){const bytes=Buffer.from(value,'base64');if(bytes.length<29)throw new Error('Invalid encrypted credential');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8')}
async function google(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`Google request failed (${response.status})`);return response.json()}
async function accessToken(integration){const data=await google('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:decrypt(integration.encrypted_refresh_token),grant_type:'refresh_token'})});if(!data.access_token)throw new Error('Google did not return an access token');return data.access_token}
async function account(ctx){return checked(ctx.sb.from('private_integrations').select('*').eq('company_id',ctx.companyId).eq('provider','gmail').single())}
function textPart(part){if(part.mimeType==='text/plain'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8');return(part.parts||[]).map(textPart).filter(Boolean).join('\n')}
function attachments(part){return[...(part.filename?[{filename:part.filename,mimeType:part.mimeType,size:part.body?.size,attachmentId:part.body?.attachmentId}]:[]),...(part.parts||[]).flatMap(attachments)]}
async function sync(ctx){
 const integration=await account(ctx),token=await accessToken(integration)
 const end=integration.sync_window_end||new Date().toISOString(),start=integration.sync_window_start||integration.last_sync_at||new Date(Date.now()-30*86400000).toISOString()
 await checked(ctx.sb.from('private_integrations').update({sync_window_start:start,sync_window_end:end}).eq('company_id',ctx.companyId).eq('provider','gmail'))
 const params=new URLSearchParams({maxResults:'5',q:`after:${Math.floor(Date.parse(start)/1000)-120} before:${Math.floor(Date.parse(end)/1000)+1} -in:trash -in:spam -from:oferteo.pl -from:favore.pl`})
 if(integration.sync_page_token)params.set('pageToken',integration.sync_page_token)
 const list=await google(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,{headers:{Authorization:`Bearer ${token}`}})
 const messages=await Promise.all((list.messages||[]).map(m=>google(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=full`,{headers:{Authorization:`Bearer ${token}`}})))
 const rows=messages.map(m=>{const headers=Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));return{company_id:ctx.companyId,provider_id:m.id,thread_id:m.threadId,sender:headers.from||'',subject:headers.subject||'',body:textPart(m.payload||{}).slice(0,100000),received_at:new Date(Number(m.internalDate)).toISOString(),attachment_metadata:attachments(m.payload||{})}}).filter(m=>!/(oferteo|favore)/i.test(m.sender))
 if(rows.length)await checked(ctx.sb.from('automation_inbox').upsert(rows,{onConflict:'company_id,provider_id',ignoreDuplicates:true}))
 await checked(ctx.sb.from('private_integrations').update(list.nextPageToken?{sync_page_token:list.nextPageToken}:{sync_page_token:null,sync_window_start:null,sync_window_end:null,last_sync_at:end}).eq('company_id',ctx.companyId).eq('provider','gmail'))
 return{imported:rows.length,more:!!list.nextPageToken}
}
async function draft(ctx,payload){
 if(typeof payload.to!=='string'||!/^[-.!#$%&'*+/=?^_`{|}~A-Za-z0-9]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(payload.to)||/[\r\n]/.test(payload.to))throw new Error('Invalid recipient address')
 if(typeof payload.subject!=='string'||/[\r\n]/.test(payload.subject)||typeof payload.body!=='string'||payload.body.length>50000)throw new Error('Invalid email content')
 const integration=await account(ctx),token=await accessToken(integration)
 const mime=`To: ${payload.to}\r\nSubject: =?UTF-8?B?${Buffer.from(payload.subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(payload.body).toString('base64')}`
 const result=await google('https://gmail.googleapis.com/gmail/v1/users/me/drafts',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{raw:Buffer.from(mime).toString('base64url')}})})
 return{draft_id:result.id,message_id:result.message?.id}
}
module.exports={encrypt,decrypt,google,sync,draft,textPart,attachments}
