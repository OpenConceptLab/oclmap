export const AUTOSAVE_DELAY_MS = 5000

/**
 * Debounces autosave triggers into a single save, coalescing the reasons
 * queued during the window (OpenConceptLab/ocl_issues#2188).
 *
 * Project id and in-flight-save state are read through getters rather than
 * captured at creation time. A scheduler is created once per MapProject
 * instance and reused across renders, so a timer scheduled by one render
 * must still observe values committed by later renders — reading a snapshot
 * here is what previously let a pending autosave wedge behind a save that
 * had already completed.
 *
 * setTimeoutFn/clearTimeoutFn are injectable so tests can drive a virtual
 * clock instead of waiting out the real debounce window.
 */
export const createAutosaveScheduler = ({
  getProjectId,
  isSaving,
  onFire,
  delay = AUTOSAVE_DELAY_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) => {
  let timer = null
  let reasons = []

  // Preempts a pending autosave — used by a manual save and on unmount.
  const cancel = () => {
    if(timer) {
      clearTimeoutFn(timer)
      timer = null
    }
    reasons = []
  }

  const schedule = reason => {
    if(!getProjectId())
      return

    reasons = [...new Set([...reasons, reason])]
    if(timer)
      clearTimeoutFn(timer)

    timer = setTimeoutFn(() => {
      timer = null
      if(!getProjectId()) {
        reasons = []
        return
      }
      if(isSaving()) {
        schedule(reason)
        return
      }
      const firedReasons = reasons
      reasons = []
      onFire(firedReasons)
    }, delay)
  }

  return {
    schedule,
    cancel,
    hasPending: () => Boolean(timer),
    pendingReasons: () => reasons
  }
}
