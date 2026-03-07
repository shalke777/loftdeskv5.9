import { z } from 'zod'

export const CustomParagraphSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  sort_order: z.number().int().default(0),
})

export const ContractTrancheSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  amount: z.number().nonnegative(),
  percent: z.number().min(0).max(100).optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(['planned', 'invoiced', 'paid']).default('planned'),
  condition: z.string().optional(),
})

export const ContractSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  client_id: z.string().nullable(),
  project_id: z.string().nullable(),
  estimate_id: z.string().nullable().optional(),
  number: z.string(),
  status: z.enum(['unsigned', 'signed']),
  sign_date: z.string().nullable(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  location: z.string().optional(),
  value: z.number().nonnegative(),
  value_net: z.number().nonnegative().optional(),
  vat_rate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  template_name: z.string().optional(),
  template_content: z.string().optional(),
  created_at: z.string(),
  tranches: z.array(ContractTrancheSchema).optional().default([]),
  custom_paragraphs: z.array(CustomParagraphSchema).optional().default([]),
})

export type Contract = z.infer<typeof ContractSchema>
export type ContractTranche = z.infer<typeof ContractTrancheSchema>
export type CustomParagraph = z.infer<typeof CustomParagraphSchema>
export type CreateContractInput = Pick<Contract, 'client_id' | 'project_id' | 'estimate_id' | 'status' | 'sign_date' | 'start_date' | 'end_date' | 'location' | 'value' | 'value_net' | 'vat_rate' | 'notes' | 'template_name' | 'template_content' | 'tranches' | 'custom_paragraphs'> & { company_id: string }
