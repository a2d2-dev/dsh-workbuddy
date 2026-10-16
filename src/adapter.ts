/** DSH model provider delegating inference to the maintained pi-ai adapter. */
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, resolveRetryPolicy, type GenerateOptions, type StreamChunk, type PreparedAdapterCall } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter, type ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { InMemoryCredentialStore } from '@earendil-works/pi-ai'
import { Backend } from './backend.js'
import { createWorkBuddyProvider, parseModels, PROVIDER, DISPLAY_NAME } from './models.js'

/** Route whose catalog changes when the connected account changes. */
export class WorkBuddyAdapter extends LlmAdapter {
  private profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile> = new Map()
  private updatedAt = 0
  private generation = 0
  private loading?: Promise<void>
  private readonly delegate: PiAiAdapter

  constructor(readonly backend: Backend, ctx: Context) {
    super()
    this.delegate = new PiAiAdapter({ profiles: () => this.profiles, resolveApiKey: () => backend.key(),
      auth: { credentials: new InMemoryCredentialStore(), authContext: { env: async () => undefined, fileExists: async () => false } },
      resolveAttachments: () => ctx.get('attachments'),
    })
  }

  /** Clear cached models after login/logout. */
  invalidate(): void { this.generation++; this.updatedAt = 0; this.profiles = new Map() }

  /** Fetch current models once per TTL, sharing concurrent discoveries.
   * @param signal Optional cancellation. @returns Completion of catalog refresh.
   */
  async refresh(signal?: AbortSignal): Promise<void> {
    for (;;) {
      signal?.throwIfAborted()
      if (this.updatedAt && Date.now() - this.updatedAt < this.backend.config.catalogTtlMs) return
      const generation = this.generation
      if (!this.loading) {
        const pending = this.load(undefined, generation).finally(() => {
          if (this.loading === pending) this.loading = undefined
        })
        this.loading = pending
      }
      await waitForCatalog(this.loading, signal)
    }
  }

  private async load(signal: AbortSignal | undefined, generation: number): Promise<void> {
    const models = parseModels(await this.backend.request('/workbuddy/models', undefined, signal), this.backend.baseURL)
    if (generation !== this.generation) return
    const profile: ResolvedPiAiProviderProfile = {
      provider: PROVIDER, displayName: DISPLAY_NAME, piProvider: createWorkBuddyProvider(models),
      configuredMaxTokens: new Map(), modelErrors: new Map(),
      streamIdleTimeoutMs: this.backend.config.streamIdleTimeoutMs,
      requestImagePixelBudget: 4194304, requestImageMaxBytes: 1048576, maxRequestImageBytes: 20971520,
      retryPolicy: resolveRetryPolicy({ mode: 'normal', maxRetries: 2 }, 'WorkBuddy retry policy'),
    }
    this.profiles = new Map([[PROVIDER, profile]])
    this.updatedAt = Date.now()
  }

  override providerInfo(provider: string) { return { id: provider, name: DISPLAY_NAME } }
  override async listModels(provider: string) { await this.refresh(); return this.delegate.listModels(provider) }
  override async resolveModel(provider: string, model: string, signal?: AbortSignal) {
    await this.refresh(signal); return this.delegate.resolveModel(provider, model, signal)
  }
  override async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    await this.refresh(signal); return this.delegate.prepareCall(provider, model, signal)
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    await this.refresh(options.signal); yield* this.delegate.stream(options)
  }
}

/** Cancel one waiter without cancelling discovery shared by other callers.
 * @param loading Shared catalog operation. @param signal Caller cancellation.
 * @returns Completion of discovery for this caller.
 */
function waitForCatalog(loading: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return loading
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    loading.then(() => { signal.removeEventListener('abort', abort); resolve() }, error => {
      signal.removeEventListener('abort', abort); reject(error)
    })
  })
}
