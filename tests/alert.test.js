import {test} from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/alert.js').catch(()=>({}));
test('alert clock pulses on activation and repeats without bursts after a delayed frame',()=>{
  assert.equal(typeof module.AlertPulse,'function');const pulse=new module.AlertPulse();
  assert.equal(pulse.update(0,true),true);assert.equal(pulse.update(1999,true),false);assert.equal(pulse.update(1,true),true);
  assert.equal(pulse.update(9000,true),true);assert.equal(pulse.update(0,true),false);
});
test('deactivation resets the alert and interval changes start a fresh cycle',()=>{
  assert.equal(typeof module.AlertPulse,'function');const pulse=new module.AlertPulse();
  pulse.update(800,true);pulse.update(0,false);assert.equal(pulse.phase,0);assert.equal(pulse.active,false);
  assert.equal(pulse.update(0,true),true);pulse.interval=1000;assert.equal(pulse.update(999,true),false);assert.equal(pulse.update(1,true),true);
  assert.throws(()=>pulse.interval=NaN,TypeError);pulse.interval=10;assert.equal(pulse.interval,600);
});
