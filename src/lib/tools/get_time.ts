/**
 * Tool: get_time
 * Returns the current system time.
 */
export async function getTime() {
  return new Date().toISOString();
}
