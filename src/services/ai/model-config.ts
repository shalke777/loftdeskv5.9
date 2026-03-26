// =============================================================================
// Model Config — AI model configuration for Scope Engine
// =============================================================================
// Centralized model selection. Reads from env vars with sensible defaults.
// Ready for future A/B testing, model rotation, and cost tracking.

export interface ModelConfig {
  vision: string       // model for room photo analysis (needs vision capability)
  estimate: string     // model for estimate generation (text-only, future)
  document: string     // model for document/invoice OCR (text-only)
}

/**
 * Get model configuration from environment variables.
 * Server-side: reads process.env directly.
 * Client-side: not used (models are set server-side only).
 */
export function getModelConfig(): ModelConfig {
  return {
    vision:   process.env.OPENAI_MODEL_VISION?.trim()   || process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
    estimate: process.env.OPENAI_MODEL_ESTIMATE?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
    document: process.env.OPENAI_MODEL_DOCUMENT?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  }
}
