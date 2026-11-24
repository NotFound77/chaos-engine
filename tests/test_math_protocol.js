const assert = require('assert');
const ChaosMath = require('../src/math/logistic.js');
const ChaosProtocol = require('../src/hardware/protocol.js');

console.log('--- Testing ChaosMath ---');

// Test 1: logistic calculation
assert.strictEqual(ChaosMath.logistic(2.0, 0.5), 0.5);
assert.strictEqual(ChaosMath.logistic(4.0, 0.5), 1.0);
assert.strictEqual(ChaosMath.logistic(1.0, 0.0), 0.0);
console.log('✔ logistic calculation passed');

// Test 2: iterate
const seq = ChaosMath.iterate(2.0, 0.2, 5);
assert.strictEqual(seq.length, 6);
assert.strictEqual(seq[0], 0.2);
assert.strictEqual(seq[1], 2 * 0.2 * 0.8);
console.log('✔ iterate passed');

// Test 3: fixed points & stability
const fp_r05 = ChaosMath.fixedPoints(0.5);
assert.strictEqual(fp_r05.length, 1);
assert.strictEqual(fp_r05[0].x, 0);
assert.strictEqual(fp_r05[0].stability, 'stable');

const fp_r2 = ChaosMath.fixedPoints(2.0);
assert.strictEqual(fp_r2.length, 2);
assert.strictEqual(fp_r2[0].x, 0);
assert.strictEqual(fp_r2[0].stability, 'unstable');
assert.strictEqual(fp_r2[1].x, 0.5);
assert.strictEqual(fp_r2[1].stability, 'stable');

const fp_r35 = ChaosMath.fixedPoints(3.5);
assert.strictEqual(fp_r35[1].stability, 'unstable');
console.log('✔ fixedPoints and stability passed');

// Test 4: Lyapunov exponent
const lyap_stable = ChaosMath.lyapunovExponent(2.0, 0.2);
assert(lyap_stable < 0, `Expected negative Lyapunov for r=2.0, got ${lyap_stable}`);
const lyap_chaos = ChaosMath.lyapunovExponent(3.9, 0.2);
assert(lyap_chaos > 0, `Expected positive Lyapunov for r=3.9, got ${lyap_chaos}`);
console.log(`✔ lyapunovExponent passed (stable: ${lyap_stable.toFixed(3)}, chaos: ${lyap_chaos.toFixed(3)})`);

// Test 5: Comparison
const cmp = ChaosMath.compareTrajectories(3.9, 0.2, 100, 0.0001);
assert.strictEqual(cmp.seqA.length, 101);
assert.strictEqual(cmp.seqB.length, 101);
assert(cmp.maxDiff > 0.1, 'Chaotic trajectories should diverge significantly');
console.log(`✔ compareTrajectories passed (max separation: ${cmp.maxDiff.toFixed(4)})`);

console.log('--- Testing ChaosProtocol ---');

// Test PARAM
const p1 = ChaosProtocol.parseMessage('PARAM,2.350,0.460,90\r\n');
assert(p1.valid);
assert.strictEqual(p1.type, 'PARAM');
assert.strictEqual(p1.data.r, 2.35);
assert.strictEqual(p1.data.x0, 0.46);
assert.strictEqual(p1.data.n, 90);

// Test clamping
const p_clamp = ChaosProtocol.parseMessage('PARAM,5.0,-0.1,1000\n');
assert(p_clamp.valid);
assert.strictEqual(p_clamp.data.r, 4.0);
assert.strictEqual(p_clamp.data.x0, 0.0);
assert.strictEqual(p_clamp.data.n, 500);

// Test EVENT
const e_start = ChaosProtocol.parseMessage('EVENT,START\r\n');
assert(e_start.valid);
assert.strictEqual(e_start.type, 'EVENT');
assert.strictEqual(e_start.data.event, 'START');

const e_comp = ChaosProtocol.parseMessage('EVENT,COMPARE\n');
assert(e_comp.valid);
assert.strictEqual(e_comp.data.event, 'COMPARE');

// Test READY
const r_handshake = ChaosProtocol.parseMessage('READY,CHAOS_ENGINE,1\n');
assert(r_handshake.valid);
assert.strictEqual(r_handshake.type, 'READY');

// Test malformed
const bad1 = ChaosProtocol.parseMessage('GARBAGE_NOISE,123\n');
assert(!bad1.valid);

console.log('✔ All Protocol tests passed!');
