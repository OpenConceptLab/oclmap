# i18n key audit

`npm run i18n:audit` reports which English keys in
`src/i18n/locales/en/translations.json` the Mapper's source uses, and how each
other locale compares with English (OpenConceptLab/ocl_issues#2880).

- [`report.md`](report.md) is its output for this tree.
- [`findings.md`](findings.md) is the review done with it in October 2026:
  the manual check of the unreferenced keys, and the claims it was asked to
  assess.
- [`families.json`](families.json) declares the keys some dynamic call sites
  can produce (see [Namespace-wide families](#namespace-wide-families)).
- The logic is in `src/i18n/audit.js`, tested by `src/i18n/__tests__/audit.test.js`;
  [`audit.mjs`](audit.mjs) reads the files and prints the report.

## Run it

```bash
npm run i18n:audit                                         # print the report
npm run i18n:audit -- --out scripts/i18n-audit/report.md   # refresh report.md
npm run i18n:audit -- --root <checkout>                    # audit another tree, e.g. an older commit
```

The same tree always gives the same report: it has no dates or absolute paths,
and every list in it is sorted. To check that `report.md` is current, refresh
it and run `git diff --exit-code scripts/i18n-audit/report.md`.

## What counts as a reference

The audit parses every `.js` and `.jsx` file under `src/`, except those in
`__tests__/` and `__integration__/`, with Babel. It reads the key argument of
every call to `t` or `<anything>.t` (`t()`, `i18n.t()`, `this.props.t()`), and
every `i18nKey` attribute. For each it works out the keys it can produce:

| Key expression | Counts as |
|---|---|
| `'common.save'`, or a template literal without a placeholder | that key |
| `cond ? 'a.x' : 'a.y'`, `custom \|\| 'a.x'` | each branch |
| `['a.x', 'a.y']` (i18next fallback keys) | each element |
| a variable assigned once (`const key = …`) | its value, worked out the same way |
| `` `map_project.preview_limit_title_${kind}` ``, `'map_project.view_' + state` | a dynamic key family: every key the pattern (`map_project.view_*`) matches |
| a parameter, a property, a function call | a call site the audit can't read |

A string literal anywhere in the scanned source that equals a key counts as
well. That covers keys stored in config and passed to `t()` later, such as
the column definitions in `ResultConstants.js` (`labelKey: 'common.id'`) that
`TableResults.jsx` passes to `t(headCell.labelKey)`.

Each English key goes in the first of these groups that fits: referenced by a
literal key, matched only by a dynamic key family, mentioned only as a string
literal, or unreferenced.

### Namespace-wide families

A family whose whole key after the namespace is dynamic, such as
`'map_project.' + id`, matches every key in that namespace, so on its own it
would hide every unused `map_project` key. `families.json` declares the keys
such a call site can produce, worked out by reading the code, with the evidence:

```json
{
  "file": "src/components/map-projects/ScoreBucketButton.jsx",
  "expression": "'map_project.' + id",
  "keys": ["map_project.recommended", "map_project.available", "map_project.low_ranked"],
  "evidence": "ScoreBucketButton renders BucketButton with id recommended, available and low_ranked."
}
```

`expression` is the key argument's source text with its whitespace collapsed,
as the report shows it; the declaration covers every call in `file` with that
text. A narrower family can be declared the same way to tighten it.

The report's *Needs attention* section lists:

- a namespace-wide family with no declaration (every key it matches then
  counts as used);
- a declared key the expression can't produce, or the catalog lacks;
- a declaration whose call site has gone;
- a literal key the English catalog lacks (i18next shows the raw key, unless
  the call passes a default).

## Locales

Every directory under `src/i18n/locales/` is compared with English, key by key:

| | Means |
|---|---|
| Missing | Not in the locale; i18next falls back to English. |
| Blank | Empty or only whitespace; i18next shows the blank, so the text disappears. |
| Same as English | Untranslated, or right as it is (`ID`, `JSON`, `OK`); needs a translator to tell. |
| Not in English | Only this locale has it: a leftover, or a key English lacks. |

## Limits of static detection

The audit can count a key as used when it isn't, and the opposite in the cases
below. Check a key by hand before removing it.

- A translation function under another name (`const { t: translate } = …`),
  or reached through a computed property (`i18n['t']`), isn't read. Today every
  call is `t()` or `this.props.t()`.
- A key built outside the call (`const key = 'map_project.' + id; t(key)`)
  is read only when it's a variable in scope that's assigned once; a key built
  in another function and passed in is a call site the audit can't read.
- A pattern matches by text, so `map_project.decision_*` covers
  `map_project.decision_tab_*` too. An undeclared family can only over-count,
  so a key it matches may still be unused.
- A declaration is only as good as its evidence. The audit notices when a
  call site's text changes, not when the code that feeds it values does.
- A string literal that equals a key counts even if it's never translated, or
  sits in config the Mapper never shows: `ResultConstants.js` has columns for
  users, orgs and repos, but the Mapper only lists concepts.
- Code that never runs still counts, such as `ConceptHeader.jsx`'s
  `false && …` block, which calls `t('common.actions')`.
- Plural and context suffixes (`key_one`, `key_other`, `key_male`) aren't
  derived from `t(key, {count})`, and i18next nesting (`$t(other.key)` in a
  value) isn't followed. The catalogs use neither today.
- A `<Trans>` without `i18nKey` uses its children as the key; the audit lists
  it as a call site it can't read. There are none today.

## Removing keys

The unreferenced list is a list of candidates. Check each key by hand: search
the source for its last segment, and look at the history of the code that last
used it (`git log -S'<key>' -- src`). Then remove keys from every locale at once,
in a separate, reviewed change.
