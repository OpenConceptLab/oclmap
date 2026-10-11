#!/usr/bin/env node
// Prints the i18n key audit (OpenConceptLab/ocl_issues#2880) for this
// checkout, or for another one with --root. See README.md.
//
//   npm run i18n:audit                                       # print the report
//   npm run i18n:audit -- --out scripts/i18n-audit/report.md # write it
//   npm run i18n:audit -- --root <checkout>                  # audit another checkout's src/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { auditKeys, renderReport } from '../../src/i18n/audit.js'

const option = name => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(option('--root') || path.join(here, '..', '..'))
const out = option('--out')

const SKIP = new Set(['__tests__', '__integration__', 'node_modules'])
const listSources = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name)
  if(entry.isDirectory())
    return SKIP.has(entry.name) ? [] : listSources(full)
  return /\.jsx?$/.test(entry.name) ? [full] : []
})

const relative = file => path.relative(root, file).split(path.sep).join('/')
const sources = listSources(path.join(root, 'src')).map(file => ({ file: relative(file), code: fs.readFileSync(file, 'utf8') }))

const localesDir = path.join(root, 'src', 'i18n', 'locales')
const catalogs = Object.fromEntries(fs.readdirSync(localesDir).sort().map(locale => [
  locale, JSON.parse(fs.readFileSync(path.join(localesDir, locale, 'translations.json'), 'utf8'))
]))

// This checkout's declarations, also for --root: an older tree has none, and
// the report flags any that no longer fit it.
const families = JSON.parse(fs.readFileSync(path.join(here, 'families.json'), 'utf8'))

const report = renderReport(auditKeys({ sources, catalogs, families }))
if(out)
  fs.writeFileSync(out, report)
else
  process.stdout.write(report)
