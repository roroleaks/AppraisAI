import { NextRequest, NextResponse } from 'next/server';
import { execute4PassAppraisalPipeline } from '@/lib/evaluators/pipeline';
import { generateDeterministicAppraisal } from '@/lib/evaluators/deterministic-appraisal';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import { LlmConfig } from '@/lib/llm/llm-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manuscript: ParsedManuscriptPayload = body?.manuscript;

    if (!manuscript || !manuscript.metadata) {
      return NextResponse.json({ error: 'Missing parsed manuscript payload' }, { status: 400 });
    }

    // Check optional custom headers for in-browser LLM keys
    const customProvider = req.headers.get('x-llm-provider') as any;
    const customKey = req.headers.get('x-llm-key');
    const customModel = req.headers.get('x-llm-model');

    const hasCustomKey = !!customKey && customKey.trim().length > 0;
    const hasEnvKey =
      !!process.env.GEMINI_API_KEY ||
      !!process.env.GROQ_API_KEY ||
      !!process.env.OPENAI_API_KEY;

    // If an API key is present (either in headers or .env.local), run the multi-pass LLM pipeline
    if (hasCustomKey || hasEnvKey) {
      try {
        const config: LlmConfig | undefined = hasCustomKey
          ? {
              provider: customProvider || 'gemini',
              apiKey: customKey,
              model: customModel || undefined,
            }
          : undefined;

        const report = await execute4PassAppraisalPipeline(manuscript, config);
        return NextResponse.json(report);
      } catch (llmErr: any) {
        console.warn('LLM evaluation encountered an issue, falling back to deterministic synthesis engine:', llmErr.message);
        // Seamless fallback to deterministic synthesis engine if API rate-limited or failed
        const fallbackReport = generateDeterministicAppraisal(manuscript);
        return NextResponse.json(fallbackReport);
      }
    }

    // Zero-friction mode: No API key configured -> Use clinical deterministic appraisal engine!
    const report = generateDeterministicAppraisal(manuscript);
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Appraisal Pipeline failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Error occurred during critical appraisal' },
      { status: 500 }
    );
  }
}
