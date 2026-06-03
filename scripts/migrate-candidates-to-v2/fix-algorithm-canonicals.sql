-- ============================================================================
-- PROD PRE-STEP (run BEFORE the v1->v2 candidates migration): canonical fix
-- ============================================================================
-- Sets the formal canonical_url on map_projects.algorithms so BOTH the live app
-- and the migration produce identical, formal concept_keys. Without this, custom
-- ICD-11 algos drop entirely (no identity) and LOINC/CIEL/ICD-11 concepts split
-- between the formal canonical and a generated ns.openconceptlab.org URL.
--
-- Rules (per @paynejd 2026-06-02):
--   * ICD-11 (any variant, incl. ICD-11-WHO-Agent) -> http://id.who.int/icd/release/11/mms
--   * else -> the target/bridge source's registered canonical_url (CIEL, LOINC, SNOMED-GPS)
--   * else (no registered canonical, e.g. PIH) -> leave unset -> app/migration generate ns URL
--
-- WHY this is needed (not just the migration dump): the live app reads custom
-- algo canonical from algorithms[].canonical_url and bridge canonical from
-- algorithms[].bridge_repo.canonical_url (it does NOT fetch the bridge source).
-- target_repo, by contrast, the app fetches live, so the migration dump resolves
-- that one (see dump-projects.sql) and no config change is needed for it.
--
-- Validated read-only against prod 2026-06-02: 51 custom algos -> formal,
-- bridge -> CIELterminology.org, built-in types untouched.
--
-- SAFETY: single transaction; idempotent (re-running is a no-op on already-fixed
-- algos). Take the standard map_projects backup first. Apply with:
--   ocl-psql oclapi2 --rw -f fix-algorithm-canonicals.sql
-- ============================================================================
BEGIN;

UPDATE map_projects mp
SET algorithms = (
  SELECT array_agg(
    CASE
      -- custom algos: force ICD-11 to formal (overrides stray '/icd11/mms');
      -- fill others from the project target source canonical.
      WHEN elem->>'type' = 'custom' AND r.resolved IS NOT NULL
           AND (COALESCE(elem->>'canonical_url','') = '' OR mp.target_repo_url ILIKE '%ICD-11%')
      THEN elem || jsonb_build_object('canonical_url', r.resolved)
      -- bridge algos: set bridge_repo.canonical_url from the bridge source when absent.
      WHEN elem->>'type' IN ('ocl-bridge','ocl-ciel-bridge')
           AND COALESCE(elem->'bridge_repo'->>'canonical_url','') = ''
      THEN elem || jsonb_build_object('bridge_repo', jsonb_build_object('canonical_url',
             COALESCE(
               (SELECT bs.canonical_url FROM sources bs
                  JOIN organizations bo ON bo.id = bs.organization_id
                 WHERE bs.mnemonic = split_part(COALESCE(NULLIF(elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/'),'/',5)
                   AND bo.mnemonic = split_part(COALESCE(NULLIF(elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/'),'/',3)
                   AND bs.version='HEAD' LIMIT 1),
               'https://ns.openconceptlab.org' || COALESCE(NULLIF(elem->>'target_repo_url',''),'/orgs/CIEL/sources/CIEL/')
             )))
      ELSE elem
    END ORDER BY ord
  )
  FROM unnest(mp.algorithms) WITH ORDINALITY AS t(elem, ord)
)
FROM (
  SELECT mp2.id,
    CASE WHEN mp2.target_repo_url ILIKE '%ICD-11%'
         THEN 'http://id.who.int/icd/release/11/mms'
         ELSE s.canonical_url END AS resolved
  FROM map_projects mp2
  LEFT JOIN organizations o ON o.mnemonic = split_part(mp2.target_repo_url,'/',3)
  LEFT JOIN sources s ON s.mnemonic = split_part(mp2.target_repo_url,'/',5)
       AND s.version='HEAD' AND s.organization_id = o.id
) r
WHERE mp.id = r.id
  AND EXISTS (
    SELECT 1 FROM unnest(mp.algorithms) e
    WHERE e->>'type'='custom'
       OR (e->>'type' IN ('ocl-bridge','ocl-ciel-bridge')
           AND COALESCE(e->'bridge_repo'->>'canonical_url','')='')
  );

COMMIT;
