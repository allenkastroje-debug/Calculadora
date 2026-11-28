const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createHud() {
  let now = 1000;
  const classes = new Set();
  const body = { appendChild() {}, classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); } } };
  const store = new Map();
  class FakeWebSocket {
    constructor(url) { this.url = url; FakeWebSocket.instance = this; }
    close() { if (this.onclose) this.onclose(); }
    sendMessage(value) { this.onmessage({ data: JSON.stringify(value) }); }
  }
  const context = {
    window: {}, document: { body, createElement() { return { style: {}, children: [{style:{}},{style:{}}], appendChild() {}, set id(v) {}, set innerHTML(v) {} }; } },
    localStorage: { getItem(k) { return store.has(k) ? store.get(k) : null; }, setItem(k,v) { store.set(k,v); } },
    WebSocket: FakeWebSocket, performance: { now() { return now; } },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, console,
    Number, Math, Object, Array, JSON, String, Date
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/hudcore.js'), 'utf8'), context);
  const H = context.window.HUD;
  H.connect();
  FakeWebSocket.instance.onopen();
  function send(rpm, gear=2) {
    now += 33;
    FakeWebSocket.instance.sendMessage({t:'s',on:1,ts:now,rpm,rpmMax:8000,rpmIdle:900,spd:25,
      ord:1234,pow:120000,tor:250,boost:0,gas:255,brk:0,gear,str:0,
      sr:[0,0,0,0],cs:[0.2,0.2,0.2,0.2],nt:[0.5,0.5,0.5,0.5],tmp:[90,90,90,90]});
  }
  return {H, classes, send, getSocket:()=>FakeWebSocket.instance};
}

test('HUD migra a la configuración amarilla final y conserva el estado', () => {
  const {H}=createHud();
  assert.equal(H.S.pre,800);
  assert.equal(H.S.hold,1200);
  assert.equal(H.S.lead,300);
  assert.equal(H.S.auto,false);
});

test('pre-aviso amarillo tiene histéresis y no parpadea cerca del umbral', () => {
  const {H,classes,send}=createHud();
  send(6600);
  assert.equal(H.warn,true);
  assert.ok(classes.has('warn'));
  send(6500);
  assert.equal(H.warn,true,'debe mantenerse dentro de la banda de histéresis');
  send(6400);
  assert.equal(H.warn,false,'debe apagarse al bajar 120 rpm del umbral');
  assert.ok(!classes.has('warn'));
});

test('aviso rojo tiene prioridad sobre el amarillo', () => {
  const {H,classes,send}=createHud();
  send(7500);
  assert.equal(H.shift,true);
  assert.equal(H.warn,false);
  assert.ok(classes.has('shift'));
  assert.ok(!classes.has('warn'));
});

test('el núcleo descarta muestras incompletas sin romper la conexión', () => {
  const {H,getSocket}=createHud();
  getSocket().sendMessage({t:'s',on:1,rpm:5000});
  assert.equal(H.last,null);
});
