import { getTime } from './get_time';
import { listFiles } from './list_files';
import { readFile } from './read_file';
import { searchText } from './search_text';
import {
  getTimeDefinition,
  listFilesDefinition,
  readFileDefinition,
  searchTextDefinition,
  toolDefinitions as _toolDefinitions,
  ToolName
} from './definitions';

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

export const toolDefinitions = _toolDefinitions;

export async function executeTool(name: ToolName, args: any) {
  // @ts-ignore
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return await tool.execute(args);
}
