const DB_NAME = 'agent-sandbox';
const DB_VERSION = 2;
const STORE_NAME = 'files';

export const MAX_STORAGE_BYTES = 50 * 1024 * 1024; // 50MB

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
  });
}

export type FileEntry = {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  isBase64?: boolean;
  size?: number;
  lastModified: number;
};

export async function getStorageUsage(): Promise<number> {
  const files = await getAllFiles();
  return files.reduce((total, file) => total + (file.size || 0), 0);
}

export async function canStoreFile(fileSize: number): Promise<boolean> {
  const currentUsage = await getStorageUsage();
  return currentUsage + fileSize <= MAX_STORAGE_BYTES;
}

export async function fileExists(filePath: string): Promise<boolean> {
  const file = await readFile(filePath);
  return file !== null;
}

export async function listExistingFiles(filePaths: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const path of filePaths) {
    if (await fileExists(path)) {
      existing.push(path);
    }
  }
  return existing;
}

export async function listFiles(dirPath: string = ''): Promise<FileEntry[]> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allFiles = request.result as FileEntry[];
      const normalizedDir = dirPath ? dirPath.replace(/^\/|\/$/g, '').toLowerCase() : '';
      
      const results = allFiles.filter(file => {
        const fileDir = file.path.includes('/') 
          ? file.path.substring(0, file.path.lastIndexOf('/')).toLowerCase()
          : '';
        
        if (normalizedDir === '') {
          return !file.path.includes('/');
        }
        return fileDir === normalizedDir;
      }).map(file => ({
        path: file.path,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified
      }));
      
      resolve(results);
    };
  });
}

export async function writeFile(filePath: string, content: string, options: { size?: number; isBase64?: boolean } = {}): Promise<void> {
  const database = await openDB();
  const normalizedPath = filePath.replace(/^\/|\/$/g, '');
  
  const segments = normalizedPath.split('/');
  const fileName = segments[segments.length - 1];
  
  const parts = normalizedPath.split('/');
  parts.pop();
  const dirPath = parts.join('/');
  
  if (dirPath) {
    await ensureDirectory(dirPath);
  }
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const entry: FileEntry = {
      path: normalizedPath,
      name: fileName,
      type: 'file',
      content,
      size: options.size,
      isBase64: options.isBase64,
      lastModified: Date.now()
    };
    
    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function uploadFile(file: File, basePath: string = ''): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const normalizedPath = basePath 
          ? `${basePath.replace(/^\/|\/$/g, '')}/${file.name}`.replace(/^\/+/, '')
          : file.name;
        
        const content = reader.result as string;
        
        await writeFile(normalizedPath, content, {
          size: file.size,
          isBase64: false
        });
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    
    if (isTextFile(file.name)) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

function isTextFile(fileName: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.html', '.css', '.scss', '.sass', '.less',
    '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.py', '.rb', '.php', '.pl', '.pm', '.lua', '.r', '.scala',
    '.go', '.rs', '.java', '.kt', '.kts', '.cs', '.cpp', '.c', '.h',
    '.swift', '.m', '.mm', '.sql', '.graphql', '.gql',
    '.env', '.gitignore', '.dockerfile', '.editorconfig',
    '.log', '.csv', '.tsv'
  ];
  
  const lowerName = fileName.toLowerCase();
  return textExtensions.some(ext => lowerName.endsWith(ext)) || 
         !/\.[^.]+$/.test(fileName);
}

async function ensureDirectory(dirPath: string): Promise<void> {
  const database = await openDB();
  const normalizedPath = dirPath.replace(/^\/|\/$/g, '');
  const segments = normalizedPath.split('/');
  
  let currentPath = '';
  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(currentPath);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (!request.result) {
          const dirEntry: FileEntry = {
            path: currentPath,
            name: segment,
            type: 'directory',
            lastModified: Date.now()
          };
          
          await new Promise<void>((res, rej) => {
            const putRequest = store.put(dirEntry);
            putRequest.onerror = () => rej(putRequest.error);
            putRequest.onsuccess = () => res();
          });
        }
        resolve();
      };
    });
  }
}

export async function readFile(filePath: string): Promise<FileEntry | null> {
  const database = await openDB();
  const normalizedPath = filePath.replace(/^\/|\/$/g, '');
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(normalizedPath);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  const database = await openDB();
  const normalizedPath = filePath.replace(/^\/|\/$/g, '');
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const deleteRecursive = (path: string): Promise<void> => {
      return new Promise((res, rej) => {
        const getRequest = store.get(path);
        getRequest.onerror = () => rej(getRequest.error);
        getRequest.onsuccess = async () => {
          const entry = getRequest.result as FileEntry | undefined;
          if (!entry) {
            res();
            return;
          }
          
          if (entry.type === 'directory') {
            const children = await listFiles(path);
            for (const child of children) {
              await deleteRecursive(`${path}/${child.name}`);
            }
          }
          
          await new Promise<void>((delRes, delRej) => {
            const delReq = store.delete(path);
            delReq.onerror = () => delRej(delReq.error);
            delReq.onsuccess = () => delRes();
          });
          
          res();
        };
      });
    };
    
    deleteRecursive(normalizedPath).then(resolve).catch(reject);
  });
}

export async function getAllFiles(): Promise<FileEntry[]> {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as FileEntry[]);
  });
}
