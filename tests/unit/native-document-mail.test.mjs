import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {sendDocumentMail}=require('../../netlify/functions/shared/document-mail.cjs')
test('native app and integration use one sender; attachments and idempotency survive',async()=>{
  process.env.RESEND_API_KEY='test-key'
  const calls=[]
  const fetcher=async (url,req)=>{calls.push({url,...req});return{ok:true,json:async()=>({id:'provider-1'})}}
  const file={filename:'UM-1.pdf',content:Buffer.from('%PDF-test').toString('base64')}
  const options={toEmail:'owner@example.test',companyName:'Firma & Syn',operatorEmail:'owner@example.test',documentType:'contract',documentName:'UM/1',userMessage:'Do przeglądu <script>bad</script>',attachments:[file]}
  await sendDocumentMail(options,fetcher)
  await sendDocumentMail({...options,idempotencyKey:'retry-same-request'},fetcher)
  const a=JSON.parse(calls[0].body),b=JSON.parse(calls[1].body)
  assert.deepEqual(a,b)
  assert.deepEqual(a.attachments,[file])
  assert.equal(a.to[0],options.toEmail)
  assert.ok(!a.html.includes('<script>'))
  assert.equal(calls[1].headers['Idempotency-Key'],'retry-same-request')
})
