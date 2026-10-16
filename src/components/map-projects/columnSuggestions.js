/**
 * Suggested mapped fields for the columns of an uploaded spreadsheet
 * (ocl_issues#2907).
 *
 * A column is only recognised when its header is exactly a mapped-field
 * label, so a new user has to learn that vocabulary before the first run.
 * These suggestions map common header words to a mapped field when the
 * header is not already an exact match. They are only a starting point: they
 * are shown as suggestions and can be changed, and nothing is saved until the
 * project is.
 *
 * Code-like headers (for example "Local Code") stay unmapped on purpose.
 * Headers containing "class" are already recognised as Property: Class by
 * MapProject's isValidColumnValue, so they get no suggestion here.
 */

const CODE_TOKENS = ['code', 'codes', 'id', 'ids', 'uuid', 'identifier', 'external']

const SUGGESTION_RULES = [
  {label: 'Name', tokens: ['name', 'term', 'test', 'description']},
  {label: 'Synonyms', tokens: ['synonym', 'synonyms']},
  {label: 'Property: SYSTEM', tokens: ['specimen', 'system', 'sample']},
]

const tokenize = header => String(header || '').toLowerCase().split(/[\s_-]+/).filter(Boolean)

export const isCodeLikeHeader = header => tokenize(header).some(token => CODE_TOKENS.includes(token))

/**
 * Returns one suggested label per header, aligned with `headers`, or null
 * where there is no suggestion. `validColumns` are the mapped fields the
 * target supports (`{label}` objects, as in MapProject's `headers`). A rule
 * only suggests a field the target has, and each field is suggested at most
 * once, for the first matching column.
 */
export const suggestColumnLabels = (headers, validColumns) => {
  const findValid = label => validColumns.find(column => column.label.toLowerCase() === label.toLowerCase())
  const suggested = new Set()

  return headers.map(header => {
    const exactMatch = findValid(String(header || ''))
    const alreadyRecognised = String(header || '').toLowerCase().includes('class')
    if(exactMatch || alreadyRecognised || isCodeLikeHeader(header))
      return null

    const tokens = tokenize(header)
    const rule = SUGGESTION_RULES.find(rule => tokens.some(token => rule.tokens.includes(token)))
    const target = rule && findValid(rule.label)
    if(!target || suggested.has(target.label))
      return null

    suggested.add(target.label)
    return target.label
  })
}
