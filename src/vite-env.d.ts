/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_ROOT_EMAIL: string
  readonly VITE_FIREBASE_INITIAL_AUTHORIZED_EMAILS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

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
