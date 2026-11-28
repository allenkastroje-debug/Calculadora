/* Núcleo común de los HUD: conexión con el receptor, ajustes, aprendizaje de la curva de potencia
   y decisión del aviso de cambio. Lo usan hud.html y hud2.html. */
(function(){
'use strict';
var store={get:function(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
           set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
var S=Object.assign({u:'kmh',url:'ws://127.0.0.1:8777',transp:false,sh:92,lead:280,auto:true},store.get('bdr-hud2',{}));
if(!S.v4){S.v4=true;S.lead=300;S.auto=false;S.hold=1200}
if(!S.v5){S.v5=true;S.pre=800}
var H={S:S,aids:{spin:false,lock:false,tS:0,tL:0},last:null,lastAt:0,shift:false,rpmShift:null,mode:'fijo',force:0,rate:0,prev:null,tFire:0,fireGear:0,holdUntil:0,maxSpd:0,
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
  var pressing=m.gas>=100&&m.brk<40&&g>0;
  /* predicción: rpm esperadas dentro de "lead" ms (como ForzaShiftTone) */
  var ahead=m.rpm+Math.max(0,H.rate)*S.lead/1000;
  var on=pressing&&(ahead>=rs||(H.shift&&ahead>=rs-150));
  if(pressing&&m.rpm>=mx*0.985)on=true; /* tope de rpm */
  /* mantener el aviso: una vez encendido sigue "hold" ms (o hasta cambiar de marcha) */
  var nowd=performance.now();
  if(on&&!H.shift){H.fireGear=g;H.holdUntil=nowd+(S.hold||0)}
  if(!on&&H.shift&&g===H.fireGear&&nowd<H.holdUntil&&m.brk<40&&g>0)on=true;
  H.rpmShift=rs;H.mode=mode;
  return on;
}
H.warn=false;H.warnRpm=0;
H.setWarn=function(on){if(on===H.warn)return;H.warn=on;document.body.classList.toggle('warn',on)};
H.setShift=function(on){
  if(on===H.shift)return;H.shift=on;if(on&&performance.now()>H.force)H.tFire=performance.now();
  document.body.classList.toggle('shift',on);
};
H.testShift=function(){H.force=performance.now()+2000;H.setShift(true);setTimeout(function(){if(performance.now()>=H.force)H.setShift(false)},2100)};

/* ---------- avisos de patinaje / bloqueo (medidos, no son el estado de las ayudas del juego) ---------- */
var aidEl=null;
function aidsUI(){
  if(!aidEl){aidEl=document.createElement('div');aidEl.id='aidsBox';
    aidEl.style.cssText='position:fixed;right:10px;bottom:8px;display:flex;gap:6px;z-index:5;pointer-events:none;font:600 13px/1 "Saira Condensed",Arial Narrow,sans-serif;letter-spacing:.08em';
    aidEl.innerHTML='<span style="display:none;background:#FFB020;color:#111;padding:5px 9px;border-radius:5px">PATINAJE</span><span style="display:none;background:#FF3B30;color:#fff;padding:5px 9px;border-radius:5px">BLOQUEO</span>';
    document.body.appendChild(aidEl)}
  aidEl.children[0].style.display=H.aids.spin?'block':'none';aidEl.children[1].style.display=H.aids.lock?'block':'none'}
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
    var nowp=performance.now();
    if(H.prev&&m.on){var dtp=(nowp-H.prev.at)/1000;if(dtp>0.005&&dtp<0.5){H.rate=0.7*H.rate+0.3*((m.rpm-H.prev.rpm)/dtp)}}
    if(H.prev&&m.on&&m.gear>H.prev.gear&&H.prev.gear>0&&H.tFire&&S.auto){
      var gap=nowp-H.tFire;if(gap>80&&gap<1500){S.lead=Math.round(Math.max(-300,Math.min(600,0.85*S.lead+0.15*gap)));H.saveS();H.leadSet&&H.leadSet(S.lead)}H.tFire=0}
    H.prev={at:nowp,rpm:m.rpm,gear:m.gear};
    if(m.on&&m.sr){var mxs=-9,mns=9;for(var q=0;q<4;q++){if(m.sr[q]>mxs)mxs=m.sr[q];if(m.sr[q]<mns)mns=m.sr[q]}
      if(m.gas>=120&&mxs>0.6&&m.spd>1)H.aids.tS=nowp;if(m.brk>=120&&mns<-0.7&&m.spd>2)H.aids.tL=nowp}
    H.aids.spin=nowp-H.aids.tS<300;H.aids.lock=nowp-H.aids.tL<300;aidsUI();
    H.last=m;H.lastAt=nowp;status('Recibiendo datos',true);
    if(m.on){
      learn(m);
      var v=m.spd*(S.u==='mph'?2.23694:3.6);if(v>H.maxSpd)H.maxSpd=v;
      H.setShift(decide(m)||performance.now()<H.force);
      H.warnRpm=(H.rpmShift||0)-(S.pre||0);
      H.setWarn(!H.shift&&m.gas>=100&&m.brk<40&&m.gear>0&&m.rpm>=H.warnRpm);
    }else{H.setShift(performance.now()<H.force);H.setWarn(false)}
    H.frame.forEach(function(f){f(m)});
  };
  w.onclose=function(){if(ws===w){ws=null;status('Sin conexión · reintentando',false);if(want)retry=setTimeout(H.connect,2000)}};
  w.onerror=function(){};
};
H.stale=function(){return !H.last||performance.now()-H.lastAt>2500};
setInterval(function(){if(H.stale()){H.setShift(performance.now()<H.force);H.setWarn(false)}},400);
window.HUD=H;
})();
