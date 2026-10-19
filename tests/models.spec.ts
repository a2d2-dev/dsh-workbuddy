/** Wire-boundary tests for live model metadata. */
import { describe, expect, it } from 'vitest'
import { parseModels } from '../src/models.js'
import { gatewayURL, type Config } from '../src/backend.js'

const entry = { id: 'account-model', name: 'Account model', contextWindow: 1000000,
  maxTokens: 128000, supportsImages: true, reasoningEfforts: ['low', 'high'] }

describe('account model discovery', () => {
  it('preserves actual capacities, modalities and supported reasoning levels', () => {
    const [model] = parseModels({ data: [entry] }, 'http://gateway.test')
    expect(model.contextWindow).toBe(1000000)
    expect(model.maxTokens).toBe(128000)
    expect(model.input).toEqual(['text', 'image'])
    expect(model.thinkingLevelMap?.high).toBe('high')
    expect(model.thinkingLevelMap?.max).toBeNull()
    expect(model.baseUrl).toBe('http://gateway.test/v1')
  })
  it('advertises no models after sign-out', () => {
    expect(parseModels({ data: [] }, 'http://gateway.test')).toEqual([])
  })
  it('distinguishes same-name routes and labels only explicitly free models', () => {
    const models = parseModels({ data: [
      { ...entry, id: 'flash', billing: { free: true } },
      { ...entry, id: 'flash-sg', billing: { free: false, label: 'x0.03' } },
    ] }, 'http://gateway.test')
    expect(models.map(model => model.name)).toEqual(['flash [Free]', 'flash-sg'])
    expect(parseModels({ data: [entry] }, 'http://gateway.test')[0].name).toBe(entry.name)
  })
  it.each([{ data: [entry, entry] }, { data: [{ ...entry, maxTokens: 0 }] }, {},
    { data: [{ ...entry, contextWindow: '1000000' }] }])('rejects malformed capabilities', body => {
    expect(() => parseModels(body, 'http://gateway.test')).toThrow()
  })
  it.each(['https://key@gateway.test', 'file:///secret', 'https://gateway.test?key=x'])('refuses credential-bearing or non-HTTP origins', gatewayBaseURL => {
    expect(() => gatewayURL({ gatewayBaseURL, gatewayKeyFile: '/secret' } as Config)).toThrow()
  })
  it.each(['http://gateway.test', 'http://localhost.evil.test', 'http://192.0.2.1'])('rejects plaintext remote gateway credentials for %s', gatewayBaseURL => {
    expect(() => gatewayURL({ gatewayBaseURL, gatewayKeyFile: '/secret' } as Config)).toThrow('HTTPS')
  })
  it.each(['http://localhost:18788', 'http://127.0.0.1:18788', 'http://[::1]:18788', 'https://gateway.test'])('accepts secure or loopback gateway %s', gatewayBaseURL => {
    expect(gatewayURL({ gatewayBaseURL, gatewayKeyFile: '/secret' } as Config)).toBe(gatewayBaseURL)
  })
})
