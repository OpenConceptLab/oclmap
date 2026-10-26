// Leaving a project while Auto Match runs.

// Holds in-app navigation, unless isAllowed, and hands it to onBlocked as
// {location, action}. Returns the unblock function.
export const blockLeaving = (history, {isAllowed = () => false, onBlocked}) =>
  history.block((location, action) => {
    if(isAllowed(location, action))
      return undefined
    onBlocked({location, action})
    return false
  })

// A held Back/Forward (POP) can't be replayed by distance, so it is pushed.
export const continueLeaving = (history, {location, action}) =>
  action === 'REPLACE' ? history.replace(location) : history.push(location)

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
// a new page. Its own navigation (a save's) passes the path it left in
// location.state.mapProjectFrom and keeps the page. Returns the key and path
// to keep for the next location.
export const getPageKey = ({key, path}, location) => {
  if(key && location.state?.mapProjectFrom === path)
    return {key, path: location.pathname}
  return {key: location.pathname, path: location.pathname}
}
