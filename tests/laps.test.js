const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
const start = src.indexOf('function tlLaps(S){');
const end = src.indexOf('\nfunction tlT0100', start);
assert.ok(start >= 0 && end > start, 'tlLaps debe existir');
const context = {};
vm.createContext(context);
vm.runInContext(src.slice(start, end) + '\nthis.tlLaps=tlLaps;', context);
const lap = (ts, n, cur, last=0) => ({ts, lap:n, cur, last});

test('cuenta una vuelta aunque la grabación empiece a mitad de ella', () => {
  assert.deepEqual(Array.from(context.tlLaps([lap(0,1,35),lap(1000,1,36),lap(2000,2,0,92)])), [92]);
});
test('detecta el cruce por reinicio del cronómetro aunque no cambie el contador', () => {
  assert.deepEqual(Array.from(context.tlLaps([lap(0,1,80),lap(1000,1,89),lap(2000,1,0)])), [89]);
});
test('no duplica el cruce si contador y cronómetro cambian juntos', () => {
  assert.deepEqual(Array.from(context.tlLaps([lap(0,1,80),lap(1000,2,0,90)])), [90]);
});
test('ignora reinicios cortos y tiempos inválidos', () => {
  assert.deepEqual(Array.from(context.tlLaps([lap(0,1,3),lap(1000,1,0),lap(2000,1,20)])), []);
});
