import { z } from 'zod'

export const ClientDecisionSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string().nullable(),
  client_id: z.string().nullable(),
  related_estimate_id: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  decision_type: z.enum(['change', 'material', 'timeline', 'scope', 'technical']),
  status: z.enum(['pending_client', 'accepted', 'rejected', 'revision_requested']),
  requested_at: z.string(),
  decided_at: z.string().nullable().optional(),
  client_comment: z.string().optional().default(''),
})

export const HandoverChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  accepted: z.boolean().default(false),
})

export const HandoverProtocolSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string().nullable(),
  client_id: z.string().nullable(),
  title: z.string().min(1),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  protocol_date: z.string().nullable().optional(),
  summary: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  checklist: z.array(HandoverChecklistItemSchema).default([]),
})

export const PhotoDocumentationSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string().nullable(),
  client_id: z.string().nullable(),
  title: z.string().min(1),
  category: z.enum(['before', 'progress', 'after', 'issue', 'handover']).default('progress'),
  taken_at: z.string().nullable().optional(),
  image_url: z.string().optional().default(''),
  note: z.string().optional().default(''),
})

export const TechnicalStandardSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  title: z.string().min(1),
  category: z.enum(['regulation', 'client_standard', 'quality_check', 'technical_standard']).default('technical_standard'),
  source_label: z.string().optional().default(''),
  content: z.string().min(1),
  requires_client_acceptance: z.boolean().default(false),
  accepted_by_client: z.boolean().default(false),
})

export type ClientDecision = z.infer<typeof ClientDecisionSchema>
export type HandoverChecklistItem = z.infer<typeof HandoverChecklistItemSchema>
export type HandoverProtocol = z.infer<typeof HandoverProtocolSchema>
export type PhotoDocumentation = z.infer<typeof PhotoDocumentationSchema>
export type TechnicalStandard = z.infer<typeof TechnicalStandardSchema>

export type DocumentationOverview = {
  decisions: ClientDecision[]
  protocols: HandoverProtocol[]
  photos: PhotoDocumentation[]
  standards: TechnicalStandard[]
}
