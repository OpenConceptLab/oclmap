// A saved project's log, as the Mapper keeps it (OpenConceptLab/ocl_issues#3068).
//
// The API replaces a project's saved log with the one the Mapper sends. So the
// Mapper sends nothing until it has loaded the saved log: entries made before
// then stay on the page, and go with the saved log once it loads.

// The saved log under the page's own entries, which are newer. A row's
// entries and the project's are each newest first.
export const mergeSavedLogs = (saved, local) => {
  const savedRows = saved?.row_logs && !Array.isArray(saved.row_logs) ? saved.row_logs : {}
  const localRows = local?.row_logs || {}
  const rowLogs = {...savedRows}
  for(const [index, entries] of Object.entries(localRows))
    rowLogs[index] = [...(entries || []), ...(savedRows[index] || [])]
  return {
    row_logs: rowLogs,
    project_logs: [...(local?.project_logs || []), ...(saved?.project_logs || [])],
  }
}

// read(url) resolves the saved log, or null when the read failed. One read
// runs at a time. After a failed read, the next entry the page wants to send
// reads it again.
//
// onLoaded(saved, {url, send}) runs once, when the saved log loads. `send` is
// true when the page held back an entry while it waited, so the merged log
// should go now.
export const createProjectLogsLoader = ({loaded = false, read, onLoaded}) => {
  let isLoaded = loaded
  let reading = false
  let heldBack = false

  const load = url => {
    if(isLoaded || reading || !url)
      return
    reading = true
    let request
    try {
      request = Promise.resolve(read(url))
    } catch {
      request = Promise.resolve(null)
    }
    request.catch(() => null).then(saved => {
      reading = false
      if(!saved)
        return
      isLoaded = true
      const send = heldBack
      heldBack = false
      onLoaded(saved, {url, send})
    })
  }

  // True when the page may send the project's log now. Otherwise it reads the
  // saved log, and sends once that has loaded.
  const canSend = url => {
    if(isLoaded)
      return true
    heldBack = true
    load(url)
    return false
  }

  return {load, canSend, isLoaded: () => isLoaded}
}
