import fs from 'fs/promises';
import path from 'path';
import { resolveSandboxPath, getSandboxRoot } from './sandbox-utils';

/**
 * Tool: search_text
 * Searches for a regular expression pattern within file contents (scoped to sandbox).
 */
export async function searchText(args: { pattern: string; dirPath?: string }) {
  const sandboxRoot = await getSandboxRoot();
  const searchDir = await resolveSandboxPath(args.dirPath || '.');
  const results: { filePath: string; line: number; content: string }[] = [];
  const regex = new RegExp(args.pattern, 'gi');

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(sandboxRoot, fullPath);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        if (stats.size > 512 * 1024) continue; // Skip large files > 512KB

        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({
              filePath: relativePath,
              line: index + 1,
              content: line.trim(),
            });
            regex.lastIndex = 0;
          }
        });
      }
    }
  };

  try {
    await walk(searchDir);
    return results.slice(0, 100);
  } catch (error: any) {
    throw new Error(`Failed to search text: ${error.message}`);
  }
}
