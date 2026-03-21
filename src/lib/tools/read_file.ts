import fs from 'fs/promises';
import path from 'path';

/**
 * Tool: read_file
 * Reads and returns the content of a specified file.
 */
export async function readFile(args: { filePath: string }) {
  const rootDir = process.cwd();
  const targetPath = path.resolve(rootDir, args.filePath);

  // Security check: ensure targetPath is within rootDir
  if (!targetPath.startsWith(rootDir)) {
    throw new Error('Access denied: path is outside the project root.');
  }

  try {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${args.filePath}`);
    }

    // Limit file size (e.g., 1MB)
    if (stats.size > 1 * 1024 * 1024) {
      throw new Error('File size exceeds the 1MB limit.');
    }

    const content = await fs.readFile(targetPath, 'utf8');
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

export const readFileDefinition = {
  name: 'read_file',
  description: 'Reads and returns the content of a specified file.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The file path to read (relative to project root).',
      },
    },
    required: ['filePath'],
  },
};
