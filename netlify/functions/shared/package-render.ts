import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { buildContractPreview, buildEstimatePreview, buildInvoicePreview } from '../../../src/services/pdf/documentPreview'

export async function renderPackageDocuments(sources: any) {
  const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true})
  try {
    const page=await browser.newPage()
    await page.setJavaScriptEnabled(false)
    // Documents never execute scripts or load remote URLs (including logo URLs).
    await page.setRequestInterception(true)
    page.on('request',r=>r.url().startsWith('data:')?r.continue():r.abort())
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
      await page.setContent(html,{waitUntil:'domcontentloaded'})
      const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true})
      files.push({pdf})
    }
    return files
  } finally { await browser.close() }
}
