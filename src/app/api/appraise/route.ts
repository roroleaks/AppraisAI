import { NextRequest, NextResponse } from 'next/server';
import { execute4PassAppraisalPipeline } from '@/lib/evaluators/pipeline';
import { generateDeterministicAppraisal } from '@/lib/evaluators/deterministic-appraisal';
import { ParsedManuscriptPayload } from '@/lib/schemas/ingestion.schema';
import { LlmConfig } from '@/lib/llm/llm-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Strips API keys, prompt leakage, and internal secrets from error messages (P5-4).
 */
function sanitizeErrorMessage(msg: string | undefined): string {
  if (!msg) return 'An unexpected error occurred during critical appraisal';
  return msg
    .replace(/(?:AIza[0-9A-Za-z-_]{35}|gsk_[0-9A-Za-z]{40,}|sk-[0-9A-Za-z-_]{20,})/gi, '[REDACTED_API_KEY]')
    .replace(/bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:key|token|password)=[^&\s]+/gi, 'secret=[REDACTED]')
    .replace(/at\s+(?:(?!\bat\b).)*:\d+:\d+/g, '') // strip stack trace frames
    .trim();
}

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

    const wantsStream =
      req.headers.get('accept') === 'text/event-stream' ||
      req.nextUrl.searchParams.get('stream') === 'true';

    // Real SSE streaming mode (P1-11)
    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            if (hasCustomKey || hasEnvKey) {
              try {
                const config: LlmConfig | undefined = hasCustomKey
                  ? {
                      provider: customProvider || 'gemini',
                      apiKey: customKey,
                      model: customModel || undefined,
                    }
                  : undefined;

                const onProgress = (stage: number, stageName: string, detail: string) => {
                  sendEvent('progress', { stage, stageName, detail });
                };

                const report = await execute4PassAppraisalPipeline(manuscript, config, onProgress);
                report.engineUsed = 'llm';
                const activeProv =
                  config?.provider ||
                  (process.env.GEMINI_API_KEY ? 'gemini' : process.env.GROQ_API_KEY ? 'groq' : 'openai');
                report.llmDetails = {
                  provider: activeProv,
                  model:
                    config?.model ||
                    (activeProv === 'openai'
                      ? 'gpt-4o-mini'
                      : activeProv === 'groq'
                      ? 'llama-3.3-70b-versatile'
                      : 'gemini-2.5-flash'),
                };
                sendEvent('result', report);
                controller.close();
                return;
              } catch (llmErr: any) {
                console.warn(
                  'LLM evaluation encountered an issue, falling back to deterministic synthesis engine:',
                  llmErr.message
                );
                sendEvent('progress', {
                  stage: 2,
                  stageName: 'Fallback',
                  detail: 'Switching to heuristic screening draft...',
                });
                const fallbackReport = generateDeterministicAppraisal(manuscript);
                fallbackReport.engineUsed = 'deterministic-fallback';
                fallbackReport.fallbackReason = sanitizeErrorMessage(llmErr?.message);
                sendEvent('result', fallbackReport);
                controller.close();
                return;
              }
            }

            // Zero-friction mode: Deterministic engine
            sendEvent('progress', {
              stage: 1,
              stageName: 'Heuristic Extraction',
              detail: 'Extracting evidence and study parameters...',
            });
            const report = generateDeterministicAppraisal(manuscript);
            report.engineUsed = 'deterministic';
            sendEvent('result', report);
            controller.close();
          } catch (streamErr: any) {
            sendEvent('error', { error: sanitizeErrorMessage(streamErr?.message) });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Standard JSON mode (for CLI, test suites, or non-streaming clients)
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
        report.engineUsed = 'llm';
        const activeProv = config?.provider || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.GROQ_API_KEY ? 'groq' : 'openai');
        report.llmDetails = {
          provider: activeProv,
          model: config?.model || (activeProv === 'openai' ? 'gpt-4o-mini' : activeProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash'),
        };
        return NextResponse.json(report);
      } catch (llmErr: any) {
        console.warn('LLM evaluation encountered an issue, falling back to deterministic synthesis engine:', llmErr.message);
        const fallbackReport = generateDeterministicAppraisal(manuscript);
        fallbackReport.engineUsed = 'deterministic-fallback';
        fallbackReport.fallbackReason = sanitizeErrorMessage(llmErr?.message);
        return NextResponse.json(fallbackReport);
      }
    }

    const report = generateDeterministicAppraisal(manuscript);
    report.engineUsed = 'deterministic';
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Appraisal Pipeline failed:', err);
    return NextResponse.json(
      { error: sanitizeErrorMessage(err?.message) },
      { status: 500 }
    );
  }
}
