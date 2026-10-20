// A concept property entry looks like {code, value<Type>, display}. Read the
// value by key name, not position: once a map project is saved, Postgres jsonb
// reorders the keys to {code, display, value<Type>}, and the first non-code key
// becomes the display label (OpenConceptLab/ocl_issues#2926).
const NON_VALUE_KEYS = ['code', 'display']

export const getPropertyValueKey = property => {
  if(!property || typeof property !== 'object')
    return undefined
  const keys = Object.keys(property)
  return keys.find(key => key === 'value' || /^value[A-Z]/.test(key)) || keys.find(key => !NON_VALUE_KEYS.includes(key))
}

export const getPropertyValue = property => {
  const key = getPropertyValueKey(property)
  return key ? property[key] : undefined
}

// The source's display label wins; `fallback` (e.g. a translated label for
// concept_class/datatype) comes before the raw code.
export const getPropertyLabel = (property, fallback) => property?.display || fallback || property?.code
