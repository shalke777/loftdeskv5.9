import { z } from 'zod'

export const ProjectCompletenessSchema = z.object({
  has_client: z.boolean().default(false),
  has_estimate: z.boolean().default(false),
  has_contract: z.boolean().default(false),
  has_invoice: z.boolean().default(false),
  has_protocol: z.boolean().default(false),
  has_note: z.boolean().default(false),
})

export const ProjectSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  client_id: z.string().nullable(),
  number: z.string(),
  name: z.string().min(1),
  status: z.enum(['offer', 'active', 'done', 'cancelled']),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  address: z.string().optional(),
  investment_address: z.string().nullable().optional(),
  notes: z.string().optional(),
  completeness_score: z.number().optional(),
  completeness_flags: ProjectCompletenessSchema.nullable().optional(),
  archived_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string(),
})

export const ProjectDocumentSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string(),
  doc_type: z.enum(['estimate', 'contract', 'invoice', 'attachment', 'note', 'protocol', 'other']),
  doc_id: z.string(),
  assignment_status: z.enum(['confirmed', 'pending', 'rejected']).default('confirmed'),
  linked_automatically: z.boolean().default(false),
  linked_manually: z.boolean().default(false),
  source_doc_type: z.string().nullable().optional(),
  source_doc_id: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
  created_at: z.string(),
})

export const ProjectTimelineEntrySchema = z.object({
  id: z.string(),
  company_id: z.string(),
  project_id: z.string(),
  user_id: z.string().nullable().optional(),
  action: z.string(),
  details: z.record(z.unknown()).default({}),
  created_at: z.string(),
})

export const AssignmentQueueItemSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  doc_type: z.string(),
  doc_id: z.string(),
  suggested_project_id: z.string().nullable().optional(),
  confidence: z.number().default(0),
  reason: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  created_at: z.string(),
})

export type Project = z.infer<typeof ProjectSchema>
export type ProjectCompleteness = z.infer<typeof ProjectCompletenessSchema>
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>
export type ProjectTimelineEntry = z.infer<typeof ProjectTimelineEntrySchema>
export type AssignmentQueueItem = z.infer<typeof AssignmentQueueItemSchema>
export type CreateProjectInput = Pick<Project, 'client_id' | 'name' | 'status' | 'start_date' | 'end_date' | 'address' | 'notes'> & { company_id: string; investment_address?: string | null }
