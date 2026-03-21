import { getAllFiles, FileEntry } from './file-storage';

export type SearchResult = {
  filePath: string;
  line: number;
  content: string;
};

export async function searchInFiles(
  pattern: string,
  options: { dirPath?: string; maxResults?: number } = {}
): Promise<SearchResult[]> {
  const { dirPath = '', maxResults = 100 } = options;
  const regex = new RegExp(pattern, 'gi');
  const results: SearchResult[] = [];
  
  const allFiles = await getAllFiles();
  
  const normalizedDir = dirPath.replace(/^\/|\/$/g, '').toLowerCase();
  
  const filesToSearch = allFiles.filter(file => {
    if (file.type !== 'file') return false;
    if (!file.content) return false;
    
    const fileDir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/')).toLowerCase()
      : '';
    
    if (normalizedDir === '') {
      return true;
    }
    
    return fileDir.startsWith(normalizedDir) || fileDir === normalizedDir;
  });
  
  for (const file of filesToSearch) {
    if (results.length >= maxResults) break;
    
    const lines = file.content!.split('\n');
    
    for (let i = 0; i < lines.length && results.length < maxResults; i++) {
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        results.push({
          filePath: file.path,
          line: i + 1,
          content: lines[i]
        });
      }
    }
  }
  
  return results;
}

export async function getAllFilePaths(): Promise<string[]> {
  const allFiles = await getAllFiles();
  return allFiles
    .filter(f => f.type === 'file')
    .map(f => f.path);
}

export async function getFilesInDirectory(dirPath: string): Promise<FileEntry[]> {
  const allFiles = await getAllFiles();
  const normalizedDir = dirPath.replace(/^\/|\/$/g, '').toLowerCase();
  
  return allFiles.filter(file => {
    const fileDir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/')).toLowerCase()
      : '';
    
    return fileDir === normalizedDir;
  });
}
