/** Independently installable WorkBuddy account provider and authenticated Web routes. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { Backend, Config } from './backend.js'
import { WorkBuddyAdapter } from './adapter.js'
import { createHandler } from './routes.js'
import { PROVIDER } from './models.js'
export { Config } from './backend.js'
export const name = 'workbuddy'
export const inject = ['llm', 'connection', 'webServer']

/** Register the account provider and browser routes with reversible effects.
 * @param ctx DSH plugin context. @param config Gateway deployment configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const backend = new Backend(config)
  const adapter = new WorkBuddyAdapter(backend, ctx)
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/api/workbuddy',
    handler: createHandler(backend, request => ctx.connection.requestRejection(request), () => {
      adapter.invalidate(); registration.replace([PROVIDER])
    }),
  }), 'workbuddy: authenticated account routes')
}
