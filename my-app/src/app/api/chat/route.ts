import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, model, message } = await req.json();

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    const response = await openai.chat.completions.create({
      model: model || 'default',
      messages: [{ role: 'user', content: message }],
    });

    return NextResponse.json({ 
      content: response.choices[0].message.content 
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get response from model' },
      { status: 500 }
    );
  }
}
