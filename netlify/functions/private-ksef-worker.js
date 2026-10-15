const {privateContext}=require('./shared/private-runtime.cjs')
const {reconcileOne}=require('./shared/ksef-reconciliation.cjs')
exports.handler=async()=>{
 if(process.env.LOFTDESK_AUTOMATION_ENABLED!=='true'||process.env.KSEF_SYNC_ENABLED!=='true')return{statusCode:200,body:'disabled'}
 const result=await reconcileOne(await privateContext(),process.env.KSEF_ENV)
 return{statusCode:200,body:JSON.stringify(result)}
}
