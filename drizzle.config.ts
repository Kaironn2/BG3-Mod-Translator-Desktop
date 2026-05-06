import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './dev.db'
  }
})
