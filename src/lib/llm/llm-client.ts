import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type LlmProvider = 'gemini' | 'groq' | 'openai';

export interface LlmConfig {
  provider: LlmProvider;
  apiKey?: string;
  model?: string;
}

export class LlmValidationError extends Error {
  public issues: z.ZodIssue[];
  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'LlmValidationError';
    this.issues = issues;
  }
}

/**
 * Extracts and cleans raw JSON from markdown fenced code blocks (```json ... ```) or plain text
 * using a balanced-brace scanner that respects string literals and escape characters.
 */
export function extractCleanJson(rawText: string): string {
  let cleaned = rawText.trim();

  // If wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  let startIdx = -1;
  let openChar = '{';
  let closeChar = '}';

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{' || cleaned[i] === '[') {
      startIdx = i;
      openChar = cleaned[i];
      closeChar = openChar === '{' ? '}' : ']';
      break;
    }
  }

  if (startIdx === -1) {
    return cleaned;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === openChar) {
        depth++;
      } else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return cleaned.substring(startIdx, i + 1);
        }
      }
    }
  }

  return cleaned.substring(startIdx);
}

/**
 * Executes a network fetch with timeout (default 60s) and exponential backoff retry on 429/5xx.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit,
  timeoutMs = 60000,
  maxRetries = 1
): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if ((res.status === 429 || res.status >= 500) && attempt <= maxRetries) {
        console.warn(`LLM request status ${res.status}. Retrying (attempt ${attempt} of ${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt <= maxRetries) {
        console.warn(`LLM request error (${err?.message || 'timeout'}). Retrying (attempt ${attempt} of ${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Parses raw Gemini response JSON payload extracting candidate parts text (P0-2, Regression #7).
 */
export function parseGeminiCandidateText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
}

/**
 * Raw provider invocation helper.
 */
async function callLlmProvider(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.1
): Promise<string> {
  if (provider === 'gemini') {
    // P0-2: Send key via x-goog-api-key header; do not expose key in URL query string
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const res = await fetchWithTimeoutAndRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nIMPORTANT: You must return ONLY raw, valid JSON conforming to the requested schema. No markdown formatting, conversational commentary, or trailing text.\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    return parseGeminiCandidateText(data);
  } else if (provider === 'groq') {
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    const res = await fetchWithTimeoutAndRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nOutput ONLY valid JSON.` },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } else if (provider === 'openai') {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const res = await fetchWithTimeoutAndRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nOutput ONLY valid JSON.` },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

/**
 * Executes a structured LLM request against Gemini, Groq, or OpenAI
 * and parses/validates against a provided Zod schema with JSON schema prompt inclusion
 * and one repair retry cycle.
 */
export async function executeStructuredLlmCall<T = any>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T, any, any>;
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

  // P0-2: Default OpenAI model is gpt-4o-mini
  const model =
    params.config?.model ||
    (provider === 'gemini'
      ? 'gemini-2.5-flash'
      : provider === 'groq'
      ? 'llama-3.3-70b-versatile'
      : 'gpt-4o-mini');

  // P0-2: Append JSON Schema to the prompt
  const jsonSchema = zodToJsonSchema(params.schema as any, 'targetSchema');
  const augmentedUserPrompt = `${params.userPrompt}\n\nREQUIRED OUTPUT JSON SCHEMA:\n${JSON.stringify(
    jsonSchema,
    null,
    2
  )}\n\nReturn ONLY raw JSON conforming to this schema.`;

  const rawResponseText = await callLlmProvider(
    provider,
    apiKey,
    model,
    params.systemPrompt,
    augmentedUserPrompt,
    params.temperature ?? 0.1
  );

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
    console.warn(`Initial LLM response from ${provider} failed Zod schema validation. Initiating repair retry...`);

    const repairPrompt = `The previous JSON response failed strict schema validation.\n\nVALIDATION ERRORS:\n${JSON.stringify(
      validationResult.error.issues,
      null,
      2
    )}\n\nPREVIOUS RAW JSON:\n${cleanedJson}\n\nFix all validation errors and return ONLY the corrected, strictly valid JSON conforming to the schema.`;

    const repairedRawText = await callLlmProvider(
      provider,
      apiKey,
      model,
      params.systemPrompt,
      repairPrompt,
      0.0
    );

    const repairedCleaned = extractCleanJson(repairedRawText);
    let repairedParsed: any;
    try {
      repairedParsed = JSON.parse(repairedCleaned);
    } catch (parseErr: any) {
      throw new LlmValidationError(
        `Repair attempt failed to output valid JSON: ${parseErr.message}`,
        validationResult.error.issues
      );
    }

    const secondValidation = params.schema.safeParse(repairedParsed);
    if (!secondValidation.success) {
      throw new LlmValidationError(
        `LLM response failed schema validation after repair attempt`,
        secondValidation.error.issues
      );
    }

    return secondValidation.data;
  }

  return validationResult.data;
}
