import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, model } = await req.json();

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    // Use the model provided in the request
    const response = await openai.chat.completions.create({
      model: model || 'default', 
      messages: [{ role: 'user', content: 'Say "hello"' }],
      max_tokens: 5,
    });

    return NextResponse.json({ 
      success: true, 
      model: response.model 
    });
  } catch (error: any) {
    console.error('Connection test failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to the backend' },
      { status: 500 }
    );
  }
}
