import { z } from 'zod'

export const InvitationRoleSchema = z.enum(['owner', 'admin', 'manager', 'worker', 'accountant'])
export const InvitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked'])

export const InvitationSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  email: z.string().email(),
  role: InvitationRoleSchema,
  token: z.string(),
  invited_by: z.string().nullable().optional(),
  status: InvitationStatusSchema,
  expires_at: z.string(),
  created_at: z.string(),
})

export type Invitation = z.infer<typeof InvitationSchema>
export type InvitationRole = z.infer<typeof InvitationRoleSchema>
