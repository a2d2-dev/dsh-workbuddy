/** Convert the live WorkBuddy catalog into pi-ai model capabilities. */
import { createProvider, type Api, type Model, type ModelThinkingLevel } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { record } from './backend.js'
import { en } from './i18n.js'

export const PROVIDER = 'workbuddy'
export const DISPLAY_NAME = 'WorkBuddy'
const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Require positive token capacities supplied by the backend.
 * @param value Capacity. @returns Valid capacity.
 */
function capacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid WorkBuddy model capacity')
  return value
}

/** Parse a sanitized gateway catalog without guessing model capacities.
 * @param payload Gateway response. @param baseURL Authenticated gateway origin.
 * @returns Model definitions supported by the existing pi-ai transport.
 */
export function parseModels(payload: unknown, baseURL: string): Model<Api>[] {
  if (!record(payload) || !Array.isArray(payload.data)) throw new Error('Invalid WorkBuddy model catalog')
  const seen = new Set<string>()
  const names = payload.data.filter(record).map(value => value.name)
  return payload.data.map(value => {
    if (!record(value) || typeof value.id !== 'string' || !value.id || seen.has(value.id)) throw new Error('Invalid or duplicate WorkBuddy model id')
    seen.add(value.id)
    const supported = Array.isArray(value.reasoningEfforts) ? value.reasoningEfforts : []
    const thinkingLevelMap: Partial<Record<ModelThinkingLevel, string | null>> = {}
    for (const level of LEVELS) thinkingLevelMap[level] = supported.includes(level) ? level : null
    return {
      id: value.id, name: modelName(value, names),
      api: 'openai-completions', provider: PROVIDER, baseUrl: `${baseURL}/v1`,
      contextWindow: capacity(value.contextWindow), maxTokens: capacity(value.maxTokens),
      input: value.supportsImages === true ? ['text', 'image'] : ['text'],
      reasoning: supported.length > 0, ...(supported.length ? { thinkingLevelMap } : {}),
      // Required pi-ai placeholder, matching DSH's NO_COST; actual billing is account Credits.
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens',
        supportsReasoningEffort: supported.length > 0, supportsUsageInStreaming: true, supportsStrictMode: false },
    }
  })
}

/** Distinguish duplicate upstream names and show explicit free pricing.
 * @param value Validated catalog entry. @param names Upstream names. @returns Selector label.
 */
function modelName(value: Record<string, unknown>, names: unknown[]): string {
  const name = typeof value.name === 'string' && names.filter(name => name === value.name).length === 1
    ? value.name : String(value.id)
  return record(value.billing) && value.billing.free === true ? `${name} [${en.free}]` : name
}

/** Build one immutable provider snapshot.
 * @param models Current account catalog. @returns pi-ai provider with standard streaming transport.
 */
export function createWorkBuddyProvider(models: Model<Api>[]) {
  return createProvider({ id: PROVIDER, name: DISPLAY_NAME,
    auth: { apiKey: { name: DISPLAY_NAME, resolve: async () => ({ auth: {}, source: 'WorkBuddy gateway' }) } },
    models, api: { 'openai-completions': openAICompletionsApi() } })
}
