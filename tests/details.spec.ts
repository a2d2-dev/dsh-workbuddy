/** Verify public quota and model details cannot expose credentials or invent balances. */
import { expect, it } from 'vitest'
import { modelDetails, quotaDetails } from '../src/details.js'
import { readDetails } from '../src/details-wire.js'

it('preserves actual credit packages without forwarding private response fields', () => {
  const result = quotaDetails({ available: true, total_remain: 75, total_size: 100, secret: 'hidden',
    accounts: [{ PackageName: 'Free Plan', CapacityRemainPrecise: 75, CapacitySizePrecise: 100,
      CycleEndTime: '2026-10-31 23:59:59', accountId: 'private' }] })
  expect(result).toEqual({ available: true, remaining: 75, total: 100,
    packages: [{ name: 'Free Plan', remaining: 75, total: 100, expires: '2026-10-31 23:59:59' }] })
})

it('marks unavailable and malformed balances as unknown', () => {
  expect(quotaDetails({ available: false, detail: 'sensitive upstream error' })).toEqual({ available: false, remaining: 0, total: 0, packages: [] })
  expect(quotaDetails({ available: true, total_remain: NaN, total_size: 100, accounts: [] }).available).toBe(false)
})

it('retains billing metadata and capabilities through the browser wire boundary', () => {
  const models = modelDetails({ data: [{ id: 'flash', name: 'Flash', contextWindow: 1000000, maxTokens: 128000,
    supportsImages: true, reasoningEfforts: ['high'], apiKey: 'secret', billing: { free: true, label: 'x0.00', promotionEndsAt: '2026-11-01T00:00:00+08:00' } }] }, 'http://gateway.test')
  expect(models[0]).toMatchObject({ id: 'flash', free: true, billingLabel: 'x0.00', vision: true, reasoning: true })
  expect(models[0]).not.toHaveProperty('apiKey')
  expect(readDetails({ models, quota: quotaDetails({}), updatedAt: '2026-10-16T00:00:00Z' }).models).toEqual(models)
  expect(() => readDetails({ models: [{}], quota: {}, updatedAt: '' })).toThrow()
})
