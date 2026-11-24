// A saved project's log, as the Mapper keeps it (OpenConceptLab/ocl_issues#3068).
//
// The API replaces a project's saved log with the one the Mapper sends. So the
// Mapper sends nothing until it has loaded the saved log: entries made before
// then stay on the page, and go with the saved log once it loads.

// The saved log under the page's own entries, which are newer. A row's
// entries and the project's are each newest first. The API has also kept a
// project's row logs as a list, by row index.
export const mergeSavedLogs = (saved, local) => {
  const savedRows = {...(saved?.row_logs || {})}
  const rowLogs = {...savedRows}
  for(const [index, entries] of Object.entries(local?.row_logs || {}))
    rowLogs[index] = [...(entries || []), ...(savedRows[index] || [])]
  return {
    row_logs: rowLogs,
    project_logs: [...(local?.project_logs || []), ...(saved?.project_logs || [])],
  }
}

// The latest page on each project. A page left behind before its saved log
// loads sends nothing once the project is open again in this tab: its log
// would replace the one the newer page keeps. (A page that had loaded still
// sends, as a save on leave does; OpenConceptLab/ocl_online#751.) A page takes its route when it opens, and the project's URL
// from the API when its details arrive, unless a page opened later has it:
// the route catches a reopen at once, the URL any other route to the project.
const latestByRoute = new Map()
const latestByUrl = new Map()
let pagesOpened = 0

// After a failed read with an entry waiting, read again after a growing wait:
// 10 s, 30 s, 90 s, then every 2 minutes, 10 times in all.
const retryDelayMs = retry => Math.min(10000 * 3 ** retry, 120000)
const MAX_RETRIES = 10

// What a log read (services/capacity.js requestWithCapacityRetry) comes to:
// the saved log; null for a failure that may clear, so worth reading again
// after a wait; or false for a refusal that won't (a 4xx), read again only
// when the page next wants to send.
export const savedLogsFromResult = result => {
  if(result?.ok)
    return result.response?.data?.logs || {}
  const status = result?.error?.response?.status
  return result?.reason === 'error' && status >= 400 && status < 500 ? false : null
}

// opened(route) runs when the page opens, with its route (null for a new
// project).
//
// read(url, isCancelled) resolves the saved log, null when the read failed,
// or false when it was refused (see savedLogsFromResult). One read runs at a
// time. A failed or refused read is read again when the page next wants to
// send, and a failed one, while an entry waits, after the waits above.
//
// warn(message) runs once, the first time an entry waits on a read that was
// refused or ran out of waits, so a log that can't be sent shows up.
//
// onLoaded(saved, {url, send}) runs once, when the saved log loads. `send` is
// true when the page held back an entry while it waited, so the merged log
// should go now. A page that left still sends what it held back, unless the
// project has been opened again since.
export const createProjectLogsLoader = ({loaded = false, read, onLoaded, delayMs = retryDelayMs, maxRetries = MAX_RETRIES, warn = message => console.warn(message)}) => {
  const page = {order: 0, route: null}
  let projectUrl = null
  let isLoaded = loaded
  let busy = false
  let heldBack = false
  let retries = 0
  let warned = false

  const isSuperseded = () => (page.route !== null && latestByRoute.get(page.route) !== page) ||
    (projectUrl !== null && latestByUrl.get(projectUrl) !== page)

  const finish = saved => {
    busy = false
    if(isSuperseded())
      return
    if(saved) {
      isLoaded = true
      const send = heldBack
      heldBack = false
      onLoaded(saved, {url: projectUrl, send})
    } else if(heldBack && saved === null && retries < maxRetries) {
      busy = true
      setTimeout(() => {
        busy = false
        load(projectUrl)
      }, delayMs(retries++))
    } else if(heldBack && !warned) {
      warned = true
      warn(`Mapper: the project's saved log at ${projectUrl} didn't load, so this page's log entries aren't sent yet`)
    }
  }

  const load = url => {
    if(!url || isLoaded || busy)
      return
    if(projectUrl === null) {
      projectUrl = url
      // A page opened earlier, whose project came back late, doesn't take it back.
      if(!(latestByUrl.get(url)?.order > page.order))
        latestByUrl.set(url, page)
    }
    if(isSuperseded())
      return
    busy = true
    let request
    try {
      request = Promise.resolve(read(url, isSuperseded))
    } catch {
      request = Promise.resolve(null)
    }
    request.catch(() => null).then(finish)
  }

  // True when the page may send the project's log now. Otherwise it reads the
  // saved log, and sends once that has loaded.
  const canSend = url => {
    if(isLoaded)
      return true
    heldBack = true
    // A retry already waiting keeps its place in the waits.
    if(!busy)
      retries = 0
    load(url)
    return false
  }

  const opened = (route = null) => {
    page.order = ++pagesOpened
    page.route = route
    if(route !== null)
      latestByRoute.set(route, page)
  }

  return {opened, load, canSend, isLoaded: () => isLoaded}
}
