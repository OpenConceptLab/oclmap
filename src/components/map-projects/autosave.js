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

  // Preempts a pending autosave — used by a manual save.
  const cancel = () => {
    if(timer) {
      clearTimeoutFn(timer)
      timer = null
    }
    reasons = []
  }

  // Clears a pending autosave and hands back its reasons, for a caller that
  // saves right away instead (see saveOnLeave). null when nothing is pending.
  const takePending = () => {
    if(!timer)
      return null
    clearTimeoutFn(timer)
    timer = null
    const pending = reasons
    reasons = []
    return getProjectId() ? pending : null
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
    takePending,
    hasPending: () => Boolean(timer),
    pendingReasons: () => reasons
  }
}

/**
 * Leaving the project unmounts MapProject, often inside the autosave window,
 * and dropping the pending autosave there lost the last change — a whole Auto
 * Match run if the user left within 5s of it finishing
 * (OpenConceptLab/ocl_issues#2829). This saves it now instead. A save still in
 * flight goes first, so the older payload can't land after the newer one.
 *
 * Returns whether a save was started or queued.
 */
export const saveOnLeave = ({ scheduler, inFlightSave, save }) => {
  const reasons = scheduler.takePending()
  if(!reasons)
    return false
  if(inFlightSave) {
    const run = () => save(reasons)
    inFlightSave.then(run, run)
  } else
    save(reasons)
  return true
}
