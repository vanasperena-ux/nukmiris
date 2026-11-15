import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('PC-1 explicit build validation, normal/-O/-OO key checks and fail-closed scan counterexamples', () => {
  const result = execFileSync('python3', ['-I', 'pc1/test_security.py'], {
    cwd: new URL('../', import.meta.url), encoding:'utf8', timeout:60000, stdio:['ignore','pipe','pipe']
  });
  assert.ok(!result.includes('HOLD at'), 'Python unit suite must complete');
});
