import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { buildContractPreview, buildEstimatePreview, buildInvoicePreview } from '../../../src/services/pdf/documentPreview'
const nativeGenerator = require('./native-pdf-browser.cjs')

export async function renderPackageDocuments(sources: any) {
  const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true})
  try {
    const page=await browser.newPage()
    // Only the bundled application code runs. Document HTML is escaped by the
    // same preview builders as the UI; remote scripts and requests stay blocked.
    await page.setRequestInterception(true)
    page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort())
    await page.setContent('<!doctype html><html><head></head><body></body></html>')
    await page.addScriptTag({content:nativeGenerator})
    const co=sources.company
    const company={...co,postalCity:[co.postal_code,co.city].filter(Boolean).join(' '),bankAccount:co.iban,logoUrl:''}
    const files=[]
    for(const d of sources.documents) {
      const cl=d.client, client=cl?{...cl,postalCity:[cl.postal_code,cl.city].filter(Boolean).join(' ')}:undefined
      const row=d.row
      let html:string
      if(d.type==='estimate') html=buildEstimatePreview(row,client,company)
      else if(d.type==='contract') html=buildContractPreview(row,cl?.name||'',d.estimate?.name||row.notes||'',company,d.estimate?.number,cl||undefined)
      else html=buildInvoicePreview(row,client,undefined,company)
      // Identical export function to SendToClientModal and project downloads.
      const base64 = await page.evaluate(async (content: string) => {
        const blob = await (window as any).LoftDeskNativePdf.generatePdfBlob(content)
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768))
        return btoa(binary)
      }, html)
      const pdf=Buffer.from(base64,'base64')
      files.push({pdf})
    }
    return files
  } finally { await browser.close() }
}
