import { executeTool, ToolName } from '@/lib/tools';

export async function POST(req: Request) {
  try {
    const { toolName, args } = await req.json();

    if (!toolName) {
      return new Response(JSON.stringify({ error: 'Tool name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await executeTool(toolName as ToolName, args);

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Tool execution error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to execute tool' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
