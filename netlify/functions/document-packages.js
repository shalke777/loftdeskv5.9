const {mcpOwnerContext,json}=require('./shared/private-runtime.cjs')
const {preparePackage,listPackages,getPackage,sendPackage,summary}=require('./shared/document-packages.cjs')
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return json(204,null)
  if(event.httpMethod!=='POST')return json(405,{error:'Use POST'})
  let ctx
  try {ctx={...await mcpOwnerContext(event),canWrite:true}}catch{return json(401,{error:'Wymagane konto właściciela LoftDesk.'})}
  try {
    if((event.body||'').length>20000)return json(413,{error:'Request too large'})
    const args=JSON.parse(event.body||'{}')
    let result
    if(args.action==='prepare')result=await preparePackage(ctx,args,require('./shared/package-render.ts').renderPackageDocuments)
    else if(args.action==='list')result=await listPackages(ctx,args)
    else if(args.action==='get')result=summary(await getPackage(ctx,args))
    else if(args.action==='send')result=await sendPackage(ctx,args)
    else throw new Error('Nieznana operacja pakietu.')
    return json(200,result)
  }catch(e){console.error('[document-packages]',e.message);return json(400,{error:e.message||'Operacja nie powiodła się.'})}
}
