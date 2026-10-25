import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTabSync } from './tabSync'

const liveChannels = []
const track = (sync) => {
  liveChannels.push(sync)
  return sync
}

afterEach(() => {
  while (liveChannels.length > 0) liveChannels.pop().close()
  vi.unstubAllGlobals()
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 25))

describe('createTabSync', () => {
  it('forwards remote messages and ignores the tab that sent them', async () => {
    const onFirst = vi.fn()
    const onSecond = vi.fn()
    const first = track(createTabSync({ channelName: 'test-tab-sync', onRemoteChange: onFirst }))
    track(createTabSync({ channelName: 'test-tab-sync', onRemoteChange: onSecond }))

    first.notify()
    await settle()

    expect(onFirst).not.toHaveBeenCalled()
    expect(onSecond).toHaveBeenCalledTimes(1)
    expect(onSecond).toHaveBeenCalledWith('channel')
  })

  it('is a silent no-op when BroadcastChannel is absent', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const onRemoteChange = vi.fn()
    const sync = track(createTabSync({ onRemoteChange }))

    expect(() => sync.notify()).not.toThrow()
    expect(onRemoteChange).not.toHaveBeenCalled()
    sync.close()
  })

  it('re-syncs when the document becomes visible again', () => {
    let listener
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: vi.fn((event, handler) => {
        if (event === 'visibilitychange') listener = handler
      }),
      removeEventListener: vi.fn(),
    })
    const onRemoteChange = vi.fn()
    const sync = track(createTabSync({ onRemoteChange }))

    listener()
    expect(onRemoteChange).not.toHaveBeenCalled()

    document.visibilityState = 'visible'
    listener()
    expect(onRemoteChange).toHaveBeenCalledTimes(1)
    expect(onRemoteChange).toHaveBeenCalledWith('visibility')
    sync.close()
  })
})
