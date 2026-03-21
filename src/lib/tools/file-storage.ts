const DB_NAME = 'agent-sandbox';
const DB_VERSION = 1;
const STORE_NAME = 'files';

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
  lastModified: number;
};

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

export async function writeFile(filePath: string, content: string): Promise<void> {
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
      lastModified: Date.now()
    };
    
    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
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

export async function exportAsJson(): Promise<string> {
  const files = await getAllFiles();
  return JSON.stringify({ files, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importFromJson(jsonString: string): Promise<{ imported: number }> {
  const database = await openDB();
  const data = JSON.parse(jsonString);
  
  if (!data.files || !Array.isArray(data.files)) {
    throw new Error('Invalid import file format');
  }
  
  let count = 0;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let pending = data.files.length;
    
    if (pending === 0) {
      resolve({ imported: 0 });
      return;
    }
    
    for (const file of data.files) {
      const request = store.put(file);
      request.onsuccess = () => {
        count++;
        pending--;
        if (pending === 0) {
          resolve({ imported: count });
        }
      };
      request.onerror = () => {
        pending--;
        if (pending === 0) {
          resolve({ imported: count });
        }
      };
    }
  });
}
