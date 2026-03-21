import path from 'path';
import fs from 'fs/promises';

/**
 * Returns the absolute path to the sandbox isolated directory.
 * Ensures the directory exists.
 */
export async function getSandboxRoot() {
  const root = path.join(process.cwd(), 'src', 'lib', 'tools', 'sandbox-root');
  try {
    await fs.access(root);
  } catch {
    await fs.mkdir(root, { recursive: true });
  }
  return root;
}

/**
 * Validates that a given relative path is within the sandbox root.
 * Returns the absolute path if valid, otherwise throws.
 */
export async function resolveSandboxPath(relativeChildPath: string = '.') {
  const root = await getSandboxRoot();
  const absolutePath = path.resolve(root, relativeChildPath);

  if (!absolutePath.startsWith(root)) {
    throw new Error('Access denied: Path is outside the sandbox isolation zone.');
  }

  return absolutePath;
}
