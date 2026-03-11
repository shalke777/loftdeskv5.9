import { useMemo, useState, type ReactNode } from 'react'
import { Camera, CheckCheck, ClipboardCheck, Gavel, Plus, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Badge } from '@/shared/ui/Badge/Badge'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildProtocolPreview } from '@/services/pdf/documentPreview'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useAcceptStandard, useCreateDecision, useCreatePhoto, useCreateProtocol, useCreateStandard, useDecideDecision, useDecideProtocol, useDeleteDecision, useDeletePhoto, useDeleteProtocol, useDeleteStandard, useDocumentationOverview, useUpdateDecision, useUpdatePhoto, useUpdateProtocol, useUpdateStandard } from '@/features/documentation/hooks/useDocumentation'
import type { ClientDecision, HandoverProtocol, PhotoDocumentation, TechnicalStandard } from '@/entities/documentation/model'
import { useCan } from '@/features/auth/hooks/usePermissions'

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (['accepted', 'paid', 'signed'].includes(status)) return 'success'
  if (['pending_client', 'sent', 'draft'].includes(status)) return 'warning'
  if (['rejected', 'revision_requested'].includes(status)) return 'danger'
  return 'default'
}

function SectionCard({ title, subtitle, icon, actions, children }: { title: string; subtitle: string; icon: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="quick-action__icon">{icon}</div>
          <div>
            <h3>{title}</h3>
            <p className="muted">{subtitle}</p>
          </div>
        </div>
        <div className="actions-row" style={{ marginTop: 0 }}>{actions}</div>
      </div>
      {children}
    </Card>
  )
}

export function DocumentationPage() {
  const companyId = useCompanyId()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const { data } = useDocumentationOverview()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [standardOpen, setStandardOpen] = useState(false)
  const [editingDecision, setEditingDecision] = useState<ClientDecision | null>(null)
  const [editingProtocol, setEditingProtocol] = useState<HandoverProtocol | null>(null)
  const [editingPhoto, setEditingPhoto] = useState<PhotoDocumentation | null>(null)
  const [editingStandard, setEditingStandard] = useState<TechnicalStandard | null>(null)
  const [protocolPreview, setProtocolPreview] = useState<HandoverProtocol | null>(null)

  const createDecision = useCreateDecision(); const updateDecision = useUpdateDecision(); const decideDecision = useDecideDecision(); const deleteDecision = useDeleteDecision()
  const createProtocol = useCreateProtocol(); const updateProtocol = useUpdateProtocol(); const decideProtocol = useDecideProtocol(); const deleteProtocol = useDeleteProtocol()
  const createPhoto = useCreatePhoto(); const updatePhoto = useUpdatePhoto(); const deletePhoto = useDeletePhoto()
  const createStandard = useCreateStandard(); const updateStandard = useUpdateStandard(); const acceptStandard = useAcceptStandard(); const deleteStandard = useDeleteStandard()
  const canManage = useCan('projects.create')

  const summary = useMemo(() => ({
    pendingDecisions: data?.decisions.filter((item) => item.status === 'pending_client').length ?? 0,
    sentProtocols: data?.protocols.filter((item) => item.status === 'sent').length ?? 0,
    photos: data?.photos.length ?? 0,
    standardsToAccept: data?.standards.filter((item) => item.requires_client_acceptance && !item.accepted_by_client).length ?? 0,
  }), [data])

  async function submitDecision(input: any) {
    if (editingDecision) await updateDecision.mutateAsync({ id: editingDecision.id, input })
    else await createDecision.mutateAsync(input)
    setEditingDecision(null); setDecisionOpen(false)
  }
  async function submitProtocol(input: any) {
    if (editingProtocol) await updateProtocol.mutateAsync({ id: editingProtocol.id, input })
    else await createProtocol.mutateAsync(input)
    setEditingProtocol(null); setProtocolOpen(false)
  }
  async function submitPhoto(input: any) {
    if (editingPhoto) await updatePhoto.mutateAsync({ id: editingPhoto.id, input })
    else await createPhoto.mutateAsync(input)
    setEditingPhoto(null); setPhotoOpen(false)
  }
  async function submitStandard(input: any) {
    if (editingStandard) await updateStandard.mutateAsync({ id: editingStandard.id, input })
    else await createStandard.mutateAsync(input)
    setEditingStandard(null); setStandardOpen(false)
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="toolbar">
        <PageHeader title="Dokumentacja i akceptacje" subtitle="Obsługa zmian klienta, decyzji, protokołów odbioru, dokumentacji fotograficznej oraz standardów technicznych i regulaminów." />
      </div>

      <div className="grid-4">
        <Card><div className="muted">Decyzje oczekujące</div><div className="stat-card__value">{summary.pendingDecisions}</div></Card>
        <Card><div className="muted">Protokoły do akceptacji</div><div className="stat-card__value">{summary.sentProtocols}</div></Card>
        <Card><div className="muted">Zdjęcia w dokumentacji</div><div className="stat-card__value">{summary.photos}</div></Card>
        <Card><div className="muted">Standardy do akceptacji</div><div className="stat-card__value">{summary.standardsToAccept}</div></Card>
      </div>

      <SectionCard title="Decyzje klienta i akceptacja zmian" subtitle="Zakres, materiały, termin, dopłaty i decyzje inwestora z historią akceptacji." icon={<Gavel size={18} />} actions={canManage ? <Button size="sm" onClick={() => { setEditingDecision(null); setDecisionOpen(true) }} icon={<Plus size={16} />}>Nowa decyzja</Button> : null}>
        {!data?.decisions.length ? <EmptyState title="Brak decyzji" description="Dodaj pierwszą decyzję klienta lub zmianę do akceptacji." /> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data?.decisions.map((decision) => (
              <div key={decision.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{decision.title}</strong>
                    <Badge variant={statusTone(decision.status)}>{decision.status}</Badge>
                  </div>
                  <div className="field__label" style={{ marginTop: 4 }}>{decision.description}</div>
                  <div className="field__label" style={{ marginTop: 8 }}>Typ: {decision.decision_type} · Komentarz klienta: {decision.client_comment || '—'}</div>
                </div>
                <div className="actions-row" style={{ marginTop: 0 }}>
                  {canManage ? <Button size="sm" variant="secondary" onClick={() => { setEditingDecision(decision); setDecisionOpen(true) }}>Edytuj</Button> : null}
                  <Button size="sm" variant="secondary" onClick={() => decideDecision.mutate({ id: decision.id, status: 'accepted' })}>Akceptuj</Button>
                  <Button size="sm" variant="ghost" onClick={() => decideDecision.mutate({ id: decision.id, status: 'revision_requested', comment: 'Prośba o korektę / uzupełnienie.' })}>Korekta</Button>
                  {canManage ? <Button size="sm" variant="danger" onClick={() => deleteDecision.mutate(decision.id)}>Usuń</Button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Protokoły odbioru" subtitle="Częściowe i końcowe odbiory z checklistą i decyzją klienta." icon={<ClipboardCheck size={18} />} actions={canManage ? <Button size="sm" onClick={() => { setEditingProtocol(null); setProtocolOpen(true) }} icon={<Plus size={16} />}>Nowy protokół</Button> : null}>
        {!data?.protocols.length ? <EmptyState title="Brak protokołów" description="Dodaj pierwszy protokół odbioru dla projektu lub etapu." /> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data?.protocols.map((protocol) => (
              <div key={protocol.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{protocol.title}</strong>
                    <Badge variant={statusTone(protocol.status)}>{protocol.status}</Badge>
                  </div>
                  <div className="field__label" style={{ marginTop: 4 }}>{protocol.summary}</div>
                  <div className="field__label" style={{ marginTop: 8 }}>Checklist: {protocol.checklist.filter((item) => item.accepted).length}/{protocol.checklist.length}</div>
                </div>
                <div className="actions-row" style={{ marginTop: 0 }}>
                  <Button size="sm" variant="ghost" onClick={() => setProtocolPreview(protocol)}>PDF</Button>
                  {canManage ? <Button size="sm" variant="secondary" onClick={() => { setEditingProtocol(protocol); setProtocolOpen(true) }}>Edytuj</Button> : null}
                  <Button size="sm" variant="secondary" onClick={() => decideProtocol.mutate({ id: protocol.id, status: 'accepted' })}>Akceptuj</Button>
                  <Button size="sm" variant="ghost" onClick={() => decideProtocol.mutate({ id: protocol.id, status: 'rejected' })}>Uwagi / odrzuć</Button>
                  {canManage ? <Button size="sm" variant="danger" onClick={() => deleteProtocol.mutate(protocol.id)}>Usuń</Button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid-2">
        <SectionCard title="Dokumentacja fotograficzna" subtitle="Zdjęcia przed, w trakcie, po odbiorze i przy usterkach." icon={<Camera size={18} />} actions={canManage ? <Button size="sm" onClick={() => { setEditingPhoto(null); setPhotoOpen(true) }} icon={<Plus size={16} />}>Dodaj zdjęcie</Button> : null}>
          {!data?.photos.length ? <EmptyState title="Brak zdjęć" description="Dodaj pierwsze zdjęcie do dokumentacji projektu." /> : (
            <div className="grid-2">
              {data?.photos.map((photo) => (
                <Card key={photo.id}>
                  {photo.image_url ? <img src={photo.image_url} alt={photo.title} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} /> : null}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{photo.title}</strong>
                    <Badge variant="default">{photo.category}</Badge>
                  </div>
                  <p className="field__label" style={{ marginTop: 8 }}>{photo.note || '—'}</p>
                  <div className="actions-row">
                    {canManage ? <Button size="sm" variant="secondary" onClick={() => { setEditingPhoto(photo); setPhotoOpen(true) }}>Edytuj</Button> : null}
                    {canManage ? <Button size="sm" variant="danger" onClick={() => deletePhoto.mutate(photo.id)}>Usuń</Button> : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Regulaminy i standardy techniczne" subtitle="Wytyczne klienta, standardy jakości i regulamin wykonania z opcją akceptacji klienta." icon={<ShieldCheck size={18} />} actions={canManage ? <Button size="sm" onClick={() => { setEditingStandard(null); setStandardOpen(true) }} icon={<Plus size={16} />}>Dodaj standard</Button> : null}>
          {!data?.standards.length ? <EmptyState title="Brak standardów" description="Dodaj standard jakości lub regulamin projektu." /> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {data?.standards.map((standard) => (
                <div key={standard.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{standard.title}</strong>
                      <Badge variant={standard.accepted_by_client ? 'success' : standard.requires_client_acceptance ? 'warning' : 'default'}>{standard.category}</Badge>
                    </div>
                    <div className="field__label" style={{ marginTop: 4 }}>{standard.content}</div>
                    <div className="field__label" style={{ marginTop: 8 }}>Źródło: {standard.source_label || '—'} · Akceptacja klienta: {standard.requires_client_acceptance ? (standard.accepted_by_client ? 'zaakceptowana' : 'wymagana') : 'nie wymagana'}</div>
                  </div>
                  <div className="actions-row" style={{ marginTop: 0 }}>
                    {canManage ? <Button size="sm" variant="secondary" onClick={() => { setEditingStandard(standard); setStandardOpen(true) }}>Edytuj</Button> : null}
                    {standard.requires_client_acceptance && !standard.accepted_by_client ? <Button size="sm" variant="secondary" onClick={() => acceptStandard.mutate(standard.id)} icon={<CheckCheck size={16} />}>Oznacz akceptację</Button> : null}
                    {canManage ? <Button size="sm" variant="danger" onClick={() => deleteStandard.mutate(standard.id)}>Usuń</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <Modal open={decisionOpen} onClose={() => setDecisionOpen(false)} title={editingDecision ? 'Edytuj decyzję klienta' : 'Nowa decyzja klienta'} size="lg">
        <DecisionForm companyId={companyId} clients={clients} projects={projects} initial={editingDecision} onSubmit={submitDecision} />
      </Modal>
      <Modal open={protocolOpen} onClose={() => setProtocolOpen(false)} title={editingProtocol ? 'Edytuj protokół' : 'Nowy protokół odbioru'} size="lg">
        <ProtocolForm companyId={companyId} clients={clients} projects={projects} initial={editingProtocol} onSubmit={submitProtocol} />
      </Modal>
      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} title={editingPhoto ? 'Edytuj zdjęcie' : 'Dodaj zdjęcie'} size="lg">
        <PhotoForm companyId={companyId} clients={clients} projects={projects} initial={editingPhoto} onSubmit={submitPhoto} />
      </Modal>
      <Modal open={standardOpen} onClose={() => setStandardOpen(false)} title={editingStandard ? 'Edytuj standard' : 'Dodaj standard / regulamin'} size="lg">
        <StandardForm companyId={companyId} clients={clients} projects={projects} initial={editingStandard} onSubmit={submitStandard} />
      </Modal>
      <DocumentPreviewModal
        open={Boolean(protocolPreview)}
        onClose={() => setProtocolPreview(null)}
        title={`${protocolPreview?.title || 'Protokół'} · Podgląd dokumentu`}
        tabs={protocolPreview ? [{
          key: 'pdf',
          label: 'Podgląd PDF',
          type: 'html' as const,
          content: buildProtocolPreview(
            protocolPreview,
            clients.find((item) => item.id === protocolPreview.client_id)?.name,
            projects.find((item) => item.id === protocolPreview.project_id)?.name,
            { name: companyMeta.name || user?.companyName, email: companyMeta.email || user?.email, logoUrl: companyMeta.logoUrl },
          ),
        }] : []}
      />
    </div>
  )
}

function DecisionForm({ companyId, clients, projects, initial, onSubmit }: any) {
  const [form, setForm] = useState(() => initial ?? { company_id: companyId, client_id: clients[0]?.id ?? null, project_id: projects[0]?.id ?? null, related_estimate_id: null, title: '', description: '', decision_type: 'change', status: 'pending_client', client_comment: '' })
  return <GenericForm form={form} setForm={setForm} clients={clients} projects={projects} onSubmit={() => onSubmit(form)} fields={[['title', 'Tytuł'], ['description', 'Opis']] } extra={<div className="grid-3"><SelectField label="Typ" value={form.decision_type} onChange={(value) => setForm({ ...form, decision_type: value })} options={[['change','Zmiana'],['material','Materiał'],['timeline','Termin'],['scope','Zakres'],['technical','Techniczne']]} /><SelectField label="Klient" value={form.client_id ?? ''} onChange={(value) => setForm({ ...form, client_id: value || null })} options={clients.map((item: any) => [item.id, item.name])} /><SelectField label="Projekt" value={form.project_id ?? ''} onChange={(value) => setForm({ ...form, project_id: value || null })} options={projects.map((item: any) => [item.id, item.name])} /></div>} />
}

function ProtocolForm({ companyId, clients, projects, initial, onSubmit }: any) {
  const [checklistText, setChecklistText] = useState<string>((initial?.checklist ?? []).map((item: any) => item.label).join('\n'))
  const [form, setForm] = useState(() => initial ?? { company_id: companyId, client_id: clients[0]?.id ?? null, project_id: projects[0]?.id ?? null, title: '', status: 'draft', protocol_date: new Date().toISOString().slice(0,10), summary: '', notes: '', checklist: [] })
  return <GenericForm form={form} setForm={setForm} clients={clients} projects={projects} onSubmit={() => onSubmit({ ...form, checklist: checklistText.split('\n').map((item, index) => ({ id: `${index}`, label: item.trim(), accepted: false })).filter((item) => item.label) })} fields={[['title', 'Tytuł'], ['summary', 'Podsumowanie'], ['notes', 'Uwagi']]} extra={<><div className="grid-3"><SelectField label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[['draft','Szkic'],['sent','Wysłany'],['accepted','Zaakceptowany'],['rejected','Odrzucony']]} /><SelectField label="Klient" value={form.client_id ?? ''} onChange={(value) => setForm({ ...form, client_id: value || null })} options={clients.map((item: any) => [item.id, item.name])} /><SelectField label="Projekt" value={form.project_id ?? ''} onChange={(value) => setForm({ ...form, project_id: value || null })} options={projects.map((item: any) => [item.id, item.name])} /></div><label className="field"><span className="field__label">Checklista odbioru (1 pozycja na linię)</span><textarea className="input" rows={6} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} /></label></>} />
}

function PhotoForm({ companyId, clients, projects, initial, onSubmit }: any) {
  const [form, setForm] = useState(() => initial ?? { company_id: companyId, client_id: clients[0]?.id ?? null, project_id: projects[0]?.id ?? null, title: '', category: 'progress', taken_at: new Date().toISOString().slice(0,10), image_url: '', note: '' })
  return <GenericForm form={form} setForm={setForm} clients={clients} projects={projects} onSubmit={() => onSubmit(form)} fields={[['title', 'Tytuł'], ['image_url', 'URL zdjęcia'], ['note', 'Opis / notatka']]} extra={<div className="grid-3"><SelectField label="Kategoria" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={[['before','Przed'],['progress','W trakcie'],['after','Po'],['issue','Usterka'],['handover','Odbiór']]} /><SelectField label="Klient" value={form.client_id ?? ''} onChange={(value) => setForm({ ...form, client_id: value || null })} options={clients.map((item: any) => [item.id, item.name])} /><SelectField label="Projekt" value={form.project_id ?? ''} onChange={(value) => setForm({ ...form, project_id: value || null })} options={projects.map((item: any) => [item.id, item.name])} /></div>} />
}

function StandardForm({ companyId, clients, projects, initial, onSubmit }: any) {
  const [form, setForm] = useState(() => initial ?? { company_id: companyId, client_id: null, project_id: null, title: '', category: 'technical_standard', source_label: '', content: '', requires_client_acceptance: false, accepted_by_client: false })
  return <GenericForm form={form} setForm={setForm} clients={clients} projects={projects} onSubmit={() => onSubmit(form)} fields={[['title', 'Tytuł'], ['source_label', 'Źródło'], ['content', 'Treść standardu / regulaminu']]} extra={<><div className="grid-3"><SelectField label="Kategoria" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={[['regulation','Regulamin'],['client_standard','Standard klienta'],['quality_check','Kontrola jakości'],['technical_standard','Standard techniczny']]} /><SelectField label="Klient" value={form.client_id ?? ''} onChange={(value) => setForm({ ...form, client_id: value || null })} options={[['','Brak przypisania'], ...clients.map((item: any) => [item.id, item.name])]} /><SelectField label="Projekt" value={form.project_id ?? ''} onChange={(value) => setForm({ ...form, project_id: value || null })} options={[['','Brak przypisania'], ...projects.map((item: any) => [item.id, item.name])]} /></div><label className="field" style={{ marginTop: 12 }}><span className="field__label"><input type="checkbox" checked={form.requires_client_acceptance} onChange={(e) => setForm({ ...form, requires_client_acceptance: e.target.checked })} />{' '}Wymaga akceptacji klienta</span></label></>} />
}

function GenericForm({ form, setForm, onSubmit, fields, extra }: any) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} style={{ display: 'grid', gap: 14 }}>
      {fields.map(([key, label]: [string, string]) => (
        <label className="field" key={key}>
          <span className="field__label">{label}</span>
          {key === 'description' || key === 'summary' || key === 'notes' || key === 'content' || key === 'note'
            ? <textarea className="input" rows={key === 'content' ? 7 : 4} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            : <input className="input" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
        </label>
      ))}
      {extra}
      <div className="actions-row"><Button type="submit">Zapisz</Button></div>
    </form>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([key, text]) => <option key={key || '__empty'} value={key}>{text}</option>)}
      </select>
    </label>
  )
}
