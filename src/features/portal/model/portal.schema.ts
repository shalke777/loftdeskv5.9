export interface PortalMessage {
  author: 'client' | 'company'
  text: string
  created_at: string
}

export interface PortalDecisionResult {
  status: 'accepted' | 'rejected'
  ok: boolean
}
