import { getTime, getTimeDefinition } from './get_time';
import { listFiles, listFilesDefinition } from './list_files';
import { readFile, readFileDefinition } from './read_file';
import { searchText, searchTextDefinition } from './search_text';

export const tools = {
  get_time: {
    execute: getTime,
    definition: getTimeDefinition,
  },
  list_files: {
    execute: listFiles,
    definition: listFilesDefinition,
  },
  read_file: {
    execute: readFile,
    definition: readFileDefinition,
  },
  search_text: {
    execute: searchText,
    definition: searchTextDefinition,
  },
};

export const toolDefinitions = Object.values(tools).map(tool => tool.definition);

export type ToolName = keyof typeof tools;

export async function executeTool(name: ToolName, args: any) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return await tool.execute(args);
}
