import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// OpenConceptLab/ocl_online#309: the Mapper calls its assistant the "OCL AI
// Assistant", never a bare "AI Assistant", and never says "AI
// recommendations". Each catalog has its own form of the full name.
const LOCALES = {
  en: { name: 'OCL AI Assistant', banned: [] },
  es: {
    name: 'asistente de IA de OCL',
    banned: [/(?<!OCL )asistente de IA(?! de OCL)/i, /recomendaci(?:ón|ones)(?: de mapeo)? (?:de|con) IA\b/i],
  },
  'pt-BR': {
    name: 'Assistente de IA do OCL',
    banned: [/assistente de IA(?! do OCL)/i, /recomendaç(?:ão|ões)(?: de mapeamento)? (?:de|com) IA\b/i],
  },
  // zh's recommendation strings are checked by key, below: 推荐 alone is
  // "recommended", as in the Recommended score bucket.
  zh: { name: 'OCL AI 助手', banned: [/(?<!OCL )AI 助手/, /智能助手/] },
}

// Untranslated English is caught in every catalog.
const BANNED_EVERYWHERE = [/(?<!OCL )AI Assistant/i, /\bAI (?:mapping )?recommendations?\b/i]

// map_project strings about the assistant or its recommendations.
const NAMES_THE_ASSISTANT = [
  'input_language_helper',
  'ai_assistant',
  'preview_quota_ai_calls',
  'preview_limit_title_ai_assistant',
  'preview_limit_body_ai_assistant',
  'preview_limit_body_ai_assistant_no_count',
  'column_send_to_ai_assistant',
  'ai_prompt_template_description',
  'set_ai_assistant_output_language',
  'ai_recommendation_failed_retry',
  'ai_recommendation_running',
  'auto_match_ai_label',
  'auto_match_ai_description',
  'auto_match_blocked_no_algorithms_ai_v2',
  'auto_match_blocked_no_step_ai_v2',
  // OpenConceptLab/ocl_issues#2908
  'ai_pick',
  'ai_alternate',
  'ai_disagrees',
  'ai_disagrees_help',
  'ai_pick_rank',
  'ai_pick_unscored',
  'ai_pick_not_candidate_help',
  'ai_summary_recommend',
  'ai_summary_conditional',
  'ai_summary_no_pick',
  'ai_summary_reject',
  'ai_summary_insufficient',
  'auto_match_no_proposal_reject',
  'auto_match_no_proposal_insufficient',
  'auto_match_no_proposal_pick_not_candidate',
]

const load = locale =>
  JSON.parse(readFileSync(new URL(`../locales/${locale}/translations.json`, import.meta.url), 'utf8'))

const strings = (node, path = []) => typeof node === 'string' ?
  [[path.join('.'), node]] :
  Object.entries(node).flatMap(([key, value]) => strings(value, [...path, key]))

for (const [locale, { name, banned }] of Object.entries(LOCALES)) {
  test(`${locale}: no bare assistant name or "AI recommendations"`, () => {
    const patterns = [...BANNED_EVERYWHERE, ...banned]
    const offenders = strings(load(locale))
      .filter(([, value]) => patterns.some(pattern => pattern.test(value)))
      .map(([key]) => key)
    assert.deepEqual(offenders, [])
  })

  test(`${locale}: the strings about the assistant name it in full`, () => {
    const catalog = load(locale).map_project
    const missing = NAMES_THE_ASSISTANT.filter(key => !catalog[key]?.toLowerCase().includes(name.toLowerCase()))
    assert.deepEqual(missing, [])
  })
}
