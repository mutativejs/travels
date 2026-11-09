import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// The source is locale-aware, so the static search export contains one index
// per language. Fumadocs' default multilingual tokenizer handles both English
// and Chinese without a language-specific configuration.
export const { staticGET: GET } = createFromSource(source);
