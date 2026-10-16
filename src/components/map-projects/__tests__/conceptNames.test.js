/**
 * Tests for the candidate-name helpers in conceptNames.js
 * (OpenConceptLab/ocl_issues#2909):
 *   - localizedDisplayName: the name a candidate leads with, in the project's
 *     input language, falling back to the repository's default locale
 *   - getMatchedName: the name that matched, shown second with its locale,
 *     only when it differs from the name the candidate leads with
 *
 * Run with: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { localizedDisplayName, getMatchedName, highlightHtml } from '../conceptNames.js'

// LOINC 89497-2 as the ticket found it: an English display name, and an
// it-IT related name that ES matched for the input "Pregnancy test".
const PRENATAL_TESTS = {
  id: '89497-2',
  display_name: "Mother's Prenatal tests",
  names: [
    { name: "Mother's Prenatal tests", locale: 'en', locale_preferred: true, name_type: 'FULLY_SPECIFIED' },
    { name: 'Anamnesi Punto nel tempo (episodio) Test prenatale', locale: 'it-IT', locale_preferred: false }
  ]
}

const PREGNANCY_TEST = {
  id: '2106-3',
  display_name: 'Pregnancy test',
  names: [
    { name: 'Pregnancy test', locale: 'en', locale_preferred: true },
    { name: 'HCG test', locale: 'en' },
    { name: 'Test de embarazo', locale: 'es' },
    { name: 'Prueba de embarazo', locale: 'es', locale_preferred: true },
    { name: 'Teste de gravidez', locale: 'pt-BR' }
  ]
}

// ---------- localizedDisplayName ----------

test('localizedDisplayName: keeps the display name when the project has no input language', () => {
  assert.equal(localizedDisplayName(PREGNANCY_TEST, ''), 'Pregnancy test')
  assert.equal(localizedDisplayName(PREGNANCY_TEST, undefined), 'Pregnancy test')
})

test('localizedDisplayName: keeps the display name when it is already in the input language', () => {
  const concept = {
    display_name: 'Pregnancy test',
    names: [
      { name: 'HCG test', locale: 'en', locale_preferred: true },
      { name: 'Pregnancy test', locale: 'en' }
    ]
  }
  assert.equal(localizedDisplayName(concept, 'en'), 'Pregnancy test')
  assert.equal(localizedDisplayName(PRENATAL_TESTS, 'en'), "Mother's Prenatal tests")
})

test('localizedDisplayName: leads with the preferred name in the input language', () => {
  assert.equal(localizedDisplayName(PREGNANCY_TEST, 'es'), 'Prueba de embarazo')
})

test('localizedDisplayName: matches the input language on its primary subtag', () => {
  assert.equal(localizedDisplayName(PREGNANCY_TEST, 'pt'), 'Teste de gravidez')
  assert.equal(localizedDisplayName(PRENATAL_TESTS, 'it'), 'Anamnesi Punto nel tempo (episodio) Test prenatale')
})

test('localizedDisplayName: without a preferred name, takes the fully specified name, then the first', () => {
  const names = [
    { name: 'PE', locale: 'es', name_type: 'SHORT' },
    { name: 'Prueba de embarazo', locale: 'es', name_type: 'FULLY_SPECIFIED' }
  ]
  assert.equal(localizedDisplayName({ display_name: 'Pregnancy test', names }, 'es'), 'Prueba de embarazo')
  assert.equal(localizedDisplayName({ display_name: 'Pregnancy test', names: names.slice(0, 1) }, 'es'), 'PE')
})

test('localizedDisplayName: falls back to the repository default-locale display name', () => {
  assert.equal(localizedDisplayName(PREGNANCY_TEST, 'fr'), 'Pregnancy test')
  assert.equal(localizedDisplayName({ display_name: 'Pregnancy test' }, 'es'), 'Pregnancy test')
  assert.equal(localizedDisplayName(null, 'es'), undefined)
})

// ---------- getMatchedName ----------

test('getMatchedName: the translated name that matched comes second, with its locale (the ticket case)', () => {
  const displayName = localizedDisplayName(PRENATAL_TESTS, 'en')
  assert.deepEqual(
    getMatchedName({
      highlights: { synonyms: ['Anamnesi Punto nel tempo (episodio) <em>Test</em> prenatale'] },
      concept: PRENATAL_TESTS,
      displayName
    }),
    {
      html: "Anamnesi Punto nel tempo (episodio) <b className='searchable'>Test</b> prenatale",
      text: 'Anamnesi Punto nel tempo (episodio) Test prenatale',
      locale: 'it-IT'
    }
  )
})

test('getMatchedName: nothing when the name that matched is the one the candidate leads with', () => {
  assert.equal(
    getMatchedName({
      highlights: { synonyms: ['<em>Prueba</em> de <em>embarazo</em>'] },
      concept: PREGNANCY_TEST,
      displayName: localizedDisplayName(PREGNANCY_TEST, 'es')
    }),
    null
  )
  assert.equal(
    getMatchedName({
      highlights: { synonyms: ['<em>pregnancy</em>  TEST'] },
      concept: PREGNANCY_TEST,
      displayName: 'Pregnancy test'
    }),
    null
  )
})

test('getMatchedName: nothing when the display name matched and the candidate leads with it', () => {
  assert.equal(
    getMatchedName({
      highlights: { name: ['<em>Pregnancy</em> <em>test</em>'], synonyms: ['<em>HCG</em> <em>test</em>'] },
      concept: PREGNANCY_TEST,
      displayName: localizedDisplayName(PREGNANCY_TEST, 'en')
    }),
    null
  )
})

test('getMatchedName: the default-locale display name that matched comes second when the candidate leads in another language', () => {
  assert.deepEqual(
    getMatchedName({
      highlights: { name: ['<em>Pregnancy</em> <em>test</em>'] },
      concept: PREGNANCY_TEST,
      displayName: localizedDisplayName(PREGNANCY_TEST, 'es')
    }),
    {
      html: "<b className='searchable'>Pregnancy</b> <b className='searchable'>test</b>",
      text: 'Pregnancy test',
      locale: 'en'
    }
  )
})

test('getMatchedName: takes the synonym with the longest highlighted match', () => {
  assert.deepEqual(
    getMatchedName({
      highlights: { synonyms: ['<em>Test</em> de embarazo', '<em>Prueba de embarazo</em>'] },
      concept: PREGNANCY_TEST,
      displayName: 'Pregnancy test'
    }),
    { html: "<b className='searchable'>Prueba de embarazo</b>", text: 'Prueba de embarazo', locale: 'es' }
  )
})

test('getMatchedName: hides a matched name outside the name-locale filter, comparing primary subtags', () => {
  const args = {
    highlights: { synonyms: ['Anamnesi Punto nel tempo (episodio) <em>Test</em> prenatale'] },
    concept: PRENATAL_TESTS,
    displayName: "Mother's Prenatal tests"
  }
  assert.equal(getMatchedName({ ...args, filterLocales: 'en,es' }), null)
  assert.equal(getMatchedName({ ...args, filterLocales: 'en, it' })?.locale, 'it-IT')
  assert.equal(getMatchedName({ ...args, filterLocales: '' })?.locale, 'it-IT')
})

test('getMatchedName: a matched name no concept name carries shows without a locale, unless a filter is set', () => {
  const args = {
    highlights: { synonyms: ['<em>Gravindex</em>'] },
    concept: PREGNANCY_TEST,
    displayName: 'Pregnancy test'
  }
  assert.deepEqual(getMatchedName(args), { html: "<b className='searchable'>Gravindex</b>", text: 'Gravindex', locale: undefined })
  assert.equal(getMatchedName({ ...args, filterLocales: 'en' }), null)
})

test('getMatchedName: nothing without highlights', () => {
  assert.equal(getMatchedName({ concept: PREGNANCY_TEST, displayName: 'Pregnancy test' }), null)
  assert.equal(getMatchedName({ highlights: { synonyms: [] }, concept: PREGNANCY_TEST, displayName: 'Pregnancy test' }), null)
})

test('getMatchedName: only the highlight tags are markup', () => {
  assert.deepEqual(
    getMatchedName({
      highlights: { synonyms: ["<i>Mother's</i> & <em>Prenatal</em>"] },
      concept: { names: [] },
      displayName: 'Prenatal tests'
    }),
    { html: "&lt;i&gt;Mother&#39;s&lt;/i&gt; &amp; <b className='searchable'>Prenatal</b>", text: "<i>Mother's</i> & Prenatal", locale: undefined }
  )
  assert.equal(highlightHtml('<i>Hb</i> <em>Hemoglobin</em>'), '&lt;i&gt;Hb&lt;/i&gt; <b>Hemoglobin</b>')
})
