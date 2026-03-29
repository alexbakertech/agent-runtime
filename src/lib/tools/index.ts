/**
 * Tools Module - Built-in Tool Definitions
 * 
 * Provides definitions for built-in tools used by the agent:
 * - get_time: Returns current system time
 * - list_files: Lists files in sandbox directory
 * - read_file: Reads file content from sandbox
 * - search_text: Searches for text in sandbox files
 */

export {
  getTimeDefinition,
  listFilesDefinition,
  readFileDefinition,
  searchTextDefinition,
  toolDefinitions,
} from './definitions';

export type { ToolName } from './definitions';
