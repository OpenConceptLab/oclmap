-- ============================================================================
-- Migration dump (replaces the inline query in README §1). Produces
-- input/projects.ndjson for migrate.mjs, with formal source canonicals resolved
-- so the migrated concept_keys match what the live app generates.
-- ============================================================================
-- Self-contained: resolves canonicals inline so it works for dry-runs and the
-- real run alike, with NO dependency on fix-algorithm-canonicals.sql having run
-- first. It resolves three things:
--   (1) target_repo.canonical_url      (migrate.mjs keys target_repo concepts on it)
--   (2) custom algo canonical_url       (ICD-11 -> formal, overriding stray variants;
--                                        recovers custom algos that would otherwise drop)
--   (3) bridge algo bridge_repo.canonical_url (from the bridge source)
-- NOTE (#2560): this migration script intentionally preserves the legacy
-- CIEL fallback for missing bridge target_repo_url values; the runtime/UI
-- cleanup in oclmap removes that hard-coded fallback separately.
--
-- Rule: ICD-11 (any variant) -> http://id.who.int/icd/release/11/mms;
--       else source's registered canonical_url (CIEL/LOINC/SNOMED-GPS);
--       else NULL -> migrate.mjs generates the ns.openconceptlab.org URL (PIH).
--
-- (fix-algorithm-canonicals.sql applies the SAME custom/bridge resolution to the
-- live `algorithms` column so re-runs in the app stay consistent with the
-- migrated data; target_repo the app fetches live.)
--
--   ocl-psql oclapi2 -t -A -f dump-projects.sql > input/projects.ndjson
-- ============================================================================
WITH resolved AS (
  SELECT DISTINCT ON (mp.id)
    mp.id, mp.name, mp.target_repo_url, mp.algorithms, mp.candidates,
    mp.organization_id, mp.user_id,
    CASE
      WHEN mp.target_repo_url ILIKE '%ICD-11%' THEN 'http://id.who.int/icd/release/11/mms'
      ELSE s.canonical_url
    END AS resolved_canonical
  FROM map_projects mp
  LEFT JOIN organizations o ON o.mnemonic = split_part(mp.target_repo_url,'/',3)
  LEFT JOIN user_profiles  u ON u.username = split_part(mp.target_repo_url,'/',3)
  LEFT JOIN sources s ON s.mnemonic = split_part(mp.target_repo_url,'/',5)
       AND s.version = 'HEAD'
       AND (s.organization_id = o.id OR s.user_id = u.id)
  WHERE mp.candidates IS NOT NULL AND mp.candidates::text NOT IN ('{}','[]','null')
  ORDER BY mp.id
)
SELECT jsonb_build_object(
  'id', id,
  'name', name,
  'target_repo_url', target_repo_url,
  'owner_url', COALESCE(
    '/orgs/'  || (SELECT mnemonic FROM organizations WHERE id = organization_id) || '/',
    '/users/' || (SELECT username FROM user_profiles WHERE id = user_id) || '/'
  ),
  'algorithms', (
    SELECT jsonb_agg(
      CASE
        -- custom: set/override canonical (ICD-11 forced to formal; others filled)
        WHEN a.elem->>'type' = 'custom' AND resolved_canonical IS NOT NULL
             AND (COALESCE(a.elem->>'canonical_url','') = '' OR target_repo_url ILIKE '%ICD-11%')
        THEN a.elem || jsonb_build_object('canonical_url', resolved_canonical)
        -- bridge: set bridge_repo.canonical_url from the bridge source when missing
        WHEN a.elem->>'type' IN ('ocl-bridge','ocl-ciel-bridge')
             AND COALESCE(a.elem->'bridge_repo'->>'canonical_url','') = ''
        THEN a.elem || jsonb_build_object('bridge_repo', jsonb_build_object('canonical_url',
               COALESCE(
                 (SELECT bs.canonical_url FROM sources bs
                  JOIN organizations bo ON bo.id = bs.organization_id
                  WHERE bs.mnemonic = split_part(COALESCE(NULLIF(a.elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/'),'/',5)
                    AND bo.mnemonic = split_part(COALESCE(NULLIF(a.elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/'),'/',3)
                    AND bs.version='HEAD'
                  LIMIT 1),
                 'https://ns.openconceptlab.org' || COALESCE(NULLIF(a.elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/')
               )))
        ELSE a.elem
      END
      ORDER BY a.ord
    )
    FROM unnest(algorithms) WITH ORDINALITY AS a(elem, ord)
  ),
  'candidates', candidates,
  'target_repo', CASE
    WHEN resolved_canonical IS NOT NULL
    THEN jsonb_build_object('canonical_url', resolved_canonical)
    ELSE NULL
  END
)::text
FROM resolved
ORDER BY id;
