/**
 * The footer, on every page, links OCL's Terms of Use and Privacy Policy
 * (OpenConceptLab/ocl_issues#2900) and the OCL Community website
 * (OpenConceptLab/ocl_online#418).
 *
 * Footer is JSX, which these tests can't mount (they run without a JSX
 * transform), so this reads its source: each link must go to the page's URL,
 * open in a new tab without handing it window.opener, and carry a label that
 * every locale translates.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import babel from '@babel/core'

const LINKS = {
  'https://openconceptlab.org': 'OCL Community website',
  'https://openconceptlab.org/terms-of-use': 'Terms of Use',
  'https://openconceptlab.org/privacy-policy': 'Privacy Policy',
}
const OTHER_LOCALES = ['es', 'pt-BR', 'zh']

const parse = path => babel.parseSync(
  readFileSync(new URL(path, import.meta.url), 'utf8'),
  {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}}
)

// The string constants in common/constants.js, which an href may name.
const constants = {}
babel.traverse(parse('../../../common/constants.js'), {
  VariableDeclarator({node}) {
    if(node.init?.type === 'StringLiteral')
      constants[node.id.name] = node.init.value
  }
})

// Each link Footer renders: its attributes, and the key its t() label reads.
const links = []
babel.traverse(parse('../Footer.jsx'), {
  JSXElement({node}) {
    if(!['a', 'Link'].includes(node.openingElement.name.name))
      return
    const link = {}
    node.openingElement.attributes.filter(attr => attr.type === 'JSXAttribute').forEach(({name, value}) => {
      link[name.name] = value?.type === 'StringLiteral' ? value.value : constants[value?.expression?.name]
    })
    const label = node.children.find(child => child.expression?.callee?.name === 't')
    link.label = label?.expression.arguments[0].value
    links.push(link)
  }
})

const load = locale =>
  JSON.parse(readFileSync(new URL(`../../../i18n/locales/${locale}/translations.json`, import.meta.url), 'utf8'))
const translate = (locale, key) => key.split('.').reduce((node, part) => node?.[part], load(locale))

for(const [href, english] of Object.entries(LINKS)) {
  test(`footer links ${english} in a new tab, labelled in every locale`, () => {
    const link = links.find(link => link.href === href)
    assert.ok(link, `Footer.jsx has no link to ${href}`)
    assert.equal(link.target, '_blank')
    assert.equal(link.rel, 'noopener noreferrer')
    assert.ok(link.label, `the ${english} link has no t() label`)
    assert.equal(translate('en', link.label), english)
    for(const locale of OTHER_LOCALES) {
      const value = translate(locale, link.label)
      assert.equal(typeof value, 'string', `${locale} has no ${link.label}`)
      assert.ok(value.trim() && value !== english, `${locale} leaves ${link.label} untranslated: "${value}"`)
    }
  })
}
