import { demoDb } from '@/shared/lib/demoDb'

export const dashboardApi = {
  async getStats(companyId: string) {
    return demoDb.dashboard(companyId)
  },
}
