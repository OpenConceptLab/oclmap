export const DEFAULT_ENCODER_MODEL = 'BAAI/bge-reranker-v2-m3'

export const ENCODER_MODEL_OPTIONS = [
  {
    id: DEFAULT_ENCODER_MODEL,
    description: 'Multilingual, general-purpose (0.6B)',
    default: true
  },
  {
    id: 'Qwen/Qwen3-Reranker-0.6B',
    description: 'General purpose reranker (0.6B)',
  },
  {
    id: 'Qwen/Qwen3-Reranker-4B',
    description: 'General purpose reranker, best in quality (4B)',
    disabled: true
  },
  {
    id: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    description: 'Fast and lightweight, English-only (23M)',
  },
  {
    id: 'ncbi/MedCPT-Cross-Encoder',
    description: 'Biomedical domain, trained on PubMed (110M)',
  },
  {
    id: 'Alibaba-NLP/gte-reranker-modernbert-base',
    description: 'Balanced quality, supports longer descriptions (149M)',
  },
]

export const CUSTOM_ENCODER_MODEL_OPTION = '__custom_encoder_model__'
