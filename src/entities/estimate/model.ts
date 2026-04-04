import { z } from 'zod'

export const EstimateItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default('m²'),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  vat_rate: z.number().min(0).max(100).default(23),
  sort_order: z.number().int(),
  catalog_item_id: z.string().nullable().optional(),
})

export const EstimateSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  client_id: z.string().nullable(),
  project_id: z.string().nullable().optional(),
  number: z.string(),
  name: z.string().min(1, 'Nazwa jest wymagana'),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  total_net: z.number(),
  total_gross: z.number(),
  notes: z.string().optional(),
  valid_until: z.string().nullable(),
  created_at: z.string(),
  items: z.array(EstimateItemSchema),
})

export type Estimate = z.infer<typeof EstimateSchema>
export type EstimateItem = z.infer<typeof EstimateItemSchema>
export type CreateEstimateInput = Pick<Estimate, 'name' | 'client_id' | 'notes' | 'status' | 'valid_until'> & {
  company_id:        string
  project_id?:       string | null
  items?:            EstimateItem[]
  /** Sprint 4: links this draft to the AI analysis run that produced it. */
  ai_source_run_id?: string | null
}
