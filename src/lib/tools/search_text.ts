import fs from 'fs/promises';
import path from 'path';

/**
 * Tool: search_text
 * Searches for a regular expression pattern within file contents.
 */
export async function searchText(args: { pattern: string; dirPath?: string }) {
  const rootDir = process.cwd();
  const searchDir = path.resolve(rootDir, args.dirPath || '.');
  const results: { filePath: string; line: number; content: string }[] = [];
  const regex = new RegExp(args.pattern, 'gi');

  // Security check: ensure searchDir is within rootDir
  if (!searchDir.startsWith(rootDir)) {
    throw new Error('Access denied: path is outside the project root.');
  }

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      // Simple ignore list
      const ignored = ['node_modules', '.next', '.git'];
      if (ignored.includes(entry.name)) continue;

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
            regex.lastIndex = 0; // Reset regex if using sticky/global
          }
        });
      }
    }
  };

  try {
    await walk(searchDir);
    return results.slice(0, 100); // Limit results to first 100 matches
  } catch (error: any) {
    throw new Error(`Failed to search text: ${error.message}`);
  }
}

export const searchTextDefinition = {
  name: 'search_text',
  description: 'Searches for a regular expression pattern within file contents.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for.',
      },
      dirPath: {
        type: 'string',
        description: 'The directory to search within (relative to project root). Defaults to ".". ',
      },
    },
    required: ['pattern'],
  },
};
