/// <reference types="vite/client" />

interface FileSystemFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

interface FileSystemDirectoryHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
}

interface Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}
