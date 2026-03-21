import fs from 'fs/promises';
import { getSandboxRoot, resolveSandboxPath } from '@/lib/tools/sandbox-utils';

/**
 * GET: List all files in the sandbox root.
 */
export async function GET() {
  try {
    const root = await getSandboxRoot();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file'
    }));
    return new Response(JSON.stringify({ files }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

/**
 * POST: Create/Upload a file to the sandbox root.
 */
export async function POST(req: Request) {
  try {
    const { name, content } = await req.json();
    if (!name) throw new Error('File name is required');
    
    const targetPath = await resolveSandboxPath(name);
    await fs.writeFile(targetPath, content || '', 'utf8');
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

/**
 * DELETE: Delete a file from the sandbox root.
 */
export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) throw new Error('File name is required');
    
    const targetPath = await resolveSandboxPath(name);
    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      await fs.rm(targetPath, { recursive: true });
    } else {
      await fs.unlink(targetPath);
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
