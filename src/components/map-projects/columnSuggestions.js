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

const CODE_TOKENS = ['code', 'codes', 'id', 'ids', 'uuid', 'identifier']

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
export const suggestColumnLabels = (headers, validColumns, reserved = []) => {
  const findValid = label => validColumns.find(column => column.label.toLowerCase() === label.toLowerCase())
  const isExact = header => Boolean(findValid(String(header || '')))

  // Exact matches and labels the user already chose hold their field first, so
  // no suggestion can duplicate it, wherever the column sits in the file.
  const taken = new Set(reserved)
  headers.forEach(header => {
    const exactMatch = findValid(String(header || ''))
    if(exactMatch)
      taken.add(exactMatch.label)
  })

  const matches = headers.map((header, idx) => {
    const alreadyRecognised = String(header || '').toLowerCase().includes('class')
    if(isExact(header) || alreadyRecognised || isCodeLikeHeader(header))
      return null

    const tokens = tokenize(header)
    const rule = SUGGESTION_RULES.find(rule => tokens.some(token => rule.tokens.includes(token)))
    return rule ? {idx, rule, rank: rule.tokens.findIndex(token => tokens.includes(token))} : null
  })

  // A field goes to the column with its strongest word ("name" before "test"),
  // then the first such column, so "Test Name" wins over an earlier "Test Date".
  const suggestions = headers.map(() => null)
  matches.filter(Boolean).sort((a, b) => a.rank - b.rank || a.idx - b.idx).forEach(({idx, rule}) => {
    const target = findValid(rule.label)
    if(target && !taken.has(target.label)) {
      taken.add(target.label)
      suggestions[idx] = target.label
    }
  })
  return suggestions
}

/**
 * Returns a new columns array with one column's mapping changed. A change
 * without a key is a mapping choice: it ends any suggestion, and clearing it
 * marks the column as unmapped on purpose.
 */
export const updateColumnState = (columns, position, newValue, key) => {
  const cols = [...columns]
  cols[position] = {...cols[position], [key || 'label']: newValue || ''}
  if(!key) {
    cols[position].suggested = false
    cols[position].unmapped = !newValue
    cols[position].auto = false
  }
  return cols
}

/**
 * Re-runs suggestions for columns still driven by suggestions (`auto`) after
 * the target's mapped fields change. Columns the user has edited are kept.
 */
export const resuggestColumns = (columns, validColumns) => {
  if(!columns.some(col => col.auto))
    return columns
  const reserved = columns.filter(col => !col.auto && col.label).map(col => col.label)
  const suggestedLabels = suggestColumnLabels(columns.map(col => col.auto ? col.original : null), validColumns, reserved)
  return columns.map((col, idx) => col.auto ? {...col, label: suggestedLabels[idx] || col.original, suggested: Boolean(suggestedLabels[idx])} : col)
}

/**
 * Applies the column mapping of a project being copied (Create similar) to the
 * columns of a newly uploaded sheet. Columns are matched on their sheet header
 * (`original`); a match takes the template's mapping as the user's own choice,
 * and the other columns stay suggestions.
 */
export const applyTemplateColumns = (columns, templateColumns) => {
  if(!templateColumns?.length)
    return columns
  const byOriginal = {}
  templateColumns.forEach(col => {
    const header = col?.original ?? col?.dataKey
    if(header !== undefined && !(header in byOriginal))
      byOriginal[header] = col
  })
  return columns.map(col => {
    const template = byOriginal[col.original]
    if(!template)
      return col
    return {
      ...col,
      label: template.label ?? col.label,
      unmapped: Boolean(template.unmapped),
      auto: false,
      suggested: false
    }
  })
}
