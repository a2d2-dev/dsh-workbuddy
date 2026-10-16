/** Protect shared model discovery across account changes and cancelled callers. */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { WorkBuddyAdapter } from '../src/adapter.js'
import { Backend, type Config } from '../src/backend.js'

/** Build a controlled catalog request. @returns Adapter, pending response, and request spy. */
function fixture() {
  let complete!: (value: unknown) => void
  const pending = new Promise<unknown>(resolve => { complete = resolve })
  const backend = new Backend({ gatewayBaseURL: 'http://gateway.test', gatewayKeyFile: '/secret',
    catalogTtlMs: 60000 } as Config)
  const request = vi.spyOn(backend, 'request').mockReturnValueOnce(pending).mockResolvedValue({ data: [] })
  return { adapter: new WorkBuddyAdapter(backend, {} as Context), complete, request }
}

describe('shared catalog discovery', () => {
  it('loads the current account when an old request completes after invalidation', async () => {
    const { adapter, complete, request } = fixture()
    const first = adapter.refresh()
    adapter.invalidate()
    const second = adapter.refresh()
    complete({ data: [] })
    await Promise.all([first, second])
    expect(request).toHaveBeenCalledTimes(2)
    await adapter.refresh()
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('cancels only one waiter and lets the shared catalog finish', async () => {
    const { adapter, complete, request } = fixture()
    const controller = new AbortController()
    const first = adapter.refresh(controller.signal)
    const second = adapter.refresh()
    controller.abort(new Error('Caller cancelled'))
    await expect(first).rejects.toThrow('Caller cancelled')
    complete({ data: [] })
    await second
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('refreshes for the new account even when the old waiter was cancelled', async () => {
    const { adapter, complete, request } = fixture()
    const controller = new AbortController()
    const first = adapter.refresh(controller.signal)
    controller.abort(new Error('Old account cancelled'))
    await expect(first).rejects.toThrow('Old account cancelled')
    adapter.invalidate()
    const second = adapter.refresh()
    complete({ data: [] })
    await second
    expect(request).toHaveBeenCalledTimes(2)
    expect(await adapter.listModels('workbuddy')).toEqual([])
  })
})
