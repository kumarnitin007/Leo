/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly APP_VERSION: string
  readonly BUILD_DATE: string
  readonly BUILD_TIME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

