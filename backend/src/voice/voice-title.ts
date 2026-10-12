import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5.4-mini';

let client: OpenAI | null = null;

/** Asks OpenAI what the expense in a spoken sentence should be called; null when it can't, so the caller keeps its own title. */
export async function readExpenseTitle(transcript: string, categoryName: string | null): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  client ??= new OpenAI();

  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        max_completion_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'expense_title',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['title'],
              properties: { title: { type: 'string' } },
            },
          },
        },
        messages: [
          {
            role: 'user',
            content: `A user dictated an expense to add in an expense tracker. The sentence may be English, Urdu, Roman Urdu or a mix, and comes from speech recognition so it can contain mistakes.

Sentence: "${transcript}"
Category: ${categoryName ?? 'unknown'}

Return title: only the name of the thing that was bought or paid for, in Title Case, under 60 characters, e.g. "Dell Battery". Leave out the category, the amount, the date and instruction words like "add", "expense", "name", "likh do", "kar do". If the sentence names nothing, return an empty string.`,
          },
        ],
      },
      { timeout: 8000 },
    );
    const content = completion.choices[0]?.message.content;
    if (!content) return null;
    const title = (JSON.parse(content) as { title: string }).title.trim().slice(0, 200);
    return title || null;
  } catch {
    return null;
  }
}
