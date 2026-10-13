import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'self-host',plugins:[react()],build:{outDir:'public',emptyOutDir:true},server:{host:'127.0.0.1'}});
