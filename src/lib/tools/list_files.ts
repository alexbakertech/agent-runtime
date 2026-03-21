import fs from 'fs/promises';
import { resolveSandboxPath } from './sandbox-utils';

/**
 * Tool: list_files
 * Lists files in a specified directory (scoped to the sandbox root).
 */
export async function listFiles(args: { dirPath?: string }) {
  const targetDir = await resolveSandboxPath(args.dirPath || '.');

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    return entries
      .map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      }));
  } catch (error: any) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}
