/** Safe account details shared by the host route and settings renderer. */
import { record } from './backend.js'
import { parseModels } from './models.js'
import { amount, type CreditPackage, type Quota, type ModelDetail } from './details-wire.js'

/** Keep billing failures explicit, without forwarding upstream errors or account identifiers.
 * @param value Upstream credit response. @returns Sanitized balances and package dates.
 */
export function quotaDetails(value: unknown): Quota {
  const unavailable: Quota = { available: false, remaining: 0, total: 0, packages: [] }
  if (!record(value) || value.available !== true || !amount(value.total_remain) || !amount(value.total_size)
    || !Array.isArray(value.accounts)) return unavailable
  const packages: CreditPackage[] = []
  for (const item of value.accounts) {
    if (!record(item) || typeof item.PackageName !== 'string' || !amount(item.CapacityRemainPrecise)
      || !amount(item.CapacitySizePrecise)) return unavailable
    packages.push({ name: item.PackageName.slice(0, 200), remaining: item.CapacityRemainPrecise,
      total: item.CapacitySizePrecise, expires: text(item.CycleEndTime) })
  }
  return { available: true, remaining: value.total_remain, total: value.total_size, packages }
}

/** Project the live catalog into settings rows, retaining only public display fields.
 * @param payload Gateway catalog. @param baseURL Validated transport origin. @returns Safe model rows.
 */
export function modelDetails(payload: unknown, baseURL: string): ModelDetail[] {
  const parsed = parseModels(payload, baseURL)
  if (!record(payload) || !Array.isArray(payload.data)) throw new Error('Invalid catalog')
  const data = payload.data
  return parsed.map((model, index) => {
    const source = data[index] as Record<string, unknown>
    const billing = record(source.billing) ? source.billing : {}
    return { id: model.id, name: typeof source.name === 'string' ? source.name : model.id,
      contextWindow: model.contextWindow, maxTokens: model.maxTokens, vision: model.input.includes('image'),
      reasoning: model.reasoning, description: text(source.description), descriptionZh: text(source.descriptionZh),
      billingLabel: text(billing.label), free: billing.free === true, promotionEndsAt: text(billing.promotionEndsAt),
      promotionText: text(billing.promotionText), promotionTextZh: text(billing.promotionTextZh) }
  })
}

/** Bound a public upstream string. @param value Wire value. @returns Safe display text. */
function text(value: unknown): string { return typeof value === 'string' ? value.slice(0, 1000) : '' }
