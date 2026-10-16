/** Native DSH settings section for the remote WorkBuddy account. */
import React from 'react'
import { Button, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh, type CopyKey } from './i18n.js'
import { useAccount, type Translator } from './client-account.js'
import { AccountSummary, Details } from './client-details.js'

declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { workbuddy: CopyKey } }
export const inject = ['slots', 'locale']

/** Account controls rendered within the existing settings layout.
 * @param props Localized strings. @returns WorkBuddy settings content.
 */
function Section({ t }: { t: Translator }) {
  const { status, busy, message, authorizationUrl, connect, refresh, disconnect } = useAccount(t)
  return <section style={{ maxWidth: 720, minWidth: 0, display: 'grid', gap: 16 }}>
    <h2 style={{ margin: 0, fontSize: 18 }}>{t('title')}</h2>
    <div role="status" aria-live="polite">{busy && !message ? t('checking') : status.connected ? t('connected') : t('disconnected')}</div>
    {status.connected && <AccountSummary account={status.account} models={status.models} details={status.details} t={t} />}
    {message && <p role="status" style={{ margin: 0 }}>{message}</p>}
    {authorizationUrl && <a href={authorizationUrl} target="_blank" rel="noopener noreferrer">{t('open')}</a>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {!status.connected && <Button variant="primary" size="sm" disabled={busy} onClick={() => { void connect() }}>{t('connect')}</Button>}
      <Button variant="outline" size="sm" aria-label={t('refresh')} title={t('refresh')} disabled={busy}
        icon={<IconRefreshOutlineRegular />} onClick={() => { void refresh() }} />
      {status.connected && <Button variant="outline" size="sm" disabled={busy} onClick={() => { void disconnect() }}>{t('disconnect')}</Button>}
    </div>
    <a href="https://www.workbuddy.ai/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'inherit' }}>{t('website')}</a>
    {status.details && <Details details={status.details} t={t} />}
  </section>
}

/** Mount dictionaries and the same settings.section extension point as DimAgent.
 * @param ctx Browser plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('workbuddy', { en, zh }), 'workbuddy: dictionaries')
  const t = ctx.locale.bind('workbuddy')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'workbuddy',
    order: 12, label: () => t('nav'), inject: () => ({ t }) }, Section))
}
