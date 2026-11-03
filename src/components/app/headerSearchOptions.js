// The header search's options: the open project's rows, once it has some,
// and all of OCL, when a TermBrowser is configured.
export const headerSearchOptions = ({canSearchRows, canSearchOCL}) => [
  ...(canSearchRows ? ['rows'] : []),
  ...(canSearchOCL ? ['ocl'] : []),
]

// TBv3's concept search for the query, as TBv3's own search bar opens it.
export const oclSearchURL = (termBrowserURL, query) => {
  const q = (query || '').trim()
  return `${termBrowserURL}/search/?${q ? `q=${encodeURIComponent(q)}&` : ''}type=concepts`
}
