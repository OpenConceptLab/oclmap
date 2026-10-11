/* eslint-env node */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../../../scripts/i18n-audit/audit.mjs', import.meta.url))

const writeFile = (root, file, content) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), content)
}

test('npm run i18n:audit -- --root audits another tree with this checkout\'s families.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-audit-'))
  try {
    writeFile(root, 'src/components/map-projects/ScoreBucketButton.jsx', "export const Label = ({ id }) => t('map_project.' + id)\n")
    writeFile(root, 'src/i18n/locales/en/translations.json', JSON.stringify({
      map_project: { recommended: 'Recommended', available: 'Available', low_ranked: 'Low Ranked', unused: 'Unused' }
    }))
    const report = execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI, '--root', root], { encoding: 'utf8' })
    assert.match(report, /\| \*\*Unreferenced\*\* \| \*\*1\*\* \|/)
    assert.match(report, /\| `map_project\.unused` \| `Unused` \|/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
