import {promises as fs} from 'node:fs';
import path from 'node:path';
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=(await walk('src')).filter(p=>p.endsWith('.ts'));
const forbidden=/from\s+['"](?:node:(?:http|https|net|tls|child_process)|googleapis|@google|axios|undici)|\bfetch\s*\(|\bprocess\.env\b|\bhttps?:\/\//;
const storageAllowed=new Set(['src/infrastructure/archive/indexed-archive.ts','src/infrastructure/archive/authenticated-tree.ts']);
for(const file of files){
 const source=await fs.readFile(file,'utf8');
 if(forbidden.test(source)||(/from\s+['"]node:(?:fs|sqlite)/.test(source)&&!storageAllowed.has(file.replaceAll('\\','/'))))throw new Error('Effect/import confinement violation: '+file);
}
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
if(Object.keys(pkg.dependencies).sort().join(',')!=='luxon,pg'||pkg.dependencies.luxon!=='3.7.2'||pkg.scripts.start)throw new Error('Unexpected dependency/start command');
console.log('PASS: no HTTP/provider/env/child-process client; fs/sqlite confined to two archive adapter files; only pg and pinned Luxon, no application start command');
