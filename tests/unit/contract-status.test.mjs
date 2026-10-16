import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {QueryClient} from '@tanstack/react-query'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const root = new URL('../../', import.meta.url)
function loadTS(file, dependencies) {
  const module={exports:{}}
  const source=ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(source,{module,exports:module.exports,crypto:globalThis.crypto,console,require:name=>{
    assert.ok(name in dependencies, `Unexpected dependency ${name}`)
    return dependencies[name]
  }})
  return module.exports
}
function hooks() {
  const qc=new QueryClient(), errors=[]
  const deps={
    react:{useEffect(){}},
    '@tanstack/react-query':{useMutation:options=>options,useQueryClient:()=>qc},
    '@/features/auth/hooks/useAuth':{useCompanyId:()=> 'company'},
    '@/features/contracts/api/contracts.api':{contractsApi:{create(){},update(){},sign(){}}},
    '@/services/project/autoLinkService':{autoLinkService:{link:async()=>{}}},
    '@/shared/hooks/useToast':{useToast:()=>({success(){},error:message=>errors.push(message)})},
    '@/shared/lib/supabase':{supabase:null},
  }
  return {qc,errors,exports:loadTS('src/features/contracts/hooks/useContracts.ts',deps)}
}
test('create replaces temporary ID; immediate status update updates cached contract and document views',async()=>{
  const {qc,exports:h}=hooks()
  const create=h.useCreateContract()
  const context=await create.onMutate({value:100})
  assert.equal(qc.getQueryData(['contracts','company'])[0].id,context.tempId)
  create.onSuccess({id:'saved',status:'unsigned',project_id:'project'},null,context)
  assert.equal(qc.getQueryData(['contracts','company'])[0].id,'saved')
  qc.setQueryData(['project_documents','project'],[])
  qc.setQueryData(['dashboard','company'],{})
  h.useSignContract().onSuccess({id:'saved',status:'signed'})
  assert.equal(qc.getQueryData(['contracts','company'])[0].status,'signed')
  assert.equal(qc.getQueryState(['project_documents','project']).isInvalidated,true)
  assert.equal(qc.getQueryState(['dashboard','company']).isInvalidated,true)
  qc.clear()
})
test('manual signing fails on zero matching rows instead of reporting success',async()=>{
  let found=false, filters={}, saved
  const q={update:patch=>{saved=patch;return q},eq:(k,v)=>{filters[k]=v;return q},select:()=>q,single:()=>q,then:resolve=>resolve(found?{data:{id:'saved',...saved}}:{error:new Error('No matching contract')})}
  const {contractsApi}=loadTS('src/features/contracts/api/contracts.api.ts',{
    '@/shared/lib/demoDb':{demoDb:{}},
    '@/shared/lib/supabase':{isDemoMode:false,supabase:{from:table=>{assert.equal(table,'contracts');return q}}},
    '@/shared/lib/dataScope':{getDataScope:async()=>({companyId:'company'}),applyScope:(q,scope)=>q.eq('company_id',scope.companyId)},
    '@/features/projects/api/projectDocuments.api':{},
  })
  await assert.rejects(contractsApi.sign('temporary','company'),/No matching contract/)
  found=true
  const result=await contractsApi.sign('saved','company')
  assert.equal(result.status,'signed')
  assert.deepEqual(filters,{id:'saved',company_id:'company'})
})
test('integration edits saved contract under owner scope, rejects read-only, missing record and invalid dates',async()=>{
  const current={id:'saved',status:'unsigned',start_date:'2026-11-02',end_date:'2026-11-27',notes:'Keep notes',tranches:[{id:'a',label:'Opłata rezerwacyjna',amount:100,status:'planned'}]}
  const queries=[], writes=[]
  let found=true
  const ctx={companyId:'company',canWrite:true,sb:{from:table=>{
    assert.equal(table,'contracts')
    const filters={};let patch
    const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q},update:p=>{patch=p;return q},single:async()=>{queries.push(filters);if(!found) return{error:new Error('No matching contract')};if(patch){writes.push(patch);Object.assign(current,patch)}return{data:{...current}}}}
    return q
  }}}
  const module={exports:{}}
  vm.runInNewContext(readFileSync(new URL('netlify/functions/shared/contract-editor.cjs',root),'utf8'),{module,exports:module.exports,require:()=>({checked:async p=>{const r=await p;if(r.error)throw r.error;return r.data}})})
  const {updateContract}=module.exports
  const result=await updateContract(ctx,'saved',{end_date:'2026-11-30'})
  assert.equal(result.status,'done')
  assert.equal(result.document.end_date,'2026-11-30')
  assert.equal(result.document.notes,'Keep notes')
  assert.equal(result.document.tranches[0].label,'Opłata rezerwacyjna')
  assert.ok(queries.every(q=>q.company_id==='company'&&q.id==='saved'))
  await assert.rejects(updateContract({...ctx,canWrite:false},'saved',{notes:'x'}),/odczytu/)
  await assert.rejects(updateContract(ctx,'saved',{end_date:'2026-02-30'}),/date/)
  await assert.rejects(updateContract(ctx,'saved',{end_date:'2026-10-01'}),/precedes/)
  assert.equal(writes.length,1)
  found=false
  await assert.rejects(updateContract(ctx,'other',{notes:'x'}),/No matching/)
})
