import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const root=new URL('../../',import.meta.url)
function load(path,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in deps))throw new Error(n);return deps[n]},console});return exports}
const math=load('src/features/invoices/lib/invoice.calculations.ts')
const service=load('src/services/ksef/ksef.service.ts',{'@/features/invoices/lib/invoice.calculations':math,'@/shared/lib/supabase':{supabase:null},'@/shared/lib/functions':{}})
const cases={partial:[{description:'Stage of building work',unit:'kpl',quantity:3,unit_price:17.345,vat_rate:8},{description:'Material',unit:'szt',quantity:1,unit_price:100,vat_rate:23}],zero:[{description:'Domestic zero rate',quantity:1,unit_price:100,vat_rate:0}],standard:[{description:'Work',quantity:1,unit_price:1000,vat_rate:8}]}
const output=process.argv[2]||'/tmp/loftdesk-fa3-fixtures';mkdirSync(output,{recursive:true})
for(const [name,items]of Object.entries(cases)){const totals=math.calcInvoiceTotals(items);const xml=service.buildFA2Xml({number:'FV/2026/10/1',invoice_type:name==='partial'?'partial':'standard',issue_date:'2026-10-15',sale_date:'2026-10-15',due_date:'2026-10-29',payment_method:'card',status:'unpaid',items,total_net:totals.totalNet,total_gross:totals.totalGross},{nip:'526-025-02-74',name:'Company',address:'Krakow'},{name:'Client',address:'Krakow'});writeFileSync(`${output}/${name}.xml`,xml)}
console.log(output)
