import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text document is required for extraction' }, { status: 400 });
    }

    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json({ error: 'Claude API key is missing from environment variables' }, { status: 500 });
    }

    const prompt = `
You are an event extraction assistant. I am going to provide you with a raw text document (like an email, notes, or a messy draft).
Your job is to extract the details required to create an Eventbrite event and return ONLY valid JSON matching this exact structure. 

Return null for any field you absolutely cannot infer or find. DO NOT GUESS missing dates.
Return all dates/times in strict ISO 8601 format (e.g. "2026-05-30T18:00:00Z").
If timezone is not found, use "America/Edmonton" as a default.
If currency is not found, use "CAD" as a default.

Eventbrite bare minimum requirements:
- name: The event title.
- start_utc: The start date and time in UTC (ISO 8601 string).
- start_timezone: The timezone (e.g., "America/Edmonton").
- end_utc: The end date and time in UTC (ISO 8601 string).
- end_timezone: The timezone.
- currency: ISO 4217 currency code (e.g., "CAD", "USD").

Also try to extract:
- description: A detailed description of the event.
- is_online: boolean. true if online/virtual, false if at a physical venue.
- venue_details: String details of the location/address (null if online).
- ticket_type: string, either "free" or "paid" (or null if unknown).
- ticket_price: number, the price of the ticket (0 or null if free).

Format your response as a raw JSON object only. No markdown, no conversational text. Example: {"name": "Test Event", ...}

Document Text:
"""
${text}
"""
    `;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.1,
      system: "You are a helpful data extraction JSON API. Output pure JSON without markdown backticks.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let extractedData;
    try {
      const responseText = (message.content[0] as Anthropic.TextBlock).text;
      const cleanJson = responseText.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '').trim();
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse LLM response:", message.content);
      return NextResponse.json({ error: 'LLM returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: extractedData });

  } catch (error: any) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract data' },
      { status: 500 }
    );
  }
}
