// Mounted read-only by the local scanner; never included in the candidate image.
import fs from 'node:fs';
import crypto from 'node:crypto';
import tls from 'node:tls';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import 'node:dns/promises';
import 'node:https';
const require = createRequire('/proof/package.json');
require('pg');
tls.createSecureContext({minVersion: 'TLSv1.2'});
crypto.randomBytes(16);
zlib.gzipSync(Buffer.from('synthetic-local-probe'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const files = [...new Set(fs.readFileSync('/proc/self/maps', 'utf8').split('\n')
  .map(s => s.match(/\s(\/\S+)$/)?.[1]).filter(Boolean))].sort();
const names = ['/usr/local/lib/node_modules/npm','/usr/local/lib/node_modules/corepack',
  '/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/corepack','/usr/local/bin/yarn',
  '/usr/local/bin/yarnpkg','/usr/bin/npm','/usr/bin/npx','/usr/bin/corepack','/usr/bin/yarn',
  '/nodejs/bin/npm','/nodejs/bin/npx','/nodejs/bin/corepack','/nodejs/bin/yarn',
  '/opt/yarn','/bin/sh','/bin/bash','/usr/bin/apt','/usr/bin/dpkg'];
console.log(JSON.stringify({node:process.version, versions:process.versions, uid:process.getuid(),
  gid:process.getgid(), execPath:process.execPath, nodeSha256:sha(fs.readFileSync(process.execPath)),
  sharedOpenSSL:process.config.variables.node_shared_openssl,
  debian:fs.readFileSync('/etc/debian_version','utf8').trim(),
  loadedFiles:files.map(path=>({path,sha256:sha(fs.readFileSync(path))})),
  tooling:names.map(path=>({path,present:fs.existsSync(path)})),
  roots:fs.readdirSync('/').sort(), passwd:fs.readFileSync('/etc/passwd','utf8'),
  group:fs.readFileSync('/etc/group','utf8'), representativeModules:['crypto','tls','zlib','dns','https','pg'],
  scope:'LOCAL_READONLY_NETWORK_NONE_PROBE_NOT_PRODUCTION_ATTESTATION'}));
