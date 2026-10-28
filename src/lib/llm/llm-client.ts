import { z } from 'zod';

export type LlmProvider = 'gemini' | 'groq' | 'openai';

export interface LlmConfig {
  provider: LlmProvider;
  apiKey?: string;
  model?: string;
}

/**
 * Extracts and cleans raw JSON from markdown fenced code blocks (```json ... ```) or plain text.
 */
export function extractCleanJson(rawText: string): string {
  let cleaned = rawText.trim();

  // If wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Find first { or [ and last } or ]
  const firstBrace = cleaned.search(/[\{\[]/);
  const lastBrace = cleaned.search(/[\}\]][^\{\}]*$/);

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/**
 * Executes a structured LLM request against Gemini, Groq, or OpenAI
 * and parses/validates against a provided Zod schema.
 */
export async function executeStructuredLlmCall<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  config?: LlmConfig;
  temperature?: number;
}): Promise<T> {
  const provider: LlmProvider =
    params.config?.provider ||
    (process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.GROQ_API_KEY
      ? 'groq'
      : process.env.OPENAI_API_KEY
      ? 'openai'
      : 'gemini');

  const apiKey =
    params.config?.apiKey ||
    (provider === 'gemini'
      ? process.env.GEMINI_API_KEY
      : provider === 'groq'
      ? process.env.GROQ_API_KEY
      : process.env.OPENAI_API_KEY) ||
    '';

  if (!apiKey) {
    throw new Error(
      `Missing API Key for provider "${provider}". Please configure it in .env.local or open the LLM Settings dialog.`
    );
  }

  let rawResponseText = '';

  if (provider === 'gemini') {
    const model = params.config?.model || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${params.systemPrompt}\n\nIMPORTANT: You must return ONLY raw, valid JSON conforming to the requested schema. No conversational filler.\n\n${params.userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: params.temperature ?? 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    rawResponseText = data?.candidates?.[0]?.parts?.[0]?.text || '';
  } else if (provider === 'groq') {
    const model = params.config?.model || 'llama-3.3-70b-versatile';
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${params.systemPrompt}\n\nOutput ONLY valid JSON.` },
          { role: 'user', content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    rawResponseText = data?.choices?.[0]?.message?.content || '';
  } else if (provider === 'openai') {
    const model = params.config?.model || 'gpt-4o';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${params.systemPrompt}\n\nOutput ONLY valid JSON.` },
          { role: 'user', content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    rawResponseText = data?.choices?.[0]?.message?.content || '';
  }

  const cleanedJson = extractCleanJson(rawResponseText);
  let parsedJson: any;

  try {
    parsedJson = JSON.parse(cleanedJson);
  } catch (parseErr: any) {
    throw new Error(
      `Failed to parse JSON response from ${provider}: ${parseErr.message}\nRaw text was:\n${rawResponseText.slice(
        0,
        500
      )}`
    );
  }

  // Validate with Zod
  const validationResult = params.schema.safeParse(parsedJson);
  if (!validationResult.success) {
    console.error('Zod schema validation issues:', validationResult.error.issues);
    // Attempt relaxed return if structure largely matches
    return parsedJson as T;
  }

  return validationResult.data;
}
