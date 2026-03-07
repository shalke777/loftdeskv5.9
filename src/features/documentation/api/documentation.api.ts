import type { ClientDecision, DocumentationOverview, HandoverProtocol, PhotoDocumentation, TechnicalStandard } from '@/entities/documentation/model'
import { documentationStore } from '@/shared/lib/documentationStore'

export const documentationApi = {
  async overview(companyId: string): Promise<DocumentationOverview> {
    return documentationStore.getOverview(companyId)
  },
  async createDecision(input: Omit<ClientDecision, 'id' | 'requested_at' | 'decided_at'>) {
    return documentationStore.decisions.create(input)
  },
  async updateDecision(id: string, input: Partial<ClientDecision>) {
    return documentationStore.decisions.update(id, input)
  },
  async decide(id: string, status: ClientDecision['status'], comment?: string) {
    return documentationStore.decisions.decide(id, status, comment)
  },
  async deleteDecision(id: string) {
    documentationStore.decisions.remove(id)
    return { ok: true }
  },
  async createProtocol(input: Omit<HandoverProtocol, 'id'>) {
    return documentationStore.protocols.create(input)
  },
  async updateProtocol(id: string, input: Partial<HandoverProtocol>) {
    return documentationStore.protocols.update(id, input)
  },
  async decideProtocol(id: string, status: HandoverProtocol['status']) {
    return documentationStore.protocols.decide(id, status)
  },
  async deleteProtocol(id: string) {
    documentationStore.protocols.remove(id)
    return { ok: true }
  },
  async createPhoto(input: Omit<PhotoDocumentation, 'id'>) {
    return documentationStore.photos.create(input)
  },
  async updatePhoto(id: string, input: Partial<PhotoDocumentation>) {
    return documentationStore.photos.update(id, input)
  },
  async deletePhoto(id: string) {
    documentationStore.photos.remove(id)
    return { ok: true }
  },
  async createStandard(input: Omit<TechnicalStandard, 'id'>) {
    return documentationStore.standards.create(input)
  },
  async updateStandard(id: string, input: Partial<TechnicalStandard>) {
    return documentationStore.standards.update(id, input)
  },
  async acceptStandard(id: string) {
    return documentationStore.standards.accept(id)
  },
  async deleteStandard(id: string) {
    documentationStore.standards.remove(id)
    return { ok: true }
  },
}
