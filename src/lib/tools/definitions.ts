export const getTimeDefinition = {
  name: 'get_time',
  description: 'Returns the current system time.',
  parameters: {
    type: 'object',
    properties: {},
  },
};

export const listFilesDefinition = {
  name: 'list_files',
  description: 'Lists files in the sandbox directory.',
  parameters: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'The directory path to list (relative to sandbox root). Defaults to ".". ',
      },
    },
  },
};

export const readFileDefinition = {
  name: 'read_file',
  description: 'Reads and returns the content of a file in the sandbox.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The file path to read (relative to sandbox root).',
      },
    },
    required: ['filePath'],
  },
};

export const searchTextDefinition = {
  name: 'search_text',
  description: 'Searches for a regular expression pattern within sandbox file contents.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for.',
      },
      dirPath: {
        type: 'string',
        description: 'The directory to search within (relative to sandbox root). Defaults to ".". ',
      },
    },
    required: ['pattern'],
  },
};

export const toolDefinitions = [
  getTimeDefinition,
  listFilesDefinition,
  readFileDefinition,
  searchTextDefinition,
];

export type ToolName = 'get_time' | 'list_files' | 'read_file' | 'search_text';
