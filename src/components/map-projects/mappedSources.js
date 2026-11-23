// A repository version's mapped-sources list, read once per page and shared by
// everyone who asks for it while the project is open: the bridge probe and the
// target version often ask for the same version (OpenConceptLab/ocl_issues#3064).

export const MAPPED_SOURCES_PAGE_SIZE = 25

const versionURL = url => `${String(url || '').replace(/\/+$/, '')}/`

// fetchPage(url, page) answers as APIService does: a response with the page in
// `data` and the total in the `num_found` header, or the error itself. A page
// that fails isn't kept, so the next ask reads it again.
//
// The reader returned, read(url, onList), gives onList the list so far after
// each page, and returns a function that stops it.
export const createMappedSourcesReader = fetchPage => {
  const pages = new Map()

  const readPage = (url, page) => {
    const key = `${url}#${page}`
    if(!pages.has(key)) {
      const forget = () => pages.delete(key)
      pages.set(key, Promise.resolve(fetchPage(url, page)).then(
        response => {
          if(!Array.isArray(response?.data))
            forget()
          return response
        },
        () => {
          forget()
          return null
        }
      ))
    }
    return pages.get(key)
  }

  return (url, onList) => {
    const versionUrl = versionURL(url)
    let stopped = false
    const read = (page, soFar) => readPage(versionUrl, page).then(response => {
      if(stopped)
        return
      const data = Array.isArray(response?.data) ? response.data : []
      const list = [...soFar, ...data]
      onList(list)
      if(data.length && list.length < parseInt(response?.headers?.num_found || 0))
        read(page + 1, list)
    })
    read(1, [])
    return () => { stopped = true }
  }
}

// The Bridge Match component mounts once it has the bridge repository's mapped
// sources. A bridge algorithm with no version reads the version its repository
// resolves to in the namespace, and a selected one keeps that version.
// Returns a function that stops the probe.
export const probeBridgeMappedSources = ({algo, selected, namespace, resolveVersion, readMappedSources, pinVersion, onSources}) => {
  const bridgeUrl = algo?.target_repo_url
  if(!algo?.id || !bridgeUrl)
    return () => {}

  let stopped = false
  let stopReading = () => {}
  const read = version => {
    stopReading = readMappedSources(bridgeUrl + version + '/', sources => onSources(bridgeUrl, sources))
  }

  if(algo.target_repo_version)
    read(algo.target_repo_version)
  else
    resolveVersion(bridgeUrl, namespace).then(version => {
      if(stopped || !version)
        return
      if(selected)
        pinVersion(algo.id, version)
      read(version)
    }).catch(() => {})

  return () => {
    stopped = true
    stopReading()
  }
}
