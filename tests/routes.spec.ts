/** Authenticate account mutations and isolate pending browser authorization. */
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { Backend, type Config } from '../src/backend.js'
import { createHandler } from '../src/routes.js'

class FakeBackend extends Backend {
  calls: string[] = []
  override async request(path: string): Promise<unknown> {
    this.calls.push(path)
    if (path.endsWith('/start')) return { loginId: 'server-side-login-secret', authorizationUrl: 'https://www.workbuddy.ai/login?state=test' }
    return { connected: true, account: 'test-account', models: 2 }
  }
}

async function fixture() {
  const backend = new FakeBackend({ gatewayBaseURL: 'https://gateway.test', gatewayKeyFile: '/secret' } as Config)
  const changed = vi.fn()
  const handler = createHandler(backend, req => req.headers.host !== '127.0.0.1' ? 403
    : req.headers.cookie?.includes('dsh-auth-test=owner') ? undefined : 401, changed)
  const server = createServer((req, res) => { void handler(req, res) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const send = (path: string, method = 'POST', headers: Record<string, string> = {}) => new Promise<Response>((resolve, reject) => {
    const operation = request({ hostname: '127.0.0.1', port: (server.address() as AddressInfo).port,
      path: `/api/workbuddy/${path}`, method,
      headers: { host: '127.0.0.1', cookie: 'dsh-auth-test=owner', 'x-workbuddy': '1', ...headers } }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('error', reject)
      response.on('end', () => resolve(new Response(Buffer.concat(chunks).toString(), { status: response.statusCode })))
    })
    operation.on('error', reject); operation.end()
  })
  return { send, backend, changed, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) } }
}

describe('WorkBuddy browser controls', () => {
  it('rejects untrusted, signed-out and cross-origin-form requests before delegation', async () => {
    const fixtureValue = await fixture()
    try {
      expect((await fixtureValue.send('logout', 'POST', { cookie: '' })).status).toBe(401)
      expect((await fixtureValue.send('logout', 'POST', { host: 'evil.test' })).status).toBe(403)
      expect((await fixtureValue.send('logout', 'POST', { 'x-workbuddy': '' })).status).toBe(403)
      expect(fixtureValue.backend.calls).toEqual([])
    } finally { await fixtureValue.close() }
  })
  it('keeps login identifiers server-side and refuses another browser and replay', async () => {
    const fixtureValue = await fixture()
    try {
      const started = await fixtureValue.send('connect/start')
      expect(await started.json()).toEqual({ ok: true, authorizationUrl: 'https://www.workbuddy.ai/login?state=test' })
      expect((await fixtureValue.send('connect/finish', 'POST', { cookie: 'dsh-auth-test=owner; dsh-auth-other=browser' })).status).toBe(410)
      expect((await fixtureValue.send('connect/finish')).status).toBe(200)
      expect((await fixtureValue.send('connect/finish')).status).toBe(410)
      expect(fixtureValue.changed).toHaveBeenCalledOnce()
    } finally { await fixtureValue.close() }
  })
  it('only allows POST for signing out', async () => {
    const fixtureValue = await fixture()
    try {
      expect((await fixtureValue.send('logout', 'GET')).status).toBe(405)
      expect(fixtureValue.backend.calls).toEqual([])
    } finally { await fixtureValue.close() }
  })
  it('resumes the same browser login after remount without exposing it to another browser', async () => {
    const fixtureValue = await fixture()
    try {
      const initial = await (await fixtureValue.send('connect/start')).json()
      expect(await (await fixtureValue.send('connect/start')).json()).toEqual(initial)
      expect(await (await fixtureValue.send('status', 'GET')).json()).toMatchObject(initial)
      expect(await (await fixtureValue.send('status', 'GET', { cookie: 'dsh-auth-test=owner; dsh-auth-other=different' })).json())
        .not.toHaveProperty('authorizationUrl')
      expect(fixtureValue.backend.calls.filter(path => path.endsWith('/start'))).toHaveLength(1)
    } finally { await fixtureValue.close() }
  })
})
