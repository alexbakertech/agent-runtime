/**
 * Tool: get_time
 * Returns the current system time.
 */
export async function getTime() {
  return new Date().toISOString();
}

export const getTimeDefinition = {
  name: 'get_time',
  description: 'Returns the current system time.',
  parameters: {
    type: 'object',
    properties: {},
  },
};
