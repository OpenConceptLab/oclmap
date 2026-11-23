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

// The page that last opened each project, in the order pages open. A page
// left behind sends nothing once the project is open again in this tab: its
// log would replace the one the newer page keeps.
const latestPages = new Map()

// After a failed read with an entry waiting, read again after a growing wait:
// 10 s, 30 s, 90 s, then every 2 minutes, 10 times in all.
const retryDelayMs = retry => Math.min(10000 * 3 ** retry, 120000)
const MAX_RETRIES = 10

// key names the project the page opened (null for a new project), and claim()
// runs when the page opens.
//
// read(url, isCancelled) resolves the saved log, or null when the read failed.
// One read runs at a time. A failed read is read again when the page next
// wants to send, and, while an entry waits, after the waits above.
//
// onLoaded(saved, {url, send}) runs once, when the saved log loads. `send` is
// true when the page held back an entry while it waited, so the merged log
// should go now. A page that left still sends what it held back, unless the
// project has been opened again since.
export const createProjectLogsLoader = ({key = null, loaded = false, read, onLoaded, delayMs = retryDelayMs, maxRetries = MAX_RETRIES}) => {
  const page = {}
  let projectUrl = null
  let isLoaded = loaded
  let busy = false
  let heldBack = false
  let retries = 0

  const isSuperseded = () => key !== null && latestPages.get(key) !== page

  const finish = saved => {
    busy = false
    if(isSuperseded())
      return
    if(saved) {
      isLoaded = true
      const send = heldBack
      heldBack = false
      onLoaded(saved, {url: projectUrl, send})
    } else if(heldBack && retries < maxRetries) {
      busy = true
      setTimeout(() => {
        busy = false
        load(projectUrl)
      }, delayMs(retries++))
    }
  }

  const load = url => {
    if(!url || isLoaded || busy || isSuperseded())
      return
    projectUrl = url
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
    retries = 0
    load(url)
    return false
  }

  const claim = () => {
    if(key !== null)
      latestPages.set(key, page)
  }

  return {claim, load, canSend, isLoaded: () => isLoaded}
}
