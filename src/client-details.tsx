/** Account balances and searchable live model metadata within DSH settings. */
import React, { useState } from 'react'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AccountDetails, ModelDetail, Quota } from './details-wire.js'
import { localizedModelText } from './details-wire.js'
import type { Translator } from './client-account.js'

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }
const cell: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid var(--dsw-alias-border-l3)', verticalAlign: 'top' }
const muted: React.CSSProperties = { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 }
const heading: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600 }
const freeStyle: React.CSSProperties = { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-interactive-bg-hover)', padding: '2px 5px', borderRadius: 4 }

/** Keep account metrics compact without truncating narrow settings panes.
 * @param props Account identity, counts and locale. @returns Responsive definition list.
 */
export function AccountSummary({ account, models, details, t }: {
  account: string; models: number; details: AccountDetails | null; t: Translator
}) {
  const metrics = [[t('account'), account], [t('models'), String(models)],
    ...(details ? [[t('freeModels'), String(details.models.filter(model => model.free).length)]] : [])]
  return <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 12, margin: 0 }}>
    {metrics.map(([label, value]) => <div key={label} style={{ minWidth: 0 }}>
      <dt style={muted}>{label}</dt><dd style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>{value}</dd>
    </div>)}
  </dl>
}

/** Format a displayed credit balance. @param value Verified finite quantity. @returns Local numeric text. */
function credits(value: number): string { return value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }
/** Keep timestamps with unspecified timezone literal. @param value Upstream timestamp. @returns Readable date. */
function date(value: string): string {
  return /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString() : value
}
/** Format context capacity. @param value Verified tokens. @returns Compact token label. */
function tokens(value: number): string { return value >= 1000000 ? `${value / 1000000}M` : `${value / 1000}K` }

/** Render real balances and per-package expiry. @param props Quota and locale. @returns Account quota section. */
function QuotaView({ quota, t }: { quota: Quota; t: Translator }) {
  const used = Math.max(0, quota.total - quota.remaining)
  return <section style={{ display: 'grid', gap: 12, minWidth: 0 }}>
    <h3 style={heading}>{t('quota')}</h3>
    {!quota.available ? <p style={muted}>{t('unavailable')}</p> : <>
      <div style={{ fontSize: 24, overflowWrap: 'anywhere' }}>{credits(quota.remaining)} <span style={muted}>/ {credits(quota.total)}</span></div>
      <progress aria-label={t('used')} max={quota.total || 1} value={used} style={{ width: '100%', height: 6, accentColor: 'var(--dsw-alias-label-secondary)' }} />
      <div style={muted}>{t('used')} {credits(used)} · {t('remaining')} {credits(quota.remaining)}</div>
      <div role="region" aria-label={t('packages')} tabIndex={0} style={{ overflowX: 'auto', minWidth: 0 }}>
        <table style={{ ...table, minWidth: 400 }}><thead><tr>
          {[t('packages'), t('remaining'), t('total'), t('expires')].map(label => <th style={cell} key={label} scope="col">{label}</th>)}
        </tr></thead><tbody>{quota.packages.map((item, index) => <tr key={`${item.name}-${index}`}>
          <td style={cell}>{item.name}</td><td style={cell}>{credits(item.remaining)}</td>
          <td style={cell}>{credits(item.total)}</td><td style={{ ...cell, whiteSpace: 'nowrap' }}>{item.expires || t('unavailable')}</td>
        </tr>)}</tbody></table>
      </div>
    </>}
  </section>
}

/** Render a model's distinct ID, price, promotion and capabilities.
 * @param props Safe model and locale. @returns One table row.
 */
function ModelRow({ model, t }: { model: ModelDetail; t: Translator }) {
  const { description, promotionText } = localizedModelText(model, t('language'))
  return <tr>
    <td style={{ ...cell, maxWidth: 250 }}><strong>{model.name}</strong>
      <div style={{ ...muted, overflowWrap: 'anywhere', marginTop: 4 }}>{model.id}</div>
      {description && <div style={{ ...muted, marginTop: 4 }}>{description}</div>}
    </td>
    <td style={cell}>{model.free ? <span style={freeStyle}>{t('free')}</span> : model.billingLabel || t('unavailable')}
      {model.free && model.billingLabel && <div style={{ ...muted, marginTop: 4 }}>{model.billingLabel}</div>}
      {model.promotionEndsAt && <div style={{ ...muted, marginTop: 6 }} title={promotionText}>{t('promotionUntil')}<br />{date(model.promotionEndsAt)}</div>}
    </td>
    <td style={cell}>{tokens(model.contextWindow)}</td><td style={cell}>{tokens(model.maxTokens)}</td>
    <td style={cell}>{[t('text'), ...(model.vision ? [t('vision')] : []), ...(model.reasoning ? [t('reasoning')] : [])].join(' / ')}</td>
  </tr>
}

/** Search and filter the actual account catalog. @param props Live models and locale. @returns Model section. */
function ModelCatalog({ models, t }: { models: ModelDetail[]; t: Translator }) {
  const [query, setQuery] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)
  const needle = query.trim().toLowerCase()
  const visible = models.filter(model => (!onlyFree || model.free) && `${model.name} ${model.id}`.toLowerCase().includes(needle))
  return <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, minWidth: 0 }}>
    <h3 style={heading}>{t('modelList')} <span style={muted}>{visible.length} / {models.length}</span></h3>
    <Input aria-label={t('search')} placeholder={t('search')} value={query} style={{ width: '100%' }} onChange={event => setQuery(event.target.value)} />
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <input type="checkbox" checked={onlyFree} onChange={event => setOnlyFree(event.target.checked)} />{t('onlyFree')}
    </label>
    <div role="region" aria-label={t('modelList')} tabIndex={0} style={{ overflow: 'auto', maxHeight: 440, minWidth: 0 }}>
      <table style={{ ...table, minWidth: 620 }}><thead><tr>
        {[t('model'), t('billing'), t('context'), t('output'), t('capabilities')].map(label => <th scope="col" key={label} style={{ ...cell, whiteSpace: 'nowrap' }}>{label}</th>)}
      </tr></thead><tbody>{visible.map(model => <ModelRow key={model.id} model={model} t={t} />)}</tbody></table>
      {!visible.length && <p style={muted}>{t('noModels')}</p>}
    </div>
  </section>
}

/** Display account details in unframed sections. @param props Safe account data and locale. @returns Details view. */
export function Details({ details, t }: { details: AccountDetails; t: Translator }) {
  return <div style={{ display: 'grid', gap: 28, minWidth: 0 }}>
    <QuotaView quota={details.quota} t={t} />
    <ModelCatalog models={details.models} t={t} />
    <div style={muted}>{t('updated')} {date(details.updatedAt)}</div>
  </div>
}
