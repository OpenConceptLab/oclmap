import test from 'node:test'
import assert from 'node:assert/strict'

import {
  auditKeys,
  compareLocale,
  flattenCatalog,
  renderReport,
  scanSource
} from '../audit.js'

const CATALOG = {
  common: { save: 'Save', cancel: 'Cancel', id: 'ID', unused: 'Unused' },
  map_project: {
    view_all: 'All',
    view_mapped: 'Mapped',
    recommended: 'Recommended',
    available: 'Available',
    low_ranked: 'Low Ranked',
    never_shown: 'Never shown'
  },
  quota: { meter: { rows: 'Rows', projects: 'Projects' } },
  search: { concepts: 'concepts', mappings: 'mappings' }
}

const keysOf = scan => scan.sites.flatMap(site => site.keys).sort()
const patternsOf = scan => scan.sites.flatMap(site => site.patterns).sort()

test('flattenCatalog joins nested keys with dots', () => {
  assert.deepEqual(flattenCatalog({ a: { b: 'x', c: { d: 'y' } }, e: 'z' }), { 'a.b': 'x', 'a.c.d': 'y', e: 'z' })
})

test('scanSource reads literal keys from t(), i18n.t(), this.props.t() and i18nKey', () => {
  const scan = scanSource(`
    const A = () => {
      const { t } = useTranslation()
      return <div title={t("common.cancel")}>
        {t('common.save')}{t(\`common.id\`)}{i18n.t('a.b')}{this.props.t('c.d')}
        <Trans i18nKey='e.f' /><Trans i18nKey={'g.h'} components={[<b key='b' />]} />
      </div>
    }`, 'A.jsx')
  assert.deepEqual(keysOf(scan), ['a.b', 'c.d', 'common.cancel', 'common.id', 'common.save', 'e.f', 'g.h'])
  assert.deepEqual(patternsOf(scan), [])
})

test('scanSource takes every branch of a conditional, a logical fallback and a fallback-key array', () => {
  const scan = scanSource(`
    t(isCap ? 'quota.cap' : 'quota.quota')
    t(custom || 'common.save')
    t(['quota.consequence.' + meter, 'quota.consequence.generic'])`, 'B.js')
  assert.deepEqual(keysOf(scan), ['common.save', 'quota.cap', 'quota.consequence.generic', 'quota.quota'])
  assert.deepEqual(patternsOf(scan), ['quota.consequence.*'])
  assert.equal(scan.sites[1].opaque, true, 'custom could be any key')
})

test('scanSource turns template literals and concatenation into key patterns', () => {
  const scan = scanSource(`
    t(\`map_project.preview_limit_body_\${kind}_no_count\`)
    t('map_project.view_' + getState(row).toLowerCase())
    t(\`quota.consequence.\${meter}.\${surface}\`)`, 'C.js')
  assert.deepEqual(patternsOf(scan), [
    'map_project.preview_limit_body_*_no_count',
    'map_project.view_*',
    'quota.consequence.*.*'
  ])
})

test('scanSource lists a pattern once when several branches produce it', () => {
  const scan = scanSource(`
    const reason = ready ? getReason() : null
    t(\`map_project.preview_limit_title_\${reason}\`)`, 'G.js')
  assert.deepEqual(scan.sites[0].patterns, ['map_project.preview_limit_title_*'])
})

test('scanSource follows a const to its value, but not a parameter or a destructured name', () => {
  const scan = scanSource(`
    const key = active ? 'common.save' : 'common.cancel'
    t(key)
    const Label = ({ labelKey }) => t(labelKey)
    const { other } = props
    t(other)`, 'D.jsx')
  assert.deepEqual(keysOf(scan), ['common.cancel', 'common.save'])
  assert.deepEqual(scan.sites.filter(site => site.opaque).map(site => site.expression), ['labelKey', 'other'])
})

test('scanSource records a Trans without i18nKey as a site it cannot read', () => {
  const scan = scanSource('const A = () => <Trans>Hello <b>world</b></Trans>', 'E.jsx')
  assert.equal(scan.sites.length, 1)
  assert.equal(scan.sites[0].opaque, true)
  assert.equal(scan.sites[0].via, 'Trans')
})

test('scanSource collects string literals so keys stored in config objects count', () => {
  const scan = scanSource(`
    const COLUMNS = [{ id: 'id', labelKey: 'common.id' }, { labelKey: \`common.save\` }]
    const prefixed = \`common.\${x}\``, 'F.js')
  const values = scan.literals.map(literal => literal.value)
  assert.ok(values.includes('common.id'))
  assert.ok(values.includes('common.save'))
  assert.ok(!values.includes('common.'), 'a template with a placeholder is not a literal')
})

test('auditKeys sorts keys into literal, dynamic, string-literal and unreferenced', () => {
  const result = auditKeys({
    sources: [
      { file: 'src/A.jsx', code: "t('common.save'); t('map_project.view_' + state); t(`quota.meter.${meter}`)" },
      { file: 'src/B.js', code: "export const COLUMNS = [{ labelKey: 'common.id' }]; t(col.labelKey)" }
    ],
    catalogs: { en: CATALOG }
  })
  assert.deepEqual(result.keys.static, ['common.save'])
  assert.deepEqual(result.keys.dynamic, ['map_project.view_all', 'map_project.view_mapped', 'quota.meter.projects', 'quota.meter.rows'])
  assert.deepEqual(result.keys.literal, ['common.id'])
  assert.deepEqual(result.keys.unreferenced, [
    'common.cancel', 'common.unused',
    'map_project.available', 'map_project.low_ranked', 'map_project.never_shown', 'map_project.recommended',
    'search.concepts', 'search.mappings'
  ])
  assert.deepEqual(result.opaqueSites.map(site => `${site.file}:${site.line} ${site.expression}`), ['src/B.js:1 col.labelKey'])
})

test('auditKeys counts an undeclared namespace-wide family against every key it matches, and flags it', () => {
  const result = auditKeys({
    sources: [{ file: 'src/Bucket.jsx', code: "t('map_project.' + id)" }],
    catalogs: { en: CATALOG }
  })
  const family = result.families[0]
  assert.equal(family.broad, true)
  assert.equal(family.declared, false)
  assert.equal(family.keys.length, 6)
  assert.ok(!result.keys.unreferenced.some(key => key.startsWith('map_project.')))
  assert.deepEqual(result.problems.undeclaredBroad.map(f => f.expression), ["'map_project.' + id"])
})

test('auditKeys uses the declared keys of a namespace-wide family', () => {
  const result = auditKeys({
    sources: [
      { file: 'src/Bucket.jsx', code: "t('map_project.' + id)\nt('map_project.' + id)" },
      { file: 'src/Search.jsx', code: 't(`search.${resource}`)' }
    ],
    catalogs: { en: CATALOG },
    families: [
      { file: 'src/Bucket.jsx', expression: "'map_project.' + id", keys: ['map_project.recommended', 'map_project.available', 'map_project.low_ranked'], evidence: 'BucketButton ids' },
      { file: 'src/Search.jsx', expression: '`search.${resource}`', keys: ['search.concepts'], evidence: 'resource is always concepts' }
    ]
  })
  assert.equal(result.families.length, 3)
  assert.ok(result.families.every(family => family.declared))
  assert.deepEqual(result.keys.dynamic, ['map_project.available', 'map_project.low_ranked', 'map_project.recommended', 'search.concepts'])
  assert.ok(result.keys.unreferenced.includes('map_project.never_shown'))
  assert.ok(result.keys.unreferenced.includes('search.mappings'))
  assert.deepEqual(result.problems.undeclaredBroad, [])
})

test('auditKeys flags declarations that no longer fit the code or the catalog', () => {
  const result = auditKeys({
    sources: [{ file: 'src/Bucket.jsx', code: "t('map_project.' + id)" }],
    catalogs: { en: CATALOG },
    families: [
      { file: 'src/Bucket.jsx', expression: "'map_project.' + id", keys: ['map_project.recommended', 'map_project.very_high', 'common.save'] },
      { file: 'src/Gone.jsx', expression: "'search.' + resource", keys: ['search.concepts'] }
    ]
  })
  assert.deepEqual(result.problems.declaredMissingFromCatalog, ['map_project.very_high'])
  assert.deepEqual(result.problems.declaredOutsidePattern, ['common.save'])
  assert.deepEqual(result.problems.staleDeclarations.map(family => family.file), ['src/Gone.jsx'])
})

test('auditKeys reports literal keys the English catalog lacks', () => {
  const result = auditKeys({
    sources: [{ file: 'src/A.jsx', code: "t('common.save'); t('common.not_there')" }],
    catalogs: { en: CATALOG }
  })
  assert.deepEqual(result.problems.missingFromCatalog, [{ key: 'common.not_there', sites: ['src/A.jsx:1'] }])
})

test('compareLocale separates missing keys, blank values and values identical to English', () => {
  const english = { 'a.one': 'One', 'a.two': 'Two', 'a.id': 'ID', 'a.blank': 'Blank' }
  const other = { 'a.one': 'Um', 'a.id': 'ID', 'a.blank': '  ', 'a.extra': 'Extra' }
  assert.deepEqual(compareLocale(english, other), {
    total: 4,
    missing: ['a.two'],
    blank: ['a.blank'],
    sameAsEnglish: ['a.id'],
    extra: ['a.extra']
  })
})

test('auditKeys compares every other locale with English', () => {
  const result = auditKeys({
    sources: [],
    catalogs: { en: { a: { one: 'One', two: 'Two' } }, es: { a: { one: 'Uno' } }, 'pt-BR': { a: { one: 'Um', two: 'Two' } } }
  })
  assert.deepEqual(result.locales.map(locale => [locale.locale, locale.missing, locale.sameAsEnglish]), [
    ['es', ['a.two'], []],
    ['pt-BR', [], ['a.two']]
  ])
})

test('auditKeys and renderReport do not depend on the order files are read in', () => {
  const sources = [
    { file: 'src/A.jsx', code: "t('common.save'); t(labelKey)" },
    { file: 'src/B.jsx', code: "t('map_project.view_' + x); t(isCap ? 'common.cancel' : 'common.id')" }
  ]
  const catalogs = { en: CATALOG, es: { common: { save: 'Guardar' } } }
  const forward = renderReport(auditKeys({ sources, catalogs }))
  const backward = renderReport(auditKeys({ sources: [...sources].reverse(), catalogs }))
  assert.equal(forward, backward)
  assert.match(forward, /\| English catalog \| 14 \|/)
  assert.match(forward, /`common\.unused`/)
})
