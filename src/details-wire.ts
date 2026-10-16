/** Browser-safe account detail types and wire validation, with no host imports. */
export interface ModelDetail {
  id: string; name: string; contextWindow: number; maxTokens: number; vision: boolean; reasoning: boolean
  description: string; billingLabel: string; free: boolean; promotionEndsAt: string; promotionText: string
}
export interface CreditPackage { name: string; remaining: number; total: number; expires: string }
export interface Quota { available: boolean; remaining: number; total: number; packages: CreditPackage[] }
export interface AccountDetails { models: ModelDetail[]; quota: Quota; updatedAt: string }

/** Validate the browser response before it enters React state.
 * @param value Sanitized host response. @returns Validated account details.
 */
export function readDetails(value: unknown): AccountDetails {
  if (!record(value) || !Array.isArray(value.models) || !record(value.quota) || typeof value.updatedAt !== 'string') throw new Error('Invalid WorkBuddy details')
  for (const model of value.models) {
    if (!record(model) || !['id', 'name', 'description', 'billingLabel', 'promotionEndsAt', 'promotionText'].every(key => typeof model[key] === 'string')
      || !amount(model.contextWindow) || !amount(model.maxTokens)
      || !['vision', 'reasoning', 'free'].every(key => typeof model[key] === 'boolean')) throw new Error('Invalid model details')
  }
  const quota = value.quota
  if (typeof quota.available !== 'boolean' || !amount(quota.remaining) || !amount(quota.total) || !Array.isArray(quota.packages)) throw new Error('Invalid quota details')
  for (const item of quota.packages) {
    if (!record(item) || typeof item.name !== 'string' || typeof item.expires !== 'string'
      || !amount(item.remaining) || !amount(item.total)) throw new Error('Invalid credit package')
  }
  return value as unknown as AccountDetails
}

/** Check finite, nonnegative credit values. @param value Wire value. @returns Numeric validity. */
export function amount(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 }
/** Narrow a JSON object. @param value Wire value. @returns Object validity. */
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
