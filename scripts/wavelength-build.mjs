import {copyFile,mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
await copyFile(path.join(root,'wavelength/questions.json'),path.join(root,'supabase/functions/_shared/wavelength/questions.json'));
const tools=process.env.WAVELENGTH_TOOLS||path.join(root,'.openai/wavelength-tools/node_modules');const {build}=require(path.join(tools,'esbuild'));
await mkdir(path.join(root,'.openai'),{recursive:true});await build({entryPoints:[path.join(root,'supabase/functions/wavelength-api/index.ts')],bundle:true,platform:'neutral',format:'esm',outfile:path.join(root,'.openai/wavelength-edge-check.js')});
console.log('Server question library synced; Edge bundle checked. No deployment performed.');
