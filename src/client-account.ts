/** Browser-side account operations with component-lifetime cancellation. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CopyKey } from './i18n.js'
import { readDetails, type AccountDetails } from './details-wire.js'

export type Translator = (key: CopyKey) => string
interface Status { connected: boolean; account: string; models: number; details: AccountDetails | null }
class AccountError extends Error {
  constructor(readonly expired: boolean, message: string) { super(message) }
}

/** Fetch a DSH account operation. @param path Operation. @param signal Cancellation. @returns Safe JSON fields. */
async function request(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/workbuddy/${path}`, { method: ['status', 'details'].includes(path) ? 'GET' : 'POST',
    headers: { 'x-workbuddy': '1' }, cache: 'no-store', signal })
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('ok' in body) || body.ok !== true || !response.ok) throw new AccountError(response.status === 410, `HTTP ${response.status}`)
  return body as Record<string, unknown>
}

/** Wait between login polls without keeping an unmounted settings view alive.
 * @param signal View lifetime. @returns Completion after two seconds.
 */
function pause(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Cancelled')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
    signal.addEventListener('abort', abort, { once: true })
  })
}

/** Await the server-owned browser authorization.
 * @param signal View lifetime. @returns Completion once the account is connected.
 */
async function finishLogin(signal: AbortSignal): Promise<void> {
  const deadline = Date.now() + 300000
  while (Date.now() < deadline) {
    await pause(signal)
    if ((await request('connect/finish', signal)).connected === true) return
  }
  throw new AccountError(true, 'Authorization timed out')
}

/** Account state and commands for one mounted settings view.
 * @param t Locale translator. @returns Render state and account commands.
 */
function useAccountState(t: Translator) {
  const [status, setStatus] = useState<Status>({ connected: false, account: '', models: 0, details: null })
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [authorizationUrl, setAuthorizationUrl] = useState('')
  const controller = useRef(new AbortController())
  const load = useCallback(async (signal: AbortSignal) => {
    let body = await request('status', signal)
    if (typeof body.authorizationUrl === 'string') {
      setAuthorizationUrl(body.authorizationUrl); setMessage(t('waiting'))
      await finishLogin(signal)
      setAuthorizationUrl(''); setMessage('')
      body = await request('status', signal)
    }
    if (typeof body.connected !== 'boolean' || typeof body.account !== 'string' || typeof body.models !== 'number') throw new Error('Invalid account status')
    const basic = { connected: body.connected, account: body.account, models: body.models, details: null }
    setStatus(basic)
    if (body.connected) {
      const details = readDetails((await request('details', signal)).details)
      setStatus({ ...basic, details })
    }
  }, [t])
  useEffect(() => {
    const lifetime = new AbortController(); controller.current = lifetime
    load(lifetime.signal).catch(error => {
      if (!lifetime.signal.aborted) {
        setAuthorizationUrl('')
        setMessage(t(error instanceof AccountError && error.expired ? 'expired' : 'error'))
      }
    })
      .finally(() => { if (!lifetime.signal.aborted) setBusy(false) })
    return () => lifetime.abort()
  }, [load, t])
  return { status, busy, message, authorizationUrl, controller, load, setBusy, setMessage, setAuthorizationUrl }
}

/** Bind account commands to the mounted view and its current locale.
 * @param t Locale translator. @returns Account state and cancellable commands.
 */
export function useAccount(t: Translator) {
  const state = useAccountState(t)
  const { controller, load, setBusy, setMessage, setAuthorizationUrl } = state
  const perform = async (operation: (signal: AbortSignal) => Promise<void>) => {
    const signal = controller.current.signal
    setBusy(true); setMessage('')
    try { await operation(signal) } catch (error) {
      if (!signal.aborted) { setAuthorizationUrl(''); setMessage(t(error instanceof AccountError && error.expired ? 'expired' : 'error')) }
    }
    finally { if (!signal.aborted) setBusy(false) }
  }
  const connect = () => perform(async signal => {
    const body = await request('connect/start', signal)
    if (typeof body.authorizationUrl !== 'string') throw new Error('Missing authorization URL')
    setAuthorizationUrl(body.authorizationUrl); setMessage(t('waiting'))
    await finishLogin(signal)
    setAuthorizationUrl(''); setMessage(''); await load(signal)
  })
  const refresh = () => perform(async signal => { await request('refresh', signal); await load(signal) })
  const disconnect = () => perform(async signal => {
    await request('logout', signal); setAuthorizationUrl(''); await load(signal)
  })
  return { ...state, connect, refresh, disconnect }
}
