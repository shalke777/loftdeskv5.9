// Re-export analysis pipeline types — canonical home for multimodal analysis
export type {
  AnalysisResult,
  AnalysisInputType,
  AnalysisDocumentType,
  DocumentFields,
  DocumentLineItem,
  DetectedEntity,
  DetectedMaterial,
  WorkScopeItem,
  SuggestedEstimateItem,
  SectionConfidence,
} from './analysis.types'
export { toAnalysisResult, flattenAnalysisResult, classifyInputType, rehydrateAnalysisResult } from './analysis.types'

// ── v2 Input Classifier ───────────────────────────────────────────────────────
export type { InputType, InputClassification } from './input-classifier'
export { classifyInput, inputTypeToLegacy } from './input-classifier'

// ── v2 Engine Types ───────────────────────────────────────────────────────────
export type {
  PartyRole, Party, DocumentSubtype, DocumentAmount, PaymentInfo,
  DocumentAnalysisResult,
} from './engines/document.types'
export type {
  StageOfWork, DetectedElement,
  ScopeItem, QuantityHint, RoomAnalysisResult,
} from './engines/room.types'

export const aiService = {
  async summarize(text: string) {
    return `Podsumowanie: ${text.slice(0, 120)}`
  },
}

