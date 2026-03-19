import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey } = await req.json();

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    const response = await openai.models.list();

    return NextResponse.json({ 
      success: true, 
      models: response.data 
    });
  } catch (error: any) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
