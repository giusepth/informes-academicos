/**
 * Cross-tab convergence for the IndexedDB-backed data slices.
 *
 * A tab that finishes an IndexedDB write announces it on a BroadcastChannel;
 * every other tab of the same origin re-reads the three data keys and merges
 * them into React state, so an already-open (stale) tab never overwrites newer
 * work with its old copy.
 *
 * BroadcastChannel is optional: without it the module degrades to a no-op
 * notifier. The visibility listener still works because browsers may throttle
 * background tabs and a channel message can be missed.
 */

const MESSAGE_TYPE = 'informes:data-changed'

/** Reasons carried with a cross-tab announcement. */
export const TAB_SYNC_REASONS = {
  data: 'data',
  clearReports: 'clear-reports',
}

const newTabId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const safeCall = (callback, ...args) => {
  try {
    callback?.(...args)
  } catch {
    /* A convergence callback must never break the page. */
  }
}

export function createTabSync({ channelName = 'informes.tab-sync', onRemoteChange } = {}) {
  const tabId = newTabId()
  let channel = null

  if (typeof BroadcastChannel === 'function') {
    try {
      channel = new BroadcastChannel(channelName)
    } catch {
      channel = null
    }
  }

  const handleMessage = (event) => {
    const payload = event?.data
    if (!payload || payload.type !== MESSAGE_TYPE) return
    // Our own write: this tab already has that state in memory.
    if (payload.source === tabId) return
    safeCall(onRemoteChange, 'channel', payload)
  }

  const handleVisibility = () => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') safeCall(onRemoteChange, 'visibility')
  }

  if (channel) channel.onmessage = handleMessage
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  const notify = (reason = TAB_SYNC_REASONS.data) => {
    if (!channel) return
    try {
      channel.postMessage({ type: MESSAGE_TYPE, source: tabId, reason })
    } catch {
      /* A closed channel or a non-cloneable payload is not fatal. */
    }
  }

  const close = () => {
    if (channel) {
      channel.onmessage = null
      channel.close()
      channel = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }

  return { notify, close }
}

export default createTabSync
