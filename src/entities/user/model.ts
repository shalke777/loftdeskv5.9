import { z } from 'zod'

export const AppUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  companyId: z.string(),
  role: z.enum(['owner', 'admin', 'manager', 'worker', 'accountant']),
})

export type AppUser = z.infer<typeof AppUserSchema>
