/** DSH-authenticated account controls; upstream tokens never enter the browser. */
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Backend, record } from './backend.js'
import { modelDetails, quotaDetails } from './details.js'

type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<void>
type Rejection = (request: IncomingMessage) => number | undefined

/** Bind a pending login to the authenticated browser and DSH authority.
 * @param request Incoming browser request. @returns Opaque owner id.
 */
function owner(request: IncomingMessage): string {
  const cookies = (request.headers.cookie ?? '').split(';').map(value => value.trim())
    .filter(value => value.startsWith('dsh-auth-')).sort().join(';')
  return createHash('sha256').update(`${request.headers.host}\n${cookies}`).digest('hex')
}

/** Send an uncached JSON response.
 * @param response HTTP response. @param status HTTP status. @param body Safe response payload.
 */
function json(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

/** Create account routes guarded by DSH authentication and same-origin checks.
 * @param backend Gateway transport. @param reject DSH request trust guard. @param changed Invalidate model snapshots.
 * @returns HTTP route handler.
 */
export function createHandler(backend: Backend, reject: Rejection, changed: () => void): Handler {
  return new AccountRoutes(backend, reject, changed).handle
}

/** Browser-bound state owned by one mounted plugin instance. */
class AccountRoutes {
  constructor(private backend: Backend, private reject: Rejection, private changed: () => void) {}
  private pending: { owner: string; loginId: string; authorizationUrl: string; expires: number } | undefined
  private starting = false

  /** Authenticate before routing. @param request Browser request. @param response HTTP response. */
  handle: Handler = async (request, response) => {
    const rejection = this.reject(request)
    if (rejection !== undefined) { json(response, rejection, { ok: false, error: 'Sign in to DSH first' }); return }
    if (request.headers['x-workbuddy'] !== '1') { json(response, 403, { ok: false, error: 'Missing WorkBuddy request header' }); return }
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    try {
      if (path === '/api/workbuddy/details' && request.method === 'GET') {
        await this.details(response); return
      }
      if (path === '/api/workbuddy/status' && request.method === 'GET') {
        const pending = this.pending
        const authorizationUrl = pending && pending.owner === owner(request) && pending.expires > Date.now()
          ? pending.authorizationUrl : undefined
        json(response, 200, { ok: true, ...await status(this.backend), authorizationUrl }); return
      }
      if (path === '/api/workbuddy/connect/start' && request.method === 'POST') {
        await this.start(request, response); return
      }
      await this.mutate(request, response)
    } catch { json(response, 502, { ok: false, error: 'WorkBuddy request failed; check gateway service logs' }) }
  }

  /** Load public catalog and balance details. @param response Authenticated browser response. */
  private async details(response: ServerResponse): Promise<void> {
    const [catalog, credits] = await Promise.all([
      this.backend.request('/workbuddy/models'), this.backend.request('/v1/credits').catch(() => {
        console.warn('WorkBuddy credit lookup failed; displaying quota as unavailable')
        return { available: false }
      }),
    ])
    json(response, 200, { ok: true, details: { models: modelDetails(catalog, this.backend.baseURL),
      quota: quotaDetails(credits), updatedAt: new Date().toISOString() } })
  }

  /** Start one browser-bound login. @param request Owner request. @param response HTTP response. */
  private async start(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (this.pending && this.pending.expires > Date.now() && this.pending.owner === owner(request)) {
      json(response, 200, { ok: true, authorizationUrl: this.pending.authorizationUrl }); return
    }
    if (this.starting || this.pending && this.pending.expires > Date.now()) {
      json(response, 409, { ok: false, error: 'WorkBuddy sign-in already pending' }); return
    }
    this.starting = true
    try {
      const result = await this.backend.request('/workbuddy/connect/start', {})
      if (!record(result) || typeof result.loginId !== 'string' || typeof result.authorizationUrl !== 'string') throw new Error('Invalid WorkBuddy sign-in response')
      const authorization = new URL(result.authorizationUrl)
      if (authorization.origin !== 'https://www.workbuddy.ai' && authorization.origin !== 'https://www.codebuddy.ai') throw new Error('Unexpected WorkBuddy authorization origin')
      this.pending = { owner: owner(request), loginId: result.loginId, authorizationUrl: authorization.href, expires: Date.now() + 300000 }
      json(response, 200, { ok: true, authorizationUrl: authorization.href })
    } finally { this.starting = false }
  }

  /** Dispatch account mutations. @param request Browser request. @param response HTTP response. */
  private async mutate(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    if (request.method !== 'POST') { json(response, 405, { ok: false, error: 'Method not allowed' }); return }
    if (path === '/api/workbuddy/connect/finish') { await this.finish(request, response); return }
    if (path === '/api/workbuddy/logout') {
      await this.backend.request('/workbuddy/logout', {}); this.pending = undefined; this.changed()
      json(response, 200, { ok: true }); return
    }
    if (path === '/api/workbuddy/refresh') {
      await this.backend.request('/workbuddy/models'); this.changed()
      json(response, 200, { ok: true, ...await status(this.backend) }); return
    }
    json(response, 404, { ok: false, error: 'Not found' })
  }

  /** Complete only this browser's pending login. @param request Owner request. @param response HTTP response. */
  private async finish(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const login = this.pending
    if (!login || login.owner !== owner(request) || login.expires <= Date.now()) {
      json(response, 410, { ok: false, error: 'WorkBuddy sign-in expired' }); return
    }
    const result = await this.backend.request('/workbuddy/connect/finish', { loginId: login.loginId })
    if (!record(result) || typeof result.connected !== 'boolean') throw new Error('Invalid login completion')
    if (result.connected && this.pending === login) { this.pending = undefined; this.changed() }
    json(response, 200, { ok: true, connected: result.connected })
  }
}

/** Validate the public account status returned by the gateway.
 * @param backend Gateway transport. @returns Browser-safe account status.
 */
async function status(backend: Backend): Promise<object> {
  const value = await backend.request('/workbuddy/status')
  if (!record(value) || typeof value.connected !== 'boolean') throw new Error('Invalid WorkBuddy status')
  return { connected: value.connected, account: typeof value.account === 'string' ? value.account : '',
    models: typeof value.models === 'number' ? value.models : 0 }
}
