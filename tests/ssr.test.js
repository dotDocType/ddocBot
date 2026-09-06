import {test} from 'node:test';
import assert from 'node:assert/strict';
test('package imports without DOM globals and registers only explicitly',async()=>{
 const module=await import('../src/index.js').catch(()=>({}));
 assert.equal(typeof module.defineDdocBot,'function');
 assert.throws(()=>module.defineDdocBot(),/browser/i);
});
test('all training modules import without browser globals', async () => {
 for (const name of ['schema', 'engine', 'runtime', 'view']) {
  const module = await import(`../src/training/${name}.js`);
  assert.ok(Object.keys(module).length > 0);
 }
});
