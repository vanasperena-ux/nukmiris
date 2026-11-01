import {promises as fs} from 'node:fs';
import path from 'node:path';
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=(await walk('src')).filter(p=>p.endsWith('.ts'));
const forbidden=/from\s+['"](?:node:(?:http|https|net|tls|child_process|fs)|googleapis|@google|axios|undici)|\bfetch\s*\(|\bprocess\.env\b|\bhttps?:\/\//;
for(const file of files){if(forbidden.test(await fs.readFile(file,'utf8')))throw new Error('WP1 effect/import confinement violation: '+file);}
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
if(Object.keys(pkg.dependencies).join(',')!=='pg'||pkg.scripts.start)throw new Error('Unexpected dependency/start command');
console.log('PASS: source has no HTTP/provider/env/filesystem/child-process client; only pg, no application start command');
