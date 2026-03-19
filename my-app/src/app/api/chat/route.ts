import { OpenAI } from 'openai';

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, model, message } = await req.json();

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    const stream = await openai.chat.completions.create({
      model: model || 'default',
      messages: [{ role: 'user', content: message }],
      stream: true,
    });

    // Create a ReadableStream to pipe the response
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get stream from model' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
