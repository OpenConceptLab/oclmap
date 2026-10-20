// Stray whitespace in the lookup URL or token breaks every lookup request:
// a padded URL becomes `.../%20concepts/` and a token with a space is
// rejected by the API (OpenConceptLab/ocl_issues#2925).
// Only leading/trailing whitespace is removed; a space inside the token is
// left for the user to fix.
const trim = value => typeof value === 'string' ? value.trim() : value

export const normalizeLookupConfig = config => config ? {...config, url: trim(config.url), token: trim(config.token)} : config

// A token never contains whitespace; one that does was most likely pasted
// with a `Token `/`Bearer ` prefix.
export const lookupTokenHasSpaces = token => /\s/.test(trim(token) || '')
