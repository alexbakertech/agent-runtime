// DEPRECATED: API calls are now made directly from the client using the OpenAI SDK.
// This route is kept for reference and can be deleted after verification.
export async function POST() {
  return new Response(
    JSON.stringify({ error: 'This endpoint is deprecated. API calls are now made directly from the client.' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}
