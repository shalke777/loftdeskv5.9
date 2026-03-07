import { z } from 'zod'

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  nip: z.string().optional(),
  plan: z.enum(['free', 'pro', 'business', 'admin']),
})

export type Company = z.infer<typeof CompanySchema>
