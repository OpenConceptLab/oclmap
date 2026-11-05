// Leaving a project while Auto Match runs, or before a new project's first save.

// A new project exists only on this page until its first save: leaving with
// its file loaded discards it. A saved project autosaves instead.
export const isUnsavedNewProject = ({projectId, hasInput}) => !projectId && Boolean(hasInput)

// In-app navigation unmounts the page, which saves a saved project's pending
// change, so only a run or an unsaved new project needs asking first.
export const shouldAskBeforeLeaving = ({runActive, projectId, hasInput}) =>
  Boolean(runActive) || isUnsavedNewProject({projectId, hasInput})

// Closing the tab or opening another site gets no unmount save: ask while a
// change waits for autosave, a save is in flight, the last save failed, or
// Configure is open with changes.
export const shouldWarnBeforeUnload = ({pendingAutosave, saveInFlight, saveFailed, configChanged, runActive, projectId, hasInput}) =>
  Boolean(pendingAutosave || saveInFlight || saveFailed || configChanged) || shouldAskBeforeLeaving({runActive, projectId, hasInput})

// Holds in-app navigation, unless isAllowed, and hands it to onBlocked as
// {location, action}. Returns the unblock function.
export const blockLeaving = (history, {isAllowed = () => false, onBlocked}) =>
  history.block((location, action) => {
    if(isAllowed(location, action))
      return undefined
    onBlocked({location, action})
    return false
  })

// A held Back/Forward (POP) can't be replayed by distance, so it is pushed,
// without its mapProjectFrom: the push is the user's, not a save's.
export const continueLeaving = (history, {location, action}) => {
  const { mapProjectFrom, ...state } = location.state || {} // eslint-disable-line no-unused-vars
  const next = {...location, state: Object.keys(state).length ? state : undefined}
  return action === 'REPLACE' ? history.replace(next) : history.push(next)
}

// Each closer closes its run's record once, whether the run ends or the page
// closes it first on leave. A close still in flight as the tab closes is sent
// again with keepalive, as it was, since the tab's closing cancels it.
export const createRunClosers = () => {
  const unsettled = new Set()
  const add = close => {
    let result = null
    let closedAs
    const closeOnce = (aborted, options = {}) => {
      if(result && (!unsettled.has(closeOnce) || !options.keepalive))
        return result
      if(!result)
        closedAs = aborted
      result = Promise.resolve(close(closedAs, options)).finally(() => unsettled.delete(closeOnce))
      return result
    }
    closeOnce.isClosing = () => Boolean(result)
    unsettled.add(closeOnce)
    return closeOnce
  }
  return {
    add,
    closeAll: (aborted, options) => Promise.all([...unsettled].map(close => close(aborted, options))),
    // A run whose record nothing has started closing yet.
    hasOpen: () => [...unsettled].some(close => !close.isClosing()),
    hasUnsettled: () => unsettled.size > 0,
  }
}

// MapProject loads its project once, on mount, so another project's URL needs
// a new page. Only a save's own navigation keeps it: a push or replace that
// passes the path it left in location.state.mapProjectFrom. Back/Forward
// replays that state, so a POP always gets a new page. Returns the key and
// path to keep for the next location.
export const getPageKey = ({key, path}, location, action) => {
  if(key && action !== 'POP' && location.state?.mapProjectFrom === path)
    return {key, path: location.pathname}
  return {key: (key || 0) + 1, path: location.pathname}
}
