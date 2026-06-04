/**
 * Cross-process attribution (ocl_online#105 Phase 5).
 *
 * Builds the two propagation headers the deployed middleware reads:
 *   - X-OCL-Request-Source : the typed slicer (its own discrete header so it
 *                            never depends on JSON parsing)
 *   - X-OCL-Event-Metadata : one bundled, single-line, string-valued JSON bag
 *
 * Vocabulary source of truth (lower-kebab-case values, lower-snake-case keys):
 *   ocl-online-docs/conventions/request-source-vocabulary.md
 *   ocl-online-docs/conventions/event-metadata-vocabulary.md
 *
 * The server-side parser (core/common/attribution.py, mirrored in
 * ocl-ai-assistant + ocl-analytics-api) does `json.loads` then compares
 * `event_metadata->>'<key>'` to the raw filter param — a TEXT comparison — so
 * every SCALAR value MUST be a JSON string ("row_index":"141", not 141).
 * `row_indices` is the single exception: a JSON array of ints (a non-indexed
 * consumer hint that maps a batched backend call to the rows it covered).
 */

export const REQUEST_SOURCE = {
  AUTOMATCH: 'automatch',
  MANUAL: 'mapper-ui-manual',
}

export const REQUEST_SOURCE_HEADER = 'X-OCL-Request-Source'
export const EVENT_METADATA_HEADER = 'X-OCL-Event-Metadata'

const isPresent = value =>
  value !== null && value !== undefined && !(typeof value === 'number' && Number.isNaN(value))

/**
 * Build the attribution request headers for a single backend call.
 *
 * Manual (non-run) callers pass no `runId`, which yields
 * `request_source=mapper-ui-manual` and omits `automatch_run_id` — the same
 * call sites are reused outside an auto-match run (panel open, single rerun).
 *
 * @param {object}              [opts]
 * @param {number|string|null}  [opts.runId]         automatch_run_id (omitted when absent)
 * @param {number|string|null}  [opts.projectId]     map_project_id
 * @param {number|null}         [opts.rowIndex]      scalar row index (batch=1)
 * @param {number[]|null}       [opts.rowIndices]    rows covered by a batched call (batch>1)
 * @param {number|null}         [opts.batchSize]     backend-call batch size (batch>1)
 * @param {string|null}         [opts.algorithmId]   algorithm_id (semantic / bridge / reranker / …)
 * @param {number|null}         [opts.clientAttemptN] retry attempt number, 1-based
 * @param {string|null}         [opts.source]        explicit request_source override
 * @returns {Object<string,string>} the two headers
 */
export const buildAttributionHeaders = ({
  runId = null,
  projectId = null,
  rowIndex = null,
  rowIndices = null,
  batchSize = null,
  algorithmId = null,
  clientAttemptN = null,
  source = null,
} = {}) => {
  const requestSource = source || (isPresent(runId) ? REQUEST_SOURCE.AUTOMATCH : REQUEST_SOURCE.MANUAL)

  const meta = {}
  if(isPresent(runId)) meta.automatch_run_id = String(runId)
  if(isPresent(projectId)) meta.map_project_id = String(projectId)

  // batch>1 carries the int array + size and NULLs the scalar row_index; batch=1
  // carries the scalar. Never both (event-metadata-vocabulary.md, OQ4).
  if(Array.isArray(rowIndices) && rowIndices.length > 1) {
    meta.row_indices = rowIndices.map(Number)
    meta.batch_size = String(batchSize || rowIndices.length)
  } else if(isPresent(rowIndex)) {
    meta.row_index = String(rowIndex)
  } else if(Array.isArray(rowIndices) && rowIndices.length === 1) {
    meta.row_index = String(rowIndices[0])
  }

  if(isPresent(algorithmId)) meta.algorithm_id = String(algorithmId)
  if(isPresent(clientAttemptN)) meta.client_attempt_n = String(clientAttemptN)

  return {
    [REQUEST_SOURCE_HEADER]: requestSource,
    [EVENT_METADATA_HEADER]: JSON.stringify(meta),
  }
}

const isFunction = value => typeof value === 'function'

/**
 * Assemble the JSON-safe project config captured at run start
 * (AutomatchRun.config_snapshot). Strips function-valued algorithm fields
 * (e.g. getIcon) so the POST body serializes cleanly.
 *
 * @param {object}        [opts]
 * @param {object[]}      [opts.selectedAlgos] algorithms selected for the run
 * @param {string|null}   [opts.encoderModel]  reranker encoder model
 * @param {object|null}   [opts.scoreConfig]   {recommended, available} thresholds
 * @param {object|null}   [opts.filters]       active match filters
 * @param {object|null}   [opts.template]      prompt-template ref (AI runs only)
 * @param {object|string|null} [opts.aiModel]  selected AI model (AI runs only)
 */
export const buildConfigSnapshot = ({
  selectedAlgos = [],
  encoderModel = null,
  scoreConfig = null,
  filters = null,
  template = null,
  aiModel = null,
} = {}) => ({
  algorithms: (selectedAlgos || []).map(algo => {
    const clean = {}
    Object.keys(algo || {}).forEach(key => {
      if(!isFunction(algo[key])) clean[key] = algo[key]
    })
    return clean
  }),
  encoder: encoderModel || null,
  score_config: scoreConfig || null,
  filters: filters || null,
  template: template || null,
  ai_model: aiModel || null,
})
