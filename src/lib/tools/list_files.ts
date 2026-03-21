import fs from 'fs/promises';
import path from 'path';

/**
 * Tool: list_files
 * Lists files in a specified directory (scoped to the project root).
 */
export async function listFiles(args: { dirPath?: string }) {
  const rootDir = process.cwd();
  const targetDir = path.resolve(rootDir, args.dirPath || '.');

  // Security check: ensure targetDir is within rootDir
  if (!targetDir.startsWith(rootDir)) {
    throw new Error('Access denied: path is outside the project root.');
  }

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    return entries
      .filter(entry => {
        // Simple ignore list
        const ignored = ['node_modules', '.next', '.git'];
        return !ignored.includes(entry.name);
      })
      .map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      }));
  } catch (error: any) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

export const listFilesDefinition = {
  name: 'list_files',
  description: 'Lists files in a specified directory (scoped to the project root).',
  parameters: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'The directory path to list (relative to project root). Defaults to ".". ',
      },
    },
  },
};
