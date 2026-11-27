/* Núcleo común de los HUD: conexión con el receptor, ajustes, aprendizaje de la curva de potencia
   y decisión del aviso de cambio. Lo usan hud.html y hud2.html. */
(function(){
'use strict';
var store={get:function(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
           set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
var S=Object.assign({u:'kmh',url:'ws://127.0.0.1:8777',transp:false,sh:92,lead:150},store.get('bdr-hud2',{}));
var H={S:S,last:null,lastAt:0,shift:false,rpmShift:null,mode:'fijo',force:0,maxSpd:0,
       peak:{pow:0,rpm:0,tor:0,boost:0},frame:[],status:[],ord:0};
var BIN=200,curves=store.get('bdr-hud-curves',{}),cur=null,dirty=false,medCache={},medAt=0;

H.saveS=function(){store.set('bdr-hud2',S)};
H.onFrame=function(f){H.frame.push(f)};
H.onStatus=function(f){H.status.push(f)};

/* ---------- aprendizaje ---------- */
function carData(ord){if(!curves[ord])curves[ord]={pw:{},r:{}};return curves[ord]}
function maxAbs(a){var m=0;for(var i=0;i<a.length;i++){var v=Math.abs(a[i]);if(v>m)m=v}return m}
function learn(m){
  if(!m.on||!(m.ord>0))return;
  var d=carData(m.ord);cur=d;H.ord=m.ord;
  var calm=m.brk<5&&m.spd>3&&m.gear>0&&maxAbs(m.sr||[0])<0.6;
  if(calm){
    var r=m.rpm/m.spd,arr=d.r[m.gear]||(d.r[m.gear]=[]);
    arr.push(+r.toFixed(2));if(arr.length>60)arr.shift();dirty=true;
    if(m.gas>=230&&m.pow>0&&m.rpm>(m.rpmIdle||0)*1.2){
      var b=Math.floor(m.rpm/BIN),e=d.pw[b]||(d.pw[b]=[0,0]);
      e[0]+=m.pow;e[1]+=1;if(e[1]>200){e[0]*=0.9;e[1]*=0.9}
    }
  }
  if(m.gas>200&&m.pow>H.peak.pow){H.peak.pow=m.pow;H.peak.rpm=m.rpm}
  if(m.gas>200&&m.tor>H.peak.tor)H.peak.tor=m.tor;
  if(m.boost>H.peak.boost)H.peak.boost=m.boost;
}
function med(d,g){
  var a=d.r[g];if(!a||a.length<8)return null;
  var key=d===cur?g:null;
  if(key!==null&&medCache[g]&&performance.now()-medAt<1000)return medCache[g];
  var s=a.slice().sort(function(x,y){return x-y}),v=s[Math.floor(s.length/2)];
  if(key!==null){medCache[g]=v}
  return v;
}
function binAvg(d,i){var e=d.pw[i];return e&&e[1]>=3?e[0]/e[1]:null}
function pAt(d,rpm){
  var b=rpm/BIN-0.5,i=Math.floor(b),t=b-i,a=binAvg(d,i),c=binAvg(d,i+1);
  if(a===null&&c===null)return null;if(a===null)return c;if(c===null)return a;
  return a*(1-t)+c*t;
}
H.curve=function(){
  if(!cur)return[];var o=[];
  Object.keys(cur.pw).forEach(function(k){var v=binAvg(cur,+k);if(v!==null)o.push([(+k+0.5)*BIN,v/745.7])});
  return o.sort(function(x,y){return x[0]-y[0]});
};
H.ratios=function(){
  if(!cur)return{};var o={};
  Object.keys(cur.r).forEach(function(g){var v=med(cur,+g);if(v)o[g]=+v.toFixed(1)});
  return o;
};
H.resetCurve=function(){if(H.ord){delete curves[H.ord];cur=null;medCache={};store.set('bdr-hud-curves',curves)}};
setInterval(function(){if(!dirty)return;dirty=false;
  try{store.set('bdr-hud-curves',curves)}catch(e){}},5000);
setInterval(function(){medCache={};medAt=performance.now()},1000);

/* ---------- decisión de cambio ---------- */
function peakRpmCurve(d){var best=0,rp=0;Object.keys(d.pw).forEach(function(k){var v=binAvg(d,+k);if(v!==null&&v>best){best=v;rp=(+k+0.5)*BIN}});return rp}
function decide(m){
  var mx=m.rpmMax>0?m.rpmMax:8000,g=m.gear,rs=null,mode='fijo';
  if(cur&&g>0){
    var rg=med(cur,g),rn=med(cur,g+1);
    if(rg&&rn&&rn<rg){
      var k=rn/rg,pk=peakRpmCurve(cur),lastValid=0;
      for(var r=Math.max(0.5*mx,pk*0.9);r<=mx*0.995;r+=50){
        var p0=pAt(cur,r),p1=pAt(cur,r*k);if(p0===null||p1===null)continue;
        lastValid=r;if(p1>=p0*0.995){rs=r;break}
      }
      if(rs===null&&lastValid>=0.9*mx)rs=Math.min(mx*0.985,lastValid);
      if(rs!==null)mode='curva';
    }
  }
  if(rs===null)rs=mx*S.sh/100;
  var trigger=mode==='curva'?rs-S.lead:rs;
  var pressing=m.gas>=100&&m.brk<40&&g>0;
  var on=pressing&&(m.rpm>=trigger||(H.shift&&m.rpm>=trigger-150));
  if(mode==='curva'&&m.rpm>=mx*0.985&&pressing)on=true;
  H.rpmShift=rs;H.mode=mode;
  return on;
}
H.setShift=function(on){
  if(on===H.shift)return;H.shift=on;
  document.body.classList.toggle('shift',on);
};
H.testShift=function(){H.force=performance.now()+2000;H.setShift(true);setTimeout(function(){if(performance.now()>=H.force)H.setShift(false)},2100)};

/* ---------- conexión ---------- */
var ws=null,retry=null,want=true;
function status(t,ok){H.status.forEach(function(f){f(t,ok)})}
H.connect=function(){
  if(ws){want=false;try{ws.close()}catch(e){}ws=null}
  want=true;clearTimeout(retry);
  var w;try{w=new WebSocket(S.url)}catch(e){status('Dirección no válida',false);return}
  ws=w;status('Conectando…',false);
  w.onopen=function(){status('Conectado · esperando datos',true)};
  w.onmessage=function(ev){
    var m;try{m=JSON.parse(ev.data)}catch(x){return}
    if(m.t!=='s')return;
    H.last=m;H.lastAt=performance.now();status('Recibiendo datos',true);
    if(m.on){
      learn(m);
      var v=m.spd*(S.u==='mph'?2.23694:3.6);if(v>H.maxSpd)H.maxSpd=v;
      H.setShift(decide(m)||performance.now()<H.force);
    }else H.setShift(performance.now()<H.force);
    H.frame.forEach(function(f){f(m)});
  };
  w.onclose=function(){if(ws===w){ws=null;status('Sin conexión · reintentando',false);if(want)retry=setTimeout(H.connect,2000)}};
  w.onerror=function(){};
};
H.stale=function(){return !H.last||performance.now()-H.lastAt>2500};
setInterval(function(){if(H.stale())H.setShift(performance.now()<H.force)},400);
window.HUD=H;
})();
