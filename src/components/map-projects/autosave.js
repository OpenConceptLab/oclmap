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
 * The save always starts asynchronously: an error while building the payload
 * must not surface inside React's unmount and take down the page the user is
 * going to.
 *
 * Returns whether a save was queued.
 */
export const saveOnLeave = ({ scheduler, inFlightSave, save }) => {
  const reasons = scheduler.takePending()
  if(!reasons)
    return false
  const run = () => save(reasons)
  Promise.resolve(inFlightSave)
    .then(run, run)
    .catch(error => console.error('Mapper: saving on leave failed', error))
  return true
}

// Saves still in flight, by project id. A save on leave outlives the page that
// started it: reopening that project must wait for it, or the stale copy loads
// and its next autosave overwrites the save, and closing the tab must warn.
const savesInFlight = new Map()

export const trackSave = (projectId, request) => {
  const key = String(projectId)
  savesInFlight.set(key, request)
  const clear = () => {
    if(savesInFlight.get(key) === request)
      savesInFlight.delete(key)
  }
  request.then(clear, clear)
  return request
}

// Resolves, never rejects, once the project's save in flight has settled.
export const whenSaved = projectId => {
  const request = savesInFlight.get(String(projectId))
  return request ? request.then(() => undefined, () => undefined) : Promise.resolve()
}

export const hasSaveInFlight = () => savesInFlight.size > 0

// One window-level prompt, never removed, so it still covers a save whose
// page is gone.
let unloadGuardInstalled = false
export const installUnloadGuard = () => {
  if(unloadGuardInstalled || typeof window === 'undefined')
    return
  unloadGuardInstalled = true
  window.addEventListener('beforeunload', event => {
    if(!hasSaveInFlight())
      return
    event.preventDefault()
    event.returnValue = ''
  })
}

/**
 * One send at a time; triggers that arrive during it coalesce into one more
 * send, which reads its payload then (ocl_issues#2849). For the project logs
 * POST, which sends the whole log: once it waits out a 429, an older POST
 * could otherwise land after a newer one and overwrite it. trigger() resolves,
 * never rejects, once nothing is left to send.
 */
export const createLatestSender = send => {
  let chain = null
  let pending = false
  const loop = async () => {
    do {
      pending = false
      try {
        await send()
      } catch (_) {
        // Best effort: the next change sends the whole log again.
      }
    } while(pending)
    chain = null
  }
  return {
    trigger: () => {
      if(chain)
        pending = true
      else
        chain = loop()
      return chain
    },
  }
}
