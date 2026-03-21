import fs from 'fs/promises';
import { resolveSandboxPath } from './sandbox-utils';

/**
 * Tool: read_file
 * Reads and returns the content of a specified file.
 */
export async function readFile(args: { filePath: string }) {
  const targetPath = await resolveSandboxPath(args.filePath);

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
