/**
 * Which of a concept's names a candidate shows (OpenConceptLab/ocl_issues#2909).
 *
 * A candidate leads with its display name in the project's input language,
 * falling back to the display name OCL computes from the repository's default
 * locale. The name the match was made on comes second, with its locale, and
 * only when it differs from the name the candidate leads with.
 *
 * Pure — no React, no lodash — so the rules are unit-testable.
 */

import { primarySubtag } from './normalizers.js'

const FULLY_SPECIFIED = /^fully[\s_-]?specified$/i

const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

/**
 * A search highlight as HTML: each <em> becomes `open` and each </em> a </b>.
 * A highlight can come from a saved project, so the rest is escaped: only
 * <em> is markup.
 */
export const highlightHtml = (fragment, open = '<b>') =>
  escapeHtml(fragment).replaceAll('&lt;em&gt;', open).replaceAll('&lt;/em&gt;', '</b>')

const sameName = (a, b) => {
  const normalize = text => (text || '').replace(/\s+/g, ' ').trim().toLowerCase()
  return normalize(a) === normalize(b)
}

// The highlighted synonym with the best match: an exact match first, then the
// longest highlighted run, then one that starts with it.
const getBestSynonym = (synonyms = []) => {
  return synonyms
    .map(text => {
      const matches = [...text.matchAll(/<em>(.*?)<\/em>/g)];
      const longestMatch = matches.reduce(
        (a, b) => (b[1].length > a.length ? b[1] : a),
        ""
      );

      const emTag = `<em>${longestMatch}</em>`;
      return {
        text,
        length: longestMatch.length,
        isExact: text.trim() === emTag,
        startsWith: text.startsWith(emTag)
      };
    })
    .sort((a, b) => {
      if (b.isExact !== a.isExact) return b.isExact ? 1 : -1;   // ✅ exact ALWAYS first
      if (b.length !== a.length) return b.length - a.length;   // longer match
      if (b.startsWith !== a.startsWith) return b.startsWith ? 1 : -1;
      return 0;
    })[0]?.text;
};

/**
 * The name a concept leads with in `inputLocale` (matched on its primary
 * subtag, so `pt` takes a `pt-BR` name): the display name when it is already
 * in that language, else that language's preferred name, then its fully
 * specified name, then its first. With no name in that language, or no input
 * language, it is the concept's `display_name`, which OCL computes from the
 * repository's default locale.
 */
export const localizedDisplayName = (concept, inputLocale) => {
  const displayName = concept?.display_name
  const language = primarySubtag(inputLocale)
  const names = language && Array.isArray(concept?.names) ? concept.names : []
  const inLanguage = names.filter(name => name?.name && primarySubtag(name.locale) === language)
  if(!inLanguage.length || inLanguage.some(name => name.name === displayName))
    return displayName
  return (
    inLanguage.find(name => name.locale_preferred) ||
    inLanguage.find(name => FULLY_SPECIFIED.test(name.name_type || '')) ||
    inLanguage[0]
  ).name
}

/**
 * The name the match was made on, to show after `displayName` (the name the
 * candidate leads with): `{html, text, locale}`, with the highlighted words in bold,
 * or null when nothing matched or the match is `displayName` itself. A
 * display-name (`name`) highlight means the concept's `display_name` matched;
 * otherwise it is the best `synonyms` highlight. `filterLocales` (the
 * project's name-locale filter, a comma-separated string) hides a
 * matched name in any other language.
 */
export const getMatchedName = ({highlights, concept, displayName, filterLocales}) => {
  const fragment = highlights?.name?.[0] || getBestSynonym(highlights?.synonyms)
  if(!fragment) return null
  const text = fragment.replace(/<\/?em>/g, '')
  const names = Array.isArray(concept?.names) ? concept.names : []
  const entry = names.find(name => name?.name === text) || names.find(name => name?.name?.startsWith(text))
  if(sameName(text, displayName) || (entry && sameName(entry.name, displayName)))
    return null
  const allowed = (filterLocales || '').split(',').map(locale => primarySubtag(locale.trim())).filter(Boolean)
  if(allowed.length && !allowed.includes(primarySubtag(entry?.locale)))
    return null
  return {
    html: highlightHtml(fragment, "<b className='searchable'>"),
    text,
    locale: entry?.locale
  }
}
