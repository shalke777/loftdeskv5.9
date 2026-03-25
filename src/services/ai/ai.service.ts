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

export const aiService = {
  async summarize(text: string) {
    return `Podsumowanie: ${text.slice(0, 120)}`
  },
}
