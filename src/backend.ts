/** Authenticated transport to the independently supervised WorkBuddy gateway. */
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import z from '@deepseek-ai/schemastery'

export interface Config {
  gatewayBaseURL: string
  gatewayKeyFile: string
  requestTimeoutMs: number
  catalogTtlMs: number
  streamIdleTimeoutMs: number
}
export const Config = z.object({
  gatewayBaseURL: z.string().required(), gatewayKeyFile: z.string().required(),
  requestTimeoutMs: z.number().min(1000).max(120000).default(30000),
  catalogTtlMs: z.number().min(1000).default(60000),
  streamIdleTimeoutMs: z.number().min(1000).default(300000),
})

/** Validate deployment destinations before any credential can leave this process.
 * @param config Gateway configuration. @returns Normalized gateway URL.
 */
export function gatewayURL(config: Config): string {
  const url = new URL(config.gatewayBaseURL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') throw new Error('gatewayBaseURL must be an HTTP(S) origin')
  if (!isAbsolute(config.gatewayKeyFile)) throw new Error('gatewayKeyFile must be absolute')
  return url.origin
}

/** Gateway requests never expose their credential in responses or diagnostics. */
export class Backend {
  readonly baseURL: string
  constructor(readonly config: Config) { this.baseURL = gatewayURL(config) }

  /** Read the separately provisioned secret. @returns Bearer credential. */
  async key(): Promise<string> {
    const value = (await readFile(this.config.gatewayKeyFile, 'utf8')).trim()
    if (!value || /\s/.test(value)) throw new Error('Invalid WorkBuddy gateway credential file')
    return value
  }

  /** Request a JSON control-plane resource.
   * @param path Fixed API path. @param body Optional POST body. @param signal Caller cancellation.
   * @returns Parsed JSON for validation by its owning consumer.
   */
  async request(path: string, body?: object, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${await this.key()}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([AbortSignal.timeout(this.config.requestTimeoutMs), ...(signal ? [signal] : [])]),
    })
    if (!response.ok) { await response.body?.cancel(); throw new Error(`WorkBuddy gateway returned HTTP ${response.status}`) }
    return response.json()
  }
}

/** Narrow JSON objects received over the wire. @param value Parsed JSON. @returns Whether it is an object. */
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
