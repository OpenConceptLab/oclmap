/**
 * Static audit of the Mapper's i18n keys (OpenConceptLab/ocl_issues#2880):
 * which English keys the source references, and how each locale compares
 * with English. scripts/i18n-audit/audit.mjs reads the files and prints
 * renderReport(auditKeys(...)); the app never imports this module.
 * scripts/i18n-audit/README.md describes the method and its limits.
 */
import babel from '@babel/core'

// The part of a key the code computes at run time.
const ANY = Symbol('any')

// A family whose pattern is a whole namespace (`map_project.*`) would count
// every key in it as used, so its keys have to be declared.
const NAMESPACE_WIDE = /^[^.*]+\.\*$/

export const flattenCatalog = (catalog, prefix = '') => {
  const flat = {}
  Object.entries(catalog).forEach(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name
    if(value && typeof value === 'object' && !Array.isArray(value))
      Object.assign(flat, flattenCatalog(value, key))
    else
      flat[key] = value
  })
  return flat
}

// Joins neighbouring text and neighbouring ANYs: ['a', '.', ANY, ANY] -> ['a.', ANY]
const tidy = parts => parts.reduce((out, part) => {
  const last = out[out.length - 1]
  if(part === '' || (part === ANY && last === ANY))
    return out
  if(typeof part === 'string' && typeof last === 'string')
    return [...out.slice(0, -1), last + part]
  return [...out, part]
}, [])

const product = (lefts, rights) => lefts.flatMap(left => rights.map(right => tidy([...left, ...right])))

// Every key an expression can evaluate to, as patterns of text and ANY:
// 'a.b' is ['a.b'], `a.${b}` is ['a.', ANY], cond ? 'x' : 'y' is two
// patterns, and a const is read through to its value. Anything else, such as
// a parameter or a property, is [ANY].
const patternsOf = (path, resolving = new Set()) => {
  if(path.isStringLiteral())
    return [[path.node.value]]
  if(path.isTemplateLiteral()) {
    const quasis = path.node.quasis
    return path.get('expressions').reduce(
      (patterns, expression, i) => product(product(patterns, patternsOf(expression, resolving)), [[quasis[i + 1].value.cooked]]),
      [tidy([quasis[0].value.cooked])]
    )
  }
  if(path.isBinaryExpression({ operator: '+' }))
    return product(patternsOf(path.get('left'), resolving), patternsOf(path.get('right'), resolving))
  if(path.isConditionalExpression())
    return [...patternsOf(path.get('consequent'), resolving), ...patternsOf(path.get('alternate'), resolving)]
  if(path.isLogicalExpression())
    return [...patternsOf(path.get('left'), resolving), ...patternsOf(path.get('right'), resolving)]
  if(path.isArrayExpression())
    return path.get('elements').flatMap(element => patternsOf(element, resolving))
  if(path.isIdentifier()) {
    const binding = path.scope.getBinding(path.node.name)
    const declarator = binding?.path
    if(binding?.constant && !resolving.has(binding) && declarator.isVariableDeclarator() &&
       declarator.get('id').isIdentifier() && declarator.node.init)
      return patternsOf(declarator.get('init'), new Set([...resolving, binding]))
  }
  return [[ANY]]
}

const isTranslate = callee =>
  (callee.type === 'Identifier' && callee.name === 't') ||
  (['MemberExpression', 'OptionalMemberExpression'].includes(callee.type) && !callee.computed && callee.property.name === 't')

/**
 * The keys one file passes to t() (t, i18n.t, this.props.t) or a Trans
 * i18nKey, and every string literal in it.
 *
 * @returns {{sites: object[], literals: {value: string, line: number}[]}}
 *   one site per call: its literal keys, its patterns ('a.*' for `a.${b}`),
 *   and opaque when some value of it can't be read (a parameter, a property,
 *   a Trans without i18nKey).
 */
export const scanSource = (code, file) => {
  const ast = babel.parseSync(code, {
    filename: file, babelrc: false, configFile: false, sourceType: 'module', parserOpts: { plugins: ['jsx'] }
  })
  const sites = []
  const literals = []
  const addSite = path => {
    const patterns = patternsOf(path)
    const unique = values => [...new Set(values)]
    sites.push({
      file,
      line: path.node.loc.start.line,
      expression: code.slice(path.node.start, path.node.end).replace(/\s+/g, ' '),
      keys: unique(patterns.filter(pattern => !pattern.includes(ANY)).map(pattern => pattern.join(''))),
      patterns: unique(patterns
        .filter(pattern => pattern.includes(ANY) && pattern.some(part => part !== ANY))
        .map(pattern => pattern.map(part => part === ANY ? '*' : part).join(''))),
      opaque: patterns.some(pattern => pattern.length === 1 && pattern[0] === ANY)
    })
  }
  babel.traverse(ast, {
    // i18n?.t('key') and t?.('key') are OptionalCallExpressions
    'CallExpression|OptionalCallExpression'(path) {
      if(isTranslate(path.node.callee) && path.node.arguments.length)
        addSite(path.get('arguments.0'))
    },
    JSXAttribute(path) {
      if(path.node.name.name !== 'i18nKey' || !path.node.value)
        return
      const value = path.get('value')
      addSite(value.isJSXExpressionContainer() ? value.get('expression') : value)
    },
    JSXOpeningElement(path) {
      const { name, attributes } = path.node
      if(name.name === 'Trans' && !attributes.some(attribute => attribute.name?.name === 'i18nKey'))
        sites.push({ file, line: path.node.loc.start.line, expression: '<Trans> without i18nKey', keys: [], patterns: [], opaque: true })
    },
    StringLiteral(path) {
      literals.push({ value: path.node.value, line: path.node.loc.start.line })
    },
    TemplateLiteral(path) {
      if(!path.node.expressions.length)
        literals.push({ value: path.node.quasis[0].value.cooked, line: path.node.loc.start.line })
    }
  })
  return { sites, literals }
}

/**
 * How a locale's catalog differs from English, both flattened. Missing keys
 * fall back to English; blank values show nothing; values identical to
 * English may be untranslated or may be right (ID, JSON).
 */
export const compareLocale = (english, other) => {
  const isBlank = key => typeof other[key] === 'string' && !other[key].trim()
  const keys = Object.keys(english).sort()
  return {
    total: Object.keys(other).length,
    missing: keys.filter(key => !(key in other)),
    blank: keys.filter(key => key in other && isBlank(key)),
    sameAsEnglish: keys.filter(key => key in other && !isBlank(key) && other[key] === english[key]),
    extra: Object.keys(other).filter(key => !(key in english)).sort()
  }
}

const toRegExp = pattern => new RegExp(`^${pattern.split('*').map(text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)

/**
 * @param {object} options
 * @param {{file: string, code: string}[]} options.sources  the files to scan
 * @param {object} options.catalogs  locale -> catalog, including en
 * @param {{file: string, expression: string, keys: string[], evidence: string}[]} [options.families]
 *   the keys a dynamic call site can produce, checked by hand: scripts/i18n-audit/families.json
 * @returns {object} each English key's evidence of use, the dynamic families
 *   and opaque sites behind it, problems to fix, and each locale against English
 */
export const auditKeys = ({ sources, catalogs, families: declarations = [] }) => {
  const english = flattenCatalog(catalogs.en)
  const keys = Object.keys(english).sort()
  // Files in code-unit order, as Array#sort uses, so the report doesn't change
  // with the locale; each file's sites and literals are in source order.
  const scanned = [...sources]
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map(({ file, code }) => ({ file, ...scanSource(code, file) }))
  const sites = scanned.flatMap(scan => scan.sites)

  const staticSites = {}
  sites.forEach(site => site.keys.forEach(key => (staticSites[key] = staticSites[key] || []).push(`${site.file}:${site.line}`)))

  const used = new Set()
  const declaredOutsidePattern = new Set()
  const declaredMissingFromCatalog = new Set()
  const families = sites.filter(site => site.patterns.length).flatMap(site => {
    const declaration = declarations.find(family => family.file === site.file && family.expression === site.expression)
    const regExps = site.patterns.map(toRegExp)
    declaration?.keys.forEach(key => {
      if(!regExps.some(regExp => regExp.test(key)))
        declaredOutsidePattern.add(key)
      else if(!(key in english))
        declaredMissingFromCatalog.add(key)
    })
    return site.patterns.map((pattern, i) => {
      const familyKeys = (declaration ? declaration.keys.filter(key => key in english) : keys).filter(key => regExps[i].test(key))
      familyKeys.forEach(key => used.add(key))
      return {
        file: site.file, line: site.line, expression: site.expression, pattern, keys: familyKeys,
        broad: NAMESPACE_WIDE.test(pattern), declared: Boolean(declaration)
      }
    })
  })

  const literalSites = {}
  scanned.forEach(scan => scan.literals.forEach(({ value, line }) => {
    if(value in english && !(value in staticSites) && !used.has(value))
      (literalSites[value] = literalSites[value] || []).push(`${scan.file}:${line}`)
  }))

  return {
    files: sources.length,
    english,
    keys: {
      static: keys.filter(key => key in staticSites),
      dynamic: keys.filter(key => !(key in staticSites) && used.has(key)),
      literal: keys.filter(key => key in literalSites),
      unreferenced: keys.filter(key => !(key in staticSites) && !used.has(key) && !(key in literalSites))
    },
    staticSiteCount: sites.filter(site => site.keys.length).length,
    families,
    opaqueSites: sites.filter(site => site.opaque),
    literalSites,
    problems: {
      missingFromCatalog: Object.keys(staticSites).filter(key => !(key in english)).sort()
        .map(key => ({ key, sites: staticSites[key] })),
      undeclaredBroad: families.filter(family => family.broad && !family.declared),
      declaredOutsidePattern: [...declaredOutsidePattern].sort(),
      declaredMissingFromCatalog: [...declaredMissingFromCatalog].sort(),
      staleDeclarations: declarations.filter(family => !sites.some(site => site.patterns.length && site.file === family.file && site.expression === family.expression))
    },
    locales: Object.keys(catalogs).filter(locale => locale !== 'en').sort()
      .map(locale => ({ locale, ...compareLocale(english, flattenCatalog(catalogs[locale])) }))
  }
}

// A Markdown code span that survives backticks and table pipes in the text.
const code = text => {
  const flat = String(text).replace(/\s*\n\s*/g, ' ')
  const fence = '`'.repeat(Math.max(0, ...(flat.match(/`+/g) || []).map(run => run.length)) + 1)
  const pad = flat.startsWith('`') || flat.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${flat}${pad}${fence}`.replace(/\|/g, '\\|')
}

const keyList = keys => keys.length ? keys.map(code).join(', ') : 'none'

export const renderReport = result => {
  const { keys, english, families, opaqueSites, literalSites, problems, locales } = result
  const problemLines = [
    ...problems.missingFromCatalog.map(({ key, sites }) => `- ${code(key)} is referenced (${sites.join(', ')}) but isn't in the English catalog.`),
    ...problems.undeclaredBroad.map(family => `- ${family.file}:${family.line} ${code(family.expression)} spans the whole namespace; declare its keys in \`scripts/i18n-audit/families.json\`. Until then all ${family.keys.length} keys it matches count as used.`),
    ...problems.declaredOutsidePattern.map(key => `- ${code(key)} is declared in \`families.json\` but its call site's expression can't produce it.`),
    ...problems.declaredMissingFromCatalog.map(key => `- ${code(key)} is declared in \`families.json\` but isn't in the English catalog.`),
    ...problems.staleDeclarations.map(family => `- \`families.json\` declares ${family.file} ${code(family.expression)}, which no longer exists.`)
  ]
  return [
    '# i18n key audit',
    '',
    'Generated by `npm run i18n:audit` from the source under `src/` (tests excluded) and the',
    'catalogs in `src/i18n/locales/`. Rerun it rather than edit this file. The method and its',
    'limits are in `scripts/i18n-audit/README.md`.',
    '',
    '## Summary',
    '',
    '| English keys | Count |',
    '|---|---:|',
    `| English catalog | ${Object.keys(english).length} |`,
    `| Referenced by a literal key | ${keys.static.length} |`,
    `| Matched only by a dynamic key family | ${keys.dynamic.length} |`,
    `| Mentioned only as a string literal | ${keys.literal.length} |`,
    `| **Unreferenced** | **${keys.unreferenced.length}** |`,
    '',
    `Scanned ${result.files} source files: ${result.staticSiteCount} call sites with a literal key, ` +
      `${families.length} dynamic key families, ${opaqueSites.length} call sites whose key the audit can't read.`,
    '',
    '## Needs attention',
    '',
    ...(problemLines.length ? problemLines : ['Nothing.']),
    '',
    '## Locales compared with English',
    '',
    '| Locale | Keys | Missing | Blank | Same as English | Not in English |',
    '|---|---:|---:|---:|---:|---:|',
    ...locales.map(l => `| ${l.locale} | ${l.total} | ${l.missing.length} | ${l.blank.length} | ${l.sameAsEnglish.length} | ${l.extra.length} |`),
    '',
    ...locales.flatMap(l => [
      `### ${l.locale}`,
      '',
      `- Missing: ${keyList(l.missing)}`,
      `- Blank: ${keyList(l.blank)}`,
      `- Same as English: ${l.sameAsEnglish.length ? l.sameAsEnglish.map(key => `${code(key)} (${code(english[key])})`).join(', ') : 'none'}`,
      `- Not in English: ${keyList(l.extra)}`,
      ''
    ]),
    '## Dynamic key families',
    '',
    'A key built at run time, as a pattern. A declared family counts only the keys',
    '`scripts/i18n-audit/families.json` lists for it; any other counts every key its pattern matches.',
    '',
    '| Call site | Key expression | Pattern | Keys |',
    '|---|---|---|---|',
    ...families.map(family => `| ${family.file}:${family.line} | ${code(family.expression)} | ${code(family.pattern)} | ` +
      `${family.declared ? 'declared: ' : ''}${family.keys.length > 12 ? `${family.keys.length} keys` : keyList(family.keys)} |`),
    '',
    '## Call sites whose key the audit can\'t read',
    '',
    'The key comes from a parameter or a property. Such keys are usually string literals',
    'elsewhere, which the next section counts.',
    '',
    '| Call site | Key expression |',
    '|---|---|',
    ...opaqueSites.map(site => `| ${site.file}:${site.line} | ${code(site.expression)} |`),
    '',
    '## Mentioned only as a string literal',
    '',
    '| Key | Where |',
    '|---|---|',
    ...keys.literal.map(key => `| ${code(key)} | ${literalSites[key].join(', ')} |`),
    '',
    `## Unreferenced keys (${keys.unreferenced.length})`,
    '',
    'No call site, dynamic family or string literal in the source can produce these. Check',
    'each by hand before removing it (see the README).',
    '',
    '| Key | English |',
    '|---|---|',
    ...keys.unreferenced.map(key => `| ${code(key)} | ${code(english[key])} |`),
    ''
  ].join('\n')
}
