# i18n audit findings, October 2026

The review OpenConceptLab/ocl_issues#2880 asked for, done with `npm run i18n:audit`
on `main` at 0f6b0be. [`report.md`](report.md) has the full lists, and the
[README](README.md) the method and its limits. No catalog key is removed here:
that's a separate, reviewed change.

## Counts

Of the 778 English keys:

| | Keys |
|---|---:|
| Referenced by a literal key | 487 |
| Matched only by a dynamic key family | 62 |
| Mentioned only as a string literal | 21 |
| Unreferenced | 208 |

Every dynamic key family is accounted for. Of the 20, 13 have a literal part
narrow enough to count every key their pattern matches. The other 7 span a
whole namespace: two calls of `` `concept.${prop}` ``, one of
`` `search.${resource}` `` and four of `'map_project.' + <bucket>`. For those,
`families.json` declares the keys, citing the code that produces them.

The 4 call sites the audit can't read get their keys from string literals:

- `AnnouncementBanner.jsx` `t(labelKey)`: `ANNOUNCEMENT_LINKS`, in the same file.
- `MapperQuotaChip.jsx` `t(labelKey)`: the three `meterLine('map_project.preview_quota_…')` calls below it.
- `TableResults.jsx` `t(headCell.labelKey)`: column configs in `ResultConstants.js`, `Candidates.jsx` and `Search.jsx`.
- `MultiAlgoSelector.jsx` `t(algo.name?.props?.i18nKey)`: an algorithm whose name is a `<Trans>` element.
  No algorithm defines its name that way today, so no key reaches it.

Apart from `src/i18n/audit.js` itself, every file the audit scans is imported,
directly or through others, from `src/index.jsx`, so no reference comes from a
file the app never loads.

## The unreferenced keys, checked by hand

For each of the 208 keys, the source (tests excluded) was searched for the
key's last segment inside any string or template literal. 58 keys had hits,
and none of the hits builds a key:

- CSS values and class names (`clear`, `display`, `visibility`), URL segments
  (`/compare`, `versions/`), API fields (`first_name`, `include_retired`,
  `map_types`) and storage keys (`session_expired`).
- Log action types: `ProjectLogs.jsx` picks an icon by action (`created`,
  `auto_matched`); it doesn't translate it.
- Display modes: `DisplayMenu.jsx` labels `card` and `table` with
  `search.list_view` and `search.table_view`, not `search.card` and `search.table`.
- Sort fields: `SortMenu.jsx` labels them with `startCase()`, not `t()`, so
  `search.score` is unused.

All 208 stand.

14 of the 21 keys mentioned only as a string literal are probably unused too.
They appear only in `ALL_COLUMNS` in `ResultConstants.js`, in the column sets
for mappings, repos, orgs, users and the URL registry. `TableResults.jsx` is the
only reader, through `SearchResults`, and both places that render
`SearchResults` pass `resource='concepts'`. These are `common.created_on`, the
three `mapping.*`, `repo.repo_id`, `repo.repo_type`, the two `url_registry.*`
and the six `user.*` keys in the report's string-literal table. Removing them
means trimming those column sets as well.

## Keys the code uses that English lacks

The report's *Needs attention* section lists five:

- `common.none` (`MatchDetailsPanel.jsx`), `common.saved` (`MultiAlgoSelector.jsx`)
  and `search.save_default_filters` (`SearchFilters.jsx`) render as the raw key
  in every language.
- `map_project.candidates_legacy_shape` (`MapProject.jsx`) and
  `map_project.target_repo_version_required` (`ConfigurationForm.jsx`,
  `MapProject.jsx`) pass an English default, so they show English in every
  language.

## Locales

| Locale | Keys | Missing | Blank | Same as English | Not in English |
|---|---:|---:|---:|---:|---:|
| es | 780 | 0 | 0 | 9 | 2 |
| pt-BR | 778 | 0 | 0 | 12 | 0 |
| zh | 778 | 0 | 0 | 5 | 0 |

- No locale is missing a key or has a blank value. The 8 keys es and zh each
  lacked, as the ticket records, were added by a0de2db
  (OpenConceptLab/oclmap#93) on 2026-10-08.
- Most values that are the same as English are names or acronyms that read the
  same (`ID`, `JSON`, `OK`, `AutoMatch`, `Token`, `Avatar`). For a translator to
  confirm: pt-BR `concept.namespace` (`Namespace`), `repo.source` and
  `map_project.source` (`Source`), and zh `common.with` (`with`, which is
  unreferenced anyway).
- es has two keys English doesn't: `common.or_go_to_your` and `concept.history`.

## The claims in the review of OpenConceptLab/oclmap#90

### "228 of 752 English keys are unused"

752 English keys is the state of the pt-BR branch from b05133c to 25e2f8a,
2026-10-02 to 2026-10-05. ca4024e then removed three keys, and the merge
(06d8841) left `main` with 771. At 25e2f8a, the audit counts 211 of the 752 as
unreferenced (460 literal, 62 dynamic, 19 string literal only).

228 can't be reproduced exactly, since the claim doesn't state its rules, and
the count depends on them. At 25e2f8a:

| Rules | Unused of 752 |
|---|---:|
| A plain regex for `t('key')` | 307 |
| …and for `i18nKey='key'` | 300 |
| Parsed: literal keys, conditionals, fallback arrays, constants | 292 |
| …and template-literal families | 212 |
| …and concatenation families (each counting all keys it matches) | 171 |
| …and string literals | 155 |
| The audit: as above, with namespace-wide families declared | 211 |

Of the first 35 keys in the claim's list, `common.a` to `common.read_more`,
the audit at 25e2f8a has 33 unreferenced. The other two are in use: column configs pass `common.action` (`Candidates.jsx`,
`Search.jsx`) and `common.created_on` (`ResultConstants.js`) to `t()` as
`labelKey`. Rules that miss keys passed that way would add the 19
string-literal-only keys to the audit's 211, giving 230, close to 228.

The ticket's "301 unmatched by a basic static regex" fits the plain regex for
`t('key')` and `i18nKey='key'` (300).

### `user.recent_activity`, `user.own_recent_activity`, `user.recent_activity_of`

The claim that all three are unused is right:

- `user.recent_activity` came in with the import from oclweb3 (5224e29,
  2025-02-06). Its only call site, in `src/components/common/Events.jsx`, went
  when c619b5e deleted that file on 2026-06-30, so it was unused from then on.
- `user.own_recent_activity` and `user.recent_activity_of` were added by
  b05133c and removed by ca4024e, both on the pt-BR branch, so neither reached
  `main`. No source file outside the catalogs ever named them
  (`git log -S'own_recent_activity' -- src` finds only those two commits).
- At 25e2f8a the audit lists all three as unreferenced; they are the only
  difference between its list there and its list on `main` today. ca4024e
  removed all three, so none exists on `main`. The later note that the last two
  were "never added" holds for `main` only.

`user.your`, the other key `Events.jsx` used, is still in every catalog and is
unreferenced.
