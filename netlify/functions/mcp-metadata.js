const {json}=require('./shared/private-runtime.cjs')
const {metadata}=require('./shared/mcp-auth.cjs')
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return json(204,null)
  if(event.httpMethod!=='GET')return {...json(405,{error:'Use GET'}),headers:{...json(405,null).headers,Allow:'GET, OPTIONS'}}
  try{return json(200,metadata())}catch{return json(503,{error:'OAuth is not configured'})}
}
