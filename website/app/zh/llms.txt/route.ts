import { docsLlmIndex } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  return new Response(docsLlmIndex('zh'));
}
