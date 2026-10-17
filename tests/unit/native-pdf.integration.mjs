// Synthetic fixture only. No user documents or emails are created.
import {build} from 'esbuild'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const root=new URL('../../',import.meta.url)
const output=new URL('netlify/functions/.native-pdf-test.cjs',root)
await build({entryPoints:[new URL('netlify/functions/shared/package-render.ts',root).pathname],bundle:true,platform:'node',format:'cjs',external:['puppeteer-core','@sparticuz/chromium'],outfile:output.pathname})
const {renderPackageDocuments}=require(output.pathname)
const sources={company:{name:'TEST COMPANY',email:'owner@example.test'},documents:[{type:'estimate',row:{id:'synthetic',number:'WY/TEST',name:'Test',status:'draft',estimate_type:'final',created_at:'2026-01-01',total_net:100,total_gross:108,notes:'ZAKRES PRAC\nSynthetic scope only',items:[{name:'Synthetic service',quantity:1,unit:'kpl.',unit_price:100,vat_rate:8}]},client:{name:'TEST CLIENT'}}]}
try {
 const files=await renderPackageDocuments(sources)
 assert.equal(files.length,1)
 assert.equal(files[0].pdf.subarray(0,5).toString(),'%PDF-')
 // html2canvas/jsPDF embeds raster images. Chromium page.pdf uses Skia/PDF.
 const bytes=files[0].pdf.toString('latin1')
 assert.ok(bytes.includes('jsPDF'))
 assert.ok(!bytes.includes('Skia/PDF'))
 assert.equal(sources.documents[0].row.id,'synthetic')
 console.log('PASS: integration uses the native application PDF generator')
}finally{await unlink(output)}
