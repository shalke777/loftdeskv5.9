import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  nip: z.string().optional(),
  contact_person: z.string().optional(),
  created_at: z.string(),
})

export type Client = z.infer<typeof ClientSchema>
