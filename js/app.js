//#LOGIC_START
const CLASSES=['D','C','B','A','S1','S2','R','X'];
const FAC={w:2.20462,p:14.5038,k:55.997,h:0.393701,s:0.621371};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const C=(v,o)=>Object.assign({v:v},o||{});

/* i llega en unidades métricas: kg, kgf/mm, cm, km/h. */
function compute(i){
  const idx=Math.max(0,CLASSES.indexOf(i.cls));
  const fp=i.front/100, W=i.weight, drive=i.drive, use=i.use;
  const pw=i.hp/(W/1000);
  const rot=-i.bal;               // positivo = el coche debe girar más
  const notes=[];

  /* Frecuencia propia de la suspensión (Hz): base por uso, ajustada por clase, pista y neumático. */
  const base={road:2.8,street:2.0,dirt:1.6,cross:1.4,drift:2.3,drag:1.5}[use];
  const trk={fast:0.15,mixed:0,tech:-0.1}[i.track]||0;
  const tireF={street:-0.08,sport:0,semi:0.08,slick:0.15,rally:0,offroad:-0.05,drag:0}[i.tire]||0;
  let fF=base+tireF;
  if(use==='road') fF+=trk+0.07*idx;
  else if(use==='drift') fF+=0.05*idx;
  else if(use==='dirt'||use==='cross') fF+=0.03*idx;
  let fR=fF*(drive==='fwd'?1.12:1.08);
  if(use==='drag'){fF=1.5;fR=2.6;}
  const sf=1+0.05*i.stiff; fF*=sf; fR*=sf;

  const mF=W*fp/2*0.88, mR=W*(1-fp)/2*0.88;          // masa suspendida por rueda
  const kF=mF*Math.pow(2*Math.PI*fF,2)/9806.65;       // kgf/mm
  const kR=mR*Math.pow(2*Math.PI*fR,2)/9806.65;

  const R=i.rng;
  const ranged=(pos,rg)=>{
    const ok=rg[1]>rg[0];
    return ok?{v:rg[0]+clamp(pos)*(rg[1]-rg[0]),pos:clamp(pos)}:{v:null,pos:clamp(pos)};
  };
  const kCell=(k,rg,side)=>{
    const ok=rg[1]>rg[0];
    if(!ok) return C(null,{pos:0,side:side});
    const raw=(k-rg[0])/(rg[1]-rg[0]);
    return C(clamp(k,rg[0],rg[1]),{t:'k',d:1,pos:clamp(raw),side:side,lim:raw<0?'mín':(raw>1?'máx':'')});
  };
  const rCell=(pos,rg,side,o)=>{
    const r=ranged(pos,rg);
    return C(r.v,Object.assign({pos:r.pos,side:side,d:1},o||{}));
  };

  /* Neumáticos */
  const dW=(W-1400)/400;
  let pf,pr;
  switch(use){
    case 'road':pf=29;pr=28.5;break;
    case 'street':pf=32;pr=32;break;
    case 'dirt':pf=24;pr=23;break;
    case 'cross':pf=22;pr=21;break;
    case 'drift':pf=28;pr=33;break;
    default:pf=38;pr=21;
  }
  if(use!=='drag'){pf+=dW*0.8+(i.front-50)*0.12; pr+=dW*0.8-(i.front-50)*0.12;}
  pf=clamp(pf,14,50); pr=clamp(pr,14,50);

  /* Alineación */
  let cf,cr,tf,tr,ca;
  if(use==='road'){cf=-1.3-0.1*(idx/7)+(i.track==='tech'?-0.1:0);cr=-1.0;tf=-0.1;tr=0.1;ca=6.0;}
  else if(use==='street'){cf=-0.6;cr=-0.5;tf=0;tr=0.1;ca=5.5;}
  else if(use==='dirt'){cf=-0.6;cr=-0.4;tf=0;tr=0.2;ca=5.0;}
  else if(use==='cross'){cf=-0.3;cr=-0.2;tf=0;tr=0.2;ca=5.0;}
  else if(use==='drift'){cf=-3.5;cr=-1.0;tf=-0.5;tr=0;ca=7.0;}
  else {cf=0;cr=0;tf=0;tr=0;ca=5.0;}
  if(drive==='fwd'){ca-=0.5;}
  tf-=0.03*rot; cf-=0.04*rot*(use==='drag'?0:1);

  /* Barras estabilizadoras (posición 0 a 1 del rango) */
  const arbTab={rwd:[0.45,0.30],fwd:[0.30,0.55],awd:[0.45,0.35]}[drive];
  let aF,aR;
  if(use==='drift'){aF=0.35;aR=0.65;}
  else if(use==='drag'){aF=0.15;aR=0.30;}
  else{
    const m={road:1,street:0.8,dirt:0.55,cross:0.45}[use];
    aF=arbTab[0]*m; aR=arbTab[1]*m;
  }
  aF+=(i.front-50)*0.008;
  if(drive!=='fwd') aR-=clamp((pw-300)/1500,0,0.12);
  aF-=0.04*rot; aR+=0.04*rot;
  aF=clamp(aF,0.02,0.98); aR=clamp(aR,0.02,0.98);

  /* Altura */
  let hF,hR;
  if(use==='road'){hF=0.10;hR=0.13;}
  else if(use==='street'){hF=0.30;hR=0.30;}
  else if(use==='dirt'){hF=0.70;hR=0.70;}
  else if(use==='cross'){hF=0.85;hR=0.85;}
  else if(use==='drift'){hF=0.20;hR=0.20;}
  else {hF=0.45;hR=0.15;}

  /* Amortiguación */
  const stF=clamp((fF-1.2)/1.7), stR=clamp((fR-1.2)/1.7);
  const cmp=(use==='dirt'||use==='cross')?0.5:0.62;
  const rbF=0.25+0.45*stF, rbR=0.25+0.45*stR;

  /* Aerodinámica */
  let eF,eR;
  if(use==='road'){
    const t={fast:[0.35,0.45],mixed:[0.6,0.7],tech:[0.8,0.85]}[i.track];
    eF=t[0];eR=t[1]+(drive==='rwd'?0.05:0);
  } else if(use==='street'){eF=0.4;eR=0.45;}
  else if(use==='dirt'||use==='cross'){eF=0.3;eR=0.35;}
  else if(use==='drift'){eF=0.3;eR=0.3;}
  else {eF=0;eR=0;}
  eR+=-0.03*rot;
  /* Con solo un eje ajustable, el otro queda fijo: se compensa para no desequilibrar el coche. */
  if(i.aero==='rear'){eR+=-0.05-0.03*rot;}
  if(i.aero==='front'){eF+=-0.05+0.03*rot;}
  eF=clamp(eF,0,1); eR=clamp(eR,0,1);

  /* Diferencial */
  const hpAdj=clamp((i.hp-500)/80,0,12);
  let dAf=null,dDf=null,dAr=null,dDr=null,dC=null;
  const off=(use==='dirt'||use==='cross');
  if(drive==='rwd'){
    if(use==='drag'){dAr=100;dDr=0;}
    else if(use==='drift'){dAr=100;dDr=60;}
    else if(use==='road'){dAr=60-hpAdj;dDr=25;}
    else if(use==='street'){dAr=50-hpAdj;dDr=15;}
    else {dAr=45-hpAdj;dDr=10;}
  } else if(drive==='fwd'){
    if(use==='drag'){dAf=100;dDf=0;}
    else if(use==='road'||use==='drift'){dAf=55;dDf=15;}
    else if(use==='street'){dAf=40;dDf=10;}
    else {dAf=35;dDf=5;}
  } else {
    if(use==='drag'){dAf=40;dDf=0;dAr=100;dDr=0;dC=60;}
    else if(use==='drift'){dAf=0;dDf=0;dAr=100;dDr=60;dC=85;}
    else if(use==='road'){dAf=20;dDf=5;dAr=65-hpAdj*0.5;dDr=25;dC=70;}
    else if(use==='street'){dAf=15;dDf=0;dAr=50-hpAdj*0.5;dDr=15;dC=65;}
    else {dAf=25;dDf=0;dAr=40-hpAdj*0.5;dDr=10;dC=55;}
  }
  const dRot=(v,k)=>v===null?null:clamp(v-k*rot,0,100);
  dAf=dRot(dAf,4);dAr=dRot(dAr,4);dDf=dRot(dDf,2);dDr=dRot(dDr,2);
  if(dC!==null && use!=='drag') dC=clamp(dC+2*rot,40,95);

  /* Frenos */
  const bBase={road:52,street:52,dirt:48,cross:48,drift:46,drag:50}[use];
  const brake=clamp(bBase+(i.front-50)*0.6-1*rot,40,65);
  let bp={road:110,street:100,dirt:85,cross:85,drift:100,drag:100}[use];
  if(i.tire==='slick'||i.tire==='semi') bp+=5;

  const g=[];
  g.push({title:'Neumáticos',why:'Presión en caliente. Más peso pide más presión; en tierra se baja para ganar agarre y absorber baches.',
    rows:[{l:'Presión',f:C(pf/FAC.p,{t:'p',d:2,side:'f'}),r:C(pr/FAC.p,{t:'p',d:2,side:'r'})}]});
  g.push({title:'Alineación',why:'Caída negativa da agarre en curva. Convergencia: positivo es hacia dentro, negativo hacia fuera (mejor giro de entrada).',
    rows:[
      {l:'Caída (°)',f:C(cf,{d:1}),r:C(cr,{d:1})},
      {l:'Convergencia (°)',f:C(tf,{d:1}),r:C(tr,{d:1})},
      {l:'Avance (°)',f:C(ca,{d:1}),one:true}]});
  g.push({title:'Barras estabilizadoras',why:'Controlan el balanceo. Más dura delante empuja al subviraje; más dura detrás ayuda a rotar.',
    rows:[{l:'Rigidez',f:rCell(aF,R.ab,'f'),r:rCell(aR,R.ab,'r')}]});
  g.push({title:'Muelles',why:'Calculados con la masa que carga cada rueda y una frecuencia objetivo según uso y clase. Atrás un poco más duros para mantener el coche plano.',
    rows:[{l:'Rigidez',f:kCell(kF,R.kF,'f'),r:kCell(kR,R.kR,'r')}]});
  g.push({title:'Altura',why:'Baja en asfalto para bajar el centro de gravedad; alta en tierra para no tocar el suelo. Atrás ligeramente más alta da algo de rake.',
    rows:[{l:'Altura',f:rCell(hF,R.hF,'f',{t:'h'}),r:rCell(hR,R.hR,'r',{t:'h'})}]});
  g.push({title:'Amortiguación',why:'El rebote controla cuánto tarda el muelle en volver; la compresión, cuánto frena el golpe. Más duro cuanto más duros sean los muelles.',
    rows:[
      {l:'Rebote',f:rCell(rbF,R.rb,'f'),r:rCell(rbR,R.rb,'r')},
      {l:'Compresión',f:rCell(rbF*cmp,R.cp,'f'),r:rCell(rbR*cmp,R.cp,'r')}]});
  if(i.aero==='both'){
    g.push({title:'Aerodinámica',why:'En pistas rápidas menos carga reduce el arrastre y sube la punta; en técnicas, más carga da agarre en curvas lentas.',
      rows:[{l:'Carga',f:rCell(eF,R.aF,'f',{t:'w',d:0}),r:rCell(eR,R.aR,'r',{t:'w',d:0})}]});
  } else if(i.aero==='rear'){
    g.push({title:'Aerodinámica',why:'Solo puedes cambiar el alerón trasero, así que la carga delantera queda fija. Más carga trasera estabiliza la trasera pero hace subvirar a alta velocidad; por eso el valor sale un poco por debajo del que usaría con ambos ejes. Si subvira en curvas rápidas, bájalo; si la trasera se va, súbelo.',
      rows:[{l:'Carga trasera',f:rCell(eR,R.aR,'r',{t:'w',d:0}),one:true}]});
  } else if(i.aero==='front'){
    g.push({title:'Aerodinámica',why:'Solo puedes cambiar la carga delantera, así que la trasera queda fija. Más carga delantera ayuda a girar pero puede dejar la trasera ligera a alta velocidad; por eso el valor sale un poco por debajo del que usaría con ambos ejes. Si la trasera se suelta en curvas rápidas, bájalo.',
      rows:[{l:'Carga delantera',f:rCell(eF,R.aF,'f',{t:'w',d:0}),one:true}]});
  } else {
    g.push({title:'Aerodinámica',why:'Tu coche no tiene aero ajustable. Si vas a usar pistas rápidas, monta un alerón regulable cuando la clase lo permita. Sin aero, compensa con más agarre mecánico: caída negativa y barras.',rows:[]});
  }
  const dr=[
    {l:'Aceleración',f:dAf===null?null:C(dAf,{d:0,u:'%'}),r:dAr===null?null:C(dAr,{d:0,u:'%'})},
    {l:'Deceleración',f:dDf===null?null:C(dDf,{d:0,u:'%'}),r:dDr===null?null:C(dDr,{d:0,u:'%'})}];
  if(dC!==null) dr.push({l:'Reparto central (trasero)',f:C(dC,{d:0,u:'%'}),one:true});
  g.push({title:'Diferencial',why:'Más bloqueo en aceleración empuja al subviraje en FWD y AWD; en RWD da tracción pero puede soltar la trasera si te pasas de potencia.',rows:dr});
  g.push({title:'Frenos',why:'El balance se desplaza hacia el eje con más peso. Baja la presión si se bloquean las ruedas, sobre todo en tierra.',
    rows:[
      {l:'Balance (delantero %)',f:C(brake,{d:0,u:'%'}),one:true},
      {l:'Presión (%)',f:C(bp,{d:0,u:'%'}),one:true}]});

  let gear;
  if(i.fd>0&&i.topNow>0&&i.topTarget>0){
    const nf=i.fd*i.topNow/i.topTarget;
    gear={title:'Marchas',why:'Estimación: la velocidad máxima baja cuando sube la relación final. Pruébala en pista, porque el límite lo pone también el motor.',
      rows:[{l:'Relación final nueva',f:C(nf,{d:2}),one:true}]};
  } else {
    gear={title:'Marchas',why:'Completa la relación final y las velocidades máximas en el formulario para calcular una relación nueva. Regla práctica: en pistas técnicas baja la velocidad máxima y gana aceleración; en rápidas, haz que la última marcha llegue al corte justo al final de la recta más larga.',rows:[]};
  }
  g.push(gear);

  if(Math.abs(fp-0.5)>0.12) notes.push('El reparto de peso es muy desigual. Revisa el balance de frenos y las barras en pista.');
  if(pw>700) notes.push('Mucha potencia por tonelada. Si pierdes tracción, sube la presión trasera un poco y ablanda la barra trasera.');
  if(drive==='fwd'&&pw>450) notes.push('FWD con mucha potencia: el diferencial delantero tiende a subvirar a la salida. Baja el bloqueo de aceleración si pasa.');
  return {groups:g,notes:notes,pw:pw};
}
//#LOGIC_END

/* ---------- Interfaz ---------- */
const $=id=>document.getElementById(id);
const UNITS={metric:{w:'kg',p:'bar',k:'kgf/mm',h:'cm',s:'km/h'},imperial:{w:'lb',p:'psi',k:'lb/in',h:'in',s:'mph'}};
const KF={kgf:1,N:9.80665,lb:FAC.k},KU={kgf:'kgf/mm',N:'N/mm',lb:'lb/in'};
let units='metric',kUnit='kgf';
const uLab=t=>t==='k'?KU[kUnit]:UNITS[units][t];
const toSI=(v,t)=>t==='k'?v/KF[kUnit]:(units==='imperial'?v/FAC[t]:v);
const fromSI=(v,t)=>t==='k'?v*KF[kUnit]:(units==='imperial'?v*FAC[t]:v);
const kRound=v=>kUnit==='lb'?Math.round(v):Math.round(v*100)/100;
function setKUnit(nu,convert){
  if(!KF[nu]||nu===kUnit){$('kUnit').value=kUnit;return;}
  if(convert)document.querySelectorAll('[data-u="k"]').forEach(el=>{
    const v=parseFloat(el.value);if(!Number.isFinite(v))return;
    const old=kUnit;kUnit=nu;const out=v/KF[old]*KF[nu];kUnit=old;
    el.value=String(nu==='lb'?Math.round(out):Math.round(out*100)/100);
  });
  kUnit=nu;$('kUnit').value=nu;refreshLabels();
}
const num=id=>{const v=parseFloat($(id).value);return Number.isFinite(v)?v:0};
const FIELDS=['carName','cls','drive','weight','front','hp','tire','use','track','fd','topNow','topTarget','bal','stiff','kUnit','kFmin','kFmax','kRmin','kRmax','abMin','abMax','hFmin','hFmax','hRmin','hRmax','rbMin','rbMax','cpMin','cpMax','aFmin','aFmax','aRmin','aRmax'];

function readInputs(){
  const rg=(a,b,t)=>[t?toSI(num(a),t):num(a),t?toSI(num(b),t):num(b)];
  return {
    cls:$('cls').value,drive:$('drive').value,use:$('use').value,track:$('track').value,tire:$('tire').value,
    weight:toSI(num('weight'),'w'),front:num('front'),hp:num('hp'),aero:$('aero').value,
    fd:num('fd'),topNow:toSI(num('topNow'),'s'),topTarget:toSI(num('topTarget'),'s'),
    bal:num('bal'),stiff:num('stiff'),
    rng:{kF:rg('kFmin','kFmax','k'),kR:rg('kRmin','kRmax','k'),ab:rg('abMin','abMax'),hF:rg('hFmin','hFmax','h'),hR:rg('hRmin','hRmax','h'),
      rb:rg('rbMin','rbMax'),cp:rg('cpMin','cpMax'),aF:rg('aFmin','aFmax','w'),aR:rg('aRmin','aRmax','w')}
  };
}

function setUnits(u,convert){
  if(u===units){refreshLabels();return;}
  const old=units;
  if(convert){
    document.querySelectorAll('[data-u]').forEach(el=>{
      if(el.value==='')return;
      const t=el.dataset.u, v=parseFloat(el.value);
      if(t==='k'||!Number.isFinite(v))return;
      const si=old==='imperial'?v/FAC[t]:v;
      const out=u==='imperial'?si*FAC[t]:si;
      el.value=String(Math.round(out*(t==='w'||t==='s'?1:100))/(t==='w'||t==='s'?1:100));
    });
  }
  units=u;
  if(convert){
    if(u==='imperial'&&kUnit==='kgf')setKUnit('lb',true);
    else if(u==='metric'&&kUnit==='lb')setKUnit('kgf',true);
  }
  refreshLabels();
}
function refreshLabels(){
  document.querySelectorAll('[data-ut]').forEach(el=>{el.textContent='('+uLab(el.dataset.ut)+')'});
  $('uMetric').setAttribute('aria-pressed',String(units==='metric'));
  $('uImp').setAttribute('aria-pressed',String(units==='imperial'));
}

const BAL_TXT={'-3':'Subvira mucho','-2':'Subvira','-1':'Subvira un poco','0':'Neutro','1':'Sobrevira un poco','2':'Sobrevira','3':'Sobrevira mucho'};
const STF_TXT={'-3':'Mucho más blando','-2':'Más blando','-1':'Algo más blando','0':'Base','1':'Algo más duro','2':'Más duro','3':'Mucho más duro'};

function cellHtml(c,side){
  if(c===null||c===undefined) return '<div class="cell"><span class="na">—</span></div>';
  const t=c.t, unitTxt=c.u?c.u:(t?uLab(t):'');
  let txt;
  if(c.v===null){txt=Math.round((c.pos||0)*100)+'<small>% del rango</small>';}
  else{
    const dv=t?fromSI(c.v,t):c.v;
    const d=t==='p'&&units==='imperial'?1:(t==='k'&&kUnit==='lb'?0:(t==='h'?1:(c.d!==undefined?c.d:1)));
    txt=dv.toFixed(d)+(unitTxt?'<small>'+unitTxt+'</small>':'')+(c.lim?'<span class="lim">límite '+c.lim+'</span>':'');
  }
  const meter=(c.pos!==undefined&&c.side)?'<div class="meter '+(c.side==='r'?'r':'')+'"><i style="width:'+Math.round(c.pos*100)+'%"></i></div>':'';
  return '<div class="cell"><span class="val">'+txt+'</span>'+meter+'</div>';
}

function render(){
  const out=compute(readInputs());
  const i=readInputs();
  const car=carNow();
  const lk=car?unlockedTuning(car):null;
  const driveTxt={rwd:'RWD',fwd:'FWD',awd:'AWD'}[i.drive];
  const pwShow=units==='imperial'?(i.hp/(i.weight*FAC.w/1000)):out.pw;
  let h='<div class="strip">'
    +'<div><small>Clase</small><b><span class="cb" data-c="'+i.cls+'">'+i.cls+'</span></b></div>'
    +'<div><small>Tracción</small><b>'+driveTxt+'</b></div>'
    +'<div><small>Reparto</small><b>'+Math.round(i.front)+'/'+Math.round(100-i.front)+'</b></div>'
    +'<div><small>'+(units==='imperial'?'hp por 1000 lb':'hp por tonelada')+'</small><b>'+Math.round(pwShow)+'</b></div></div>';
  out.notes.forEach(n=>{h+='<div class="banner">'+n+'</div>'});
  out.groups.forEach(g=>{
    h+='<section class="card"><header><h3>'+g.title+'</h3><div class="legend"><span><i></i>Del.</span><span><i class="r"></i>Tras.</span></div></header>';
    h+='<p class="why">'+g.why+'</p>'+lockMsg(g.title,lk);
    g.rows.forEach(r=>{
      h+='<div class="row"><div class="lab">'+r.l+'</div>';
      if(r.one){h+='<div class="cell one">'+cellHtml(r.f).replace(/^<div class="cell">/,'').replace(/<\/div>$/,'')+'</div>';}
      else{h+=cellHtml(r.f)+cellHtml(r.r);}
      h+='</div>';
    });
    h+='</section>';
  });
  h+='<div class="actions"><button type="button" class="btn ghost" id="copyBtn">Copiar reglajes</button><span class="status" id="copyStatus" role="status"></span></div>';
  h+='<div class="banner">Estos valores son un punto de partida calculado con reglas generales de afinación, no datos oficiales de Forza Horizon 6. Pruébalos en pista, usa "Cómo se siente en pista" para corregir y guarda el perfil cuando te guste.</div>';
  $('results').innerHTML=h;
  $('copyBtn').addEventListener('click',()=>copyText(resultText(out),'copyStatus','Reglajes copiados'));
  $('trackWrap').hidden=$('use').value!=='road';
  $('balOut').textContent=BAL_TXT[$('bal').value];
  $('stiffOut').textContent=STF_TXT[$('stiff').value];
}

function plain(c){
  if(!c) return '—';
  if(c.v===null) return Math.round((c.pos||0)*100)+'% del rango';
  const t=c.t, dv=t?fromSI(c.v,t):c.v;
  const d=t==='p'&&units==='imperial'?1:(t==='k'&&kUnit==='lb'?0:(t==='h'?1:(c.d!==undefined?c.d:1)));
  return dv.toFixed(d)+(c.u?c.u:(t?' '+uLab(t):''));
}
function resultText(out){
  const name=$('carName').value.trim()||'Coche sin nombre';
  let s=name+' · '+$('cls').value+' · '+$('use').selectedOptions[0].textContent+'\n';
  out.groups.forEach(g=>{
    if(!g.rows.length) return;
    s+='\n'+g.title.toUpperCase()+'\n';
    g.rows.forEach(r=>{
      s+=r.l+': '+(r.one?plain(r.f):'Del. '+plain(r.f)+' / Tras. '+plain(r.r))+'\n';
    });
  });
  return s;
}
function copyText(text,statusId,okMsg){
  const st=$(statusId);
  const fallback=()=>{
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand('copy')}catch(e){}
    document.body.removeChild(ta);
    st.textContent=ok?okMsg:'No se pudo copiar. Selecciona el texto manualmente.';
  };
  try{navigator.clipboard.writeText(text).then(()=>{st.textContent=okMsg},fallback)}catch(e){fallback()}
}

/* ---------- Coches y piezas ---------- */
/* Los coches viven en archivos aparte: data/index.json lista los archivos y data/cars/<id>.json trae cada coche.
   Para añadir un coche basta con subir su archivo y una línea al índice; esta página no se toca. */
let CARS=[];
let partSel={};
let shopPath={g:null,c:null};
let loadMsg='';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

const GROUPS=[
  {id:'engine',n:'Motor'},
  {id:'chassis',n:'Plataforma y manejo'},
  {id:'drivetrain',n:'Tren motriz'},
  {id:'wheels',n:'Ruedas y neumáticos'},
  {id:'aero',n:'Aerodinámica'},
  {id:'conv',n:'Kits y conversiones'}
];
const GICON={
  engine:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 20h32v16H8z M14 20v-7h8v7 M26 20v-7h8v7 M3 27h5 M40 27h5"/></svg>',
  chassis:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="6"/><path d="M24 7v6 M24 35v6 M7 24h6 M35 24h6"/></svg>',
  drivetrain:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 24h38 M8 14v20 M40 14v20 M19 17h10v14H19z"/></svg>',
  wheels:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="5"/><path d="M24 7v12 M24 29v12 M7 24h12 M29 24h12"/></svg>',
  aero:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 28l9-5h30v6H14z M17 29v9 M38 29v9"/></svg>',
  conv:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="6" width="20" height="36" rx="5"/><path d="M8 12h6 M34 12h6 M8 36h6 M34 36h6"/></svg>'
};
const UNLOCK_TXT={
  springs:'muelles, amortiguación y alineación',
  brakes:'ajuste de frenos',
  arbF:'rigidez de la barra delantera',
  arbR:'rigidez de la barra trasera',
  gearFinal:'relación final de transmisión',
  gears:'relación completa de marchas',
  diffAccel:'diferencial de aceleración',
  diffFull:'diferencial completo (aceleración y deceleración)',
  aeroF:'carga aerodinámica delantera',
  aeroR:'carga aerodinámica trasera'
};

/* Cámara del garaje: cada pieza enfoca una zona de la silueta. vb = encuadre [x,y,ancho,alto] (relación 2:1); hot = círculo de aviso. */
const CAMS={
  all:{vb:[0,0,800,400],hot:null},
  engine:{vb:[440,100,360,180],hot:[690,206,72,34]},
  fwheel:{vb:[470,200,260,130],hot:[600,270,64,64]},
  rwheel:{vb:[70,200,260,130],hot:[200,270,64,64]},
  cabin:{vb:[180,60,440,220],hot:[400,160,160,52]},
  rear:{vb:[0,150,320,160],hot:[100,236,56,40]},
  under:{vb:[140,140,520,260],hot:[400,272,210,22]},
  frontend:{vb:[500,120,300,150],hot:[745,238,52,34]},
  wing:{vb:[0,100,300,150],hot:[80,224,56,22]},
  side:{vb:[180,190,440,150],hot:[400,268,210,16]}
};
const CAT_CAM={s_exhaust:'rear',turbo:'engine',supercharger:'engine',intercooler:'engine',aspiration:'engine',bodykit:'all',drivetrainSwap:'under',swap:'engine',rimF:'fwheel',rimR:'rwheel',trackF:'fwheel',trackR:'rwheel',tireF:'fwheel',tireR:'rwheel',tires:'fwheel',rims:'fwheel',skirts:'side',bumperF:'frontend',wing:'wing',bumperR:'rear',exhaust:'rear',brakes:'fwheel',springs:'fwheel',arbF:'fwheel',arbR:'rwheel',reinf:'cabin',weight:'all',clutch:'under'};
const GROUP_CAM={engine:'engine',chassis:'all',drivetrain:'under',wheels:'fwheel',aero:'all',conv:'all'};
let camVB=[0,0,800,400],camAnim=0,curCam='all';
let phAct=null,curPhoto='';
function photoTo(src){
  const A=$('phA'),B=$('phB'),stg=$('stage');
  if(!A||!B)return;
  const nxt=phAct===A?B:A,cur=phAct;
  nxt.onerror=()=>{if(stg)stg.classList.remove('photo');curPhoto=''};
  nxt.onload=()=>{nxt.classList.add('on');if(cur)cur.classList.remove('on');phAct=nxt};
  nxt.src=src;
}
function camTo(name){
  const svg=$('carSvg'),stg=$('stage'),car=carNow();
  const src=car&&car.stage?(car.stage[name]||car.stage.all||null):null;
  if(stg)stg.classList.toggle('photo',!!src);
  if(src){if(curPhoto!==src){curPhoto=src;photoTo(src)}return;}
  curPhoto='';
  if(!svg||!CAMS[name]||name===curCam)return;
  curCam=name;
  const t=CAMS[name],to=t.vb,from=camVB.slice();
  const hot=$('camHot');
  if(hot){
    if(t.hot){hot.setAttribute('cx',t.hot[0]);hot.setAttribute('cy',t.hot[1]);hot.setAttribute('rx',t.hot[2]);hot.setAttribute('ry',t.hot[3]);hot.style.opacity='1';}
    else hot.style.opacity='0';
  }
  cancelAnimationFrame(camAnim);
  let reduce=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  if(reduce){camVB=to.slice();svg.setAttribute('viewBox',to.join(' '));return;}
  const t0=performance.now(),dur=650;
  const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
  const step=now=>{
    const k=Math.min(1,(now-t0)/dur),e=ease(k);
    camVB=from.map((v,i)=>v+(to[i]-v)*e);
    svg.setAttribute('viewBox',camVB.join(' '));
    if(k<1)camAnim=requestAnimationFrame(step);
  };
  camAnim=requestAnimationFrame(step);
}

function classFromPI(pi){
  return pi<=400?'D':pi<=500?'C':pi<=600?'B':pi<=700?'A':pi<=800?'S1':pi<=900?'S2':pi<=998?'R':'X';
}
function carNow(){return CARS.find(c=>c.id===$('carSel').value)||null}
function catOn(c){
  const t=(m,want)=>Object.keys(m).every(k=>{const ix=partSel[k];return (m[k]||[]).some(v=>v===-1?(ix===undefined||ix<0):ix===v)===want});
  if(c.showIf&&!t(c.showIf,true))return false;
  if(c.hideIf&&c.hideIf&&Object.keys(c.hideIf).some(k=>(c.hideIf[k]||[]).some(v=>partSel[k]===v)))return false;
  return true;
}
function optDpi(car,o){return o.dpi!==undefined?o.dpi:o.pi-car.pi}
function allCats(car){return GROUPS.reduce((a,g)=>a.concat(Array.isArray(car[g.id])?car[g.id].filter(catOn):[]),[])}
function unlockedTuning(car){
  const u={};
  allCats(car).forEach(cat=>{
    const ix=partSel[cat.k];
    if(ix!==undefined&&ix>=0&&cat.opts[ix]&&cat.opts[ix].unlock)u[cat.opts[ix].unlock]=true;
  });
  return u;
}
const NEED={
  springs:'muelles y amortiguadores de carreras, rally o derrape',
  brakes:'frenos de carreras',
  arbF:'barras estabilizadoras delanteras de carreras',
  arbR:'barras estabilizadoras traseras de carreras',
  gears:'una transmisión deportiva (relación final) o de carreras (todas las marchas)',
  diff:'un diferencial deportivo (solo aceleración) o de carreras, rally, derrape o todoterreno (completo)'
};
function lockMsg(title,lk){
  if(!lk)return '';
  if(title==='Aerodinámica'){
    const m=[];
    if(!lk.aeroF)m.push('la carga delantera necesita un parachoques delantero de competencia');
    if(!lk.aeroR)m.push('la carga trasera necesita un alerón trasero de competencia');
    return m.length?'<div class="banner">Con las piezas que elegiste en la pestaña Piezas: '+m.join('; ')+'.</div>':'';
  }
  const need=[];
  if(title==='Alineación'||title==='Muelles'||title==='Amortiguación'){if(!lk.springs)need.push(NEED.springs)}
  else if(title==='Barras estabilizadoras'){if(!lk.arbF)need.push(NEED.arbF);if(!lk.arbR)need.push(NEED.arbR)}
  else if(title==='Frenos'){if(!lk.brakes)need.push(NEED.brakes)}
  else if(title==='Diferencial'){if(!lk.diffAccel&&!lk.diffFull)need.push(NEED.diff)}
  else if(title==='Marchas'){if(!lk.gearFinal&&!lk.gears)need.push(NEED.gears)}
  if(title==='Diferencial'&&!need.length&&lk.diffAccel&&!lk.diffFull)return '<div class="banner">Con el diferencial deportivo solo puedes ajustar la aceleración. Para ajustar también la deceleración necesitas uno de carreras, rally, derrape o todoterreno.</div>';
  if(!need.length)return '';
  return '<div class="banner">Con las piezas que elegiste en la pestaña Piezas, este ajuste sigue bloqueado en el juego. Para desbloquearlo necesitas: '+need.join(' y ')+'.</div>';
}
function springHint(){
  const u=$('use').value;
  const rec={road:'carreras',street:'deportivos',dirt:'rally',cross:'rally',drift:'derrape',drag:'carreras'}[u];
  const txt=$('use').selectedOptions[0].textContent.toLowerCase();
  return '<p class="why">Para tu uso actual ('+txt+') la opción que mejor encaja es «'+rec+'». Solo carreras, rally y derrape desbloquean el ajuste de muelles, amortiguación y alineación.</p>';
}
function swapOn(car){
  const c=(car.conv||[]).find(x=>x.k==='swap');
  const ix=c?partSel.swap:undefined;
  return ix!==undefined&&ix>=0&&c.opts[ix]?c.opts[ix]:null;
}
function partTotals(car){
  let hp=0,dpi=0,cr=0,kg=0,fr=0;
  const sw=swapOn(car);
  allCats(car).forEach(cat=>{
    if(sw&&car.engine.indexOf(cat)>=0&&!(cat.showIf&&cat.showIf.swap))return;
    const ix=partSel[cat.k];
    if(ix!==undefined&&ix>=0&&cat.opts[ix]){const o=cat.opts[ix];hp+=o.hp||0;kg+=o.kg||0;fr+=o.front||0;dpi+=optDpi(car,o);cr+=o.cr;}
  });
  kg+=Number(partSel.rimKg)||0;
  return {hp:hp,front:fr,kg:Math.round(kg*10)/10,pi:Math.min(999,car.pi+dpi),cr:cr};
}
/* Rangos fijos que traen algunas piezas (muelles de carreras, carga aerodinámica de competencia...). */
const RNG_IDS={kF:['kFmin','kFmax','k'],kR:['kRmin','kRmax','k'],aF:['aFmin','aFmax','w'],aR:['aRmin','aRmax','w'],hF:['hFmin','hFmax','h'],hR:['hRmin','hRmax','h'],ab:['abMin','abMax',null],rb:['rbMin','rbMax',null],cp:['cpMin','cpMax',null]};
const RNG_DEF={kF:[4,45],kR:[4,45],aF:[40,140],aR:[80,280],hF:[8,18],hR:[8,18],ab:[1,65],rb:[1,20],cp:[1,20]};
const RNG_TXT={kF:'muelles del.',kR:'muelles tras.',aF:'carga del.',aR:'carga tras.',hF:'altura del.',hR:'altura tras.',ab:'barras',rb:'rebote',cp:'compresión'};
let appliedRng={};
function showRng(t,v){
  if(t==='k')return String(kRound(v*KF[kUnit]));
  if(t==='w')return String(units==='imperial'?Math.round(v*FAC.w):Math.round(v*100)/100);
  if(t==='h')return String(Math.round((units==='imperial'?v*FAC.h:v)*100)/100);
  return String(v);
}
function applyCarRanges(car){
  /* Rangos propios del coche: valen con cualquier pieza. Quedan editables en «Rangos de los controles». */
  const r=car&&car.rng;if(!r)return;
  Object.keys(RNG_IDS).forEach(k=>{
    if(!r[k])return;
    const [i0,i1,t]=RNG_IDS[k];
    const f=r[k].map(v=>t==='k'?v/KF[r.unit||'kgf']:v);
    $(i0).value=showRng(t,f[0]);$(i1).value=showRng(t,f[1]);
  });
}
function applyPartRanges(car){
  const note=$('rngSrc'),want={},src=[];
  allCats(car).forEach(cat=>{
    const ix=partSel[cat.k],o=ix!==undefined&&ix>=0?cat.opts[ix]:null;
    if(!o||!o.rng)return;
    const r=o.rng,txt=[];
    if(r.unit&&KF[r.unit]&&(r.kF||r.kR)&&kUnit!==r.unit)setKUnit(r.unit,true);
    Object.keys(RNG_IDS).forEach(k=>{
      if(!r[k])return;
      const f=r[k].map(v=>RNG_IDS[k][2]==='k'?v/KF[r.unit||'kgf']:v);
      want[k]=f;
      txt.push(RNG_TXT[k]+' '+r[k][0]+' a '+r[k][1]+(RNG_IDS[k][2]==='k'?' '+KU[r.unit||'kgf']:''));
    });
    src.push('«'+o.n+'» ('+txt.join(', ')+')');
  });
  Object.keys(RNG_IDS).forEach(k=>{
    const [i0,i1,t]=RNG_IDS[k],v=want[k]||(appliedRng[k]?((car.rng&&car.rng[k])||RNG_DEF[k]):null);
    if(!v)return;
    $(i0).value=showRng(t,v[0]);$(i1).value=showRng(t,v[1]);
    appliedRng[k]=!!want[k];
  });
  if(note){
    note.hidden=!src.length;
    note.textContent=src.length?('Rangos fijos de las piezas instaladas: '+src.join('; ')+'. Cambian si instalas otra pieza.'):'';
  }
}
function applyPartsToInputs(){
  const car=carNow();if(!car)return;
  applyPartRanges(car);
  const t=partTotals(car);
  $('hp').value=car.hp+t.hp;
  const w=Math.round((car.weight+t.kg)*10)/10;
  $('weight').value=units==='imperial'?Math.round(w*FAC.w):w;
  $('cls').value=classFromPI(t.pi);
  $('front').value=car.front+t.front;
  const dsw=(car.conv||[]).find(c=>c.k==='drivetrainSwap');
  const dsi=dsw?partSel.drivetrainSwap:undefined;
  $('drive').value=dsw&&dsi!==undefined&&dsi>=0&&dsw.opts[dsi]?dsw.opts[dsi].drive:car.drive;
  const wc=(car.wheels||[]).find(c=>c.k==='tires');
  if(wc){const ti=partSel.tires;$('tire').value=ti!==undefined&&ti>=0&&wc.opts[ti]?wc.opts[ti].tire:'street';}
  if(Array.isArray(car.aero)&&car.aero.length){
    const u=unlockedTuning(car);
    $('aero').value=u.aeroF&&u.aeroR?'both':u.aeroR?'rear':u.aeroF?'front':'none';
  }
}
function pibHtml(pi){
  const c=classFromPI(pi);
  return '<span class="pib"><span class="cb" data-c="'+c+'">'+c+'</span><b>'+pi+'</b></span>';
}
function summaryHtml(car){
  const t=partTotals(car);
  return '<div class="strip">'
    +'<div><small>PI estimado</small><b>'+pibHtml(t.pi)+'</b></div>'
    +'<div><small>Potencia</small><b>'+(car.hp+t.hp)+' hp</b></div>'
    +'<div><small>Peso</small><b>'+(Math.round((car.weight+t.kg)*10)/10)+' kg</b></div>'
    +'<div><small>Coste mejoras</small><b>'+fmt(t.cr)+' CR</b></div></div>';
}
function baseHtml(car){
  const dl={rwd:'Trasera',fwd:'Delantera',awd:'Total'}[car.drive];
  let h='<div class="strip">'
    +'<div><small>De serie</small><b>'+pibHtml(car.pi)+'</b></div>'
    +'<div><small>Potencia</small><b>'+car.hp+' hp</b></div>'
    +'<div><small>Par</small><b>'+car.torque+' N m</b></div>'
    +'<div><small>Peso</small><b>'+car.weight+' kg</b></div>'
    +'<div><small>Reparto</small><b>'+car.front+'/'+(100-car.front)+'</b></div>'
    +'<div><small>Tracción</small><b>'+dl+'</b></div></div>';
  let x='<div><small>Cilindrada</small><b>'+car.disp.toFixed(2)+' l</b></div>';
  if(car.perf){
    const p=car.perf;
    x+='<div><small>Vel. máxima</small><b>'+p.top.toFixed(1)+' km/h</b></div>'
      +'<div><small>0 a 97 km/h</small><b>'+p.a97.toFixed(3)+' s</b></div>'
      +'<div><small>0 a 161 km/h</small><b>'+p.a161.toFixed(3)+' s</b></div>'
      +'<div><small>Frenada 97 a 0</small><b>'+p.brk97.toFixed(1)+' m</b></div>'
      +'<div><small>Frenada 161 a 0</small><b>'+p.brk161.toFixed(1)+' m</b></div>'
      +'<div><small>G laterales 97 km/h</small><b>'+p.g97.toFixed(2)+'</b></div>'
      +'<div><small>Presión de serie</small><b>'+p.tire.toFixed(1)+' bar</b></div>';
  }
  return h+'<div class="strip">'+x+'</div>';
}
function effText(o){
  if(o.fx)return o.fx;
  if(o.kg)return (o.kg>0?'+':'')+o.kg+' kg';
  if(o.hp===null)return '+? hp';
  return '+'+(o.hp||0)+' hp';
}
function detailHtml(car,o){
  if(!o)return '<div class="dl"><span>Pieza de serie</span><b>Sin cambios</b></div>';
  const L=[];
  const add=(t,v,cls)=>L.push('<div class="dl"><span>'+t+'</span><b class="'+(cls||'')+'">'+v+'</b></div>');
  if(o.hp)add('Potencia','+'+o.hp+' hp','up');
  else if(o.hp===null)add('Potencia','por confirmar','');
  if(o.kg)add('Peso',(o.kg>0?'+':'')+o.kg+' kg',o.kg<0?'up':'dn');
  if(o.front)add('Peso delantero','+'+o.front+' %','');
  if(o.fx)add('Efecto',esc(o.fx),'');
  const d=optDpi(car,o);
  add('PI',(d>=0?'+':'')+d,'');
  if(o.unlock)add('Desbloquea',UNLOCK_TXT[o.unlock]||'un ajuste en el juego','up');
  return L.join('');
}
function curCat(car){
  const g=GROUPS.find(x=>x.id===shopPath.g)||null;
  const cats=g&&Array.isArray(car[g.id])?car[g.id].filter(catOn):[];
  const cat=g&&shopPath.c?(cats.find(x=>x.k===shopPath.c)||null):null;
  return {g:g,cats:cats,cat:cat};
}
function catCam(c,g){return c.cam||CAT_CAM[c.k]||(g&&GROUP_CAM[g.id])||'all'}
function camFor(car){
  const s=curCat(car);
  if(s.cat)return catCam(s.cat,s.g);
  if(s.g)return GROUP_CAM[s.g.id]||'all';
  return 'all';
}
function tileOpt(cat,g,ix,name,meta,on){
  return '<button type="button" class="tile" data-act="opt" data-c="'+esc(cat.k)+'" data-i="'+ix+'" data-cam="'+catCam(cat,g)+'" aria-pressed="'+on+'">'
    +'<span>'+esc(name)+'</span><span class="mt">'+esc(meta)+'</span>'+(on?'<span class="tag">Instalado</span>':'')+'</button>';
}
function renderParts(focusSel){
  const shop=$('shop'),car=carNow();
  if(!shop)return;
  $('stageTag').textContent=car?(car.year+' '+car.maker+' '+car.name):'Sin coche elegido';
  if(!car){
    shop.innerHTML='<div class="bar"><h2>Tienda de mejoras</h2></div><p class="shopmsg">'
      +(loadMsg||'Elige un coche de la lista en la pestaña Reglajes. Aquí verás sus mejoras y cómo cambian la potencia, el peso y la clase.')+'</p>';
    camTo('all');
    return;
  }
  const s=curCat(car),g=s.g,cat=s.cat;
  const title=cat?cat.n:(g?g.n:'Tienda de mejoras');
  let h='<div class="bar">'+(g?'<button type="button" class="back" data-act="back">‹ Atrás</button>':'')+'<h2>'+esc(title)+'</h2></div>';
  if(!g){
    h+='<div class="tiles">';
    GROUPS.forEach(x=>{
      const list=car[x.id];
      if(Array.isArray(list)&&list.length){
        const n=list.filter(c=>catOn(c)&&partSel[c.k]!==undefined&&partSel[c.k]>=0).length;
        h+='<button type="button" class="tile" data-act="group" data-g="'+x.id+'" data-cam="'+(GROUP_CAM[x.id]||'all')+'">'+GICON[x.id]+'<span>'+x.n+'</span>'
          +(n?'<span class="tag">'+n+(n>1?' instaladas':' instalada')+'</span>':'')+'</button>';
      }else{
        h+='<div class="tile off" aria-disabled="true">'+GICON[x.id]+'<span>'+x.n+'</span><span class="mt">Por cargar</span></div>';
      }
    });
    h+='</div>';
    h+=baseHtml(car);
  }else if(!cat){
    if(g.id==='engine'&&swapOn(car)&&!swapOn(car).ownParts)h+='<div class="hintbox"><p class="why">Tienes un motor cambiado. Las mejoras del motor de serie no se cuentan mientras esté instalado, porque el juego las reinicia al cambiar de motor. Quita el motor cambiado en Kits y conversiones para volver a usarlas.</p></div>';
    if(g.id==='drivetrain'&&partSel.drivetrainSwap>=0)h+='<div class="hintbox"><p class="why">Tienes un cambio de tren motriz instalado. El juego avisa de que algunas mejoras del tren motriz actual no se aplican al nuevo, y las capturas no dicen cuáles. Comprueba en el juego qué piezas se conservan.</p></div>';
    h+='<div class="tiles">';
    s.cats.forEach(c=>{
      const ix=partSel[c.k]===undefined?-1:partSel[c.k];
      let nm=ix>=0&&c.opts[ix]?c.opts[ix].n:'De serie';
      let on=ix>=0;
      if(c.custom==='rimkg'){const v=Number(partSel.rimKg)||0;on=!!v;nm=v?((v>0?'+':'')+v+' kg'):'De serie';}
      h+='<button type="button" class="tile" data-act="cat" data-c="'+esc(c.k)+'" data-cam="'+catCam(c,g)+'"><span>'+esc(c.n)+'</span><span class="mt">'+esc(nm)+'</span>'
        +(on?'<span class="tag">Mejorada</span>':'')+'</button>';
    });
    h+='</div>';
  }else if(cat.custom==='rimkg'){
    h+='<div class="hintbox"><p class="why">Hay demasiados rines para listarlos. Escribe el cambio total de peso del juego de rines que montas respecto al de serie: negativo si pesan menos, positivo si pesan más. Se suma al peso del coche en Reglajes.</p></div>';
    h+='<div class="detail"><label>Cambio de peso de los rines (kg)<input type="number" id="rimKg" step="0.1" inputmode="decimal" value="'+(Number(partSel.rimKg)||0)+'"></label></div>';
  }else{
    const cur=partSel[cat.k]===undefined?-1:partSel[cat.k];
    if(cat.k==='springs')h+='<div class="hintbox">'+springHint()+'</div>';
    h+='<div class="tiles">';
    h+=tileOpt(cat,g,-1,'De serie','Sin cambios',cur===-1);
    cat.opts.forEach((o,ix)=>{h+=tileOpt(cat,g,ix,o.n,effText(o),cur===ix)});
    h+='</div>';
    const o=cur>=0?cat.opts[cur]:null;
    h+='<div class="lime"><span>'+esc(cat.n)+(o?' · '+esc(o.n):' de serie')+'</span><span class="coin">'+fmt(o?o.cr:0)+'</span></div>';
    h+='<div class="detail">'+detailHtml(car,o)+'</div>';
  }
  h+='<div class="sum"><div id="partsSum">'+summaryHtml(car)+'</div>';
  h+='<p class="hints">La potencia, el peso y la clase de la pestaña Reglajes se actualizan solos. El PI es una estimación: suma cada mejora por separado, y el real del juego puede variar unos puntos. Pasa el cursor o enfoca una pieza para mover la cámara.</p>';
  h+='<div class="actions"><button type="button" class="btn ghost" data-act="reset">Quitar todas las mejoras</button></div>';
  if(car.notes)car.notes.forEach(n=>{h+='<div class="banner">'+esc(n)+'</div>'});
  if(car.missing&&car.missing.length)h+='<div class="banner">Faltan por cargar: '+car.missing.map(esc).join(', ')+'.</div>';
  h+='</div>';
  shop.innerHTML=h;
  if(focusSel){const el=shop.querySelector(focusSel);if(el)el.focus({preventScroll:true});}
  camTo(camFor(car));
}
function onCarChange(){
  const car=carNow();
  partSel={};
  shopPath={g:null,c:null};
  if(car){
    $('carName').value=car.year+' '+car.maker+' '+car.name;
    $('drive').value=car.drive;
    $('weight').value=units==='imperial'?Math.round(car.weight*FAC.w):car.weight;
    $('front').value=car.front;
    if(car.perf)$('topNow').value=units==='imperial'?Math.round(car.perf.top*FAC.s):car.perf.top;
    appliedRng={};applyCarRanges(car);
    applyPartsToInputs();
  }
  renderParts();updatePickLabel();
}
function fillCarSel(){
  const sel=$('carSel'),cur=sel.value;
  sel.innerHTML='<option value="">Personalizado</option>'
    +CARS.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.year+' '+c.maker+' '+c.name)+'</option>').join('');
  if(cur&&CARS.some(c=>c.id===cur))sel.value=cur;
  updatePickLabel();
}
async function loadCars(){
  try{
    const r=await fetch('data/index.json',{cache:'no-cache'});
    if(!r.ok)throw new Error('index '+r.status);
    const idx=await r.json();
    const res=await Promise.allSettled((idx.cars||[]).map(f=>
      fetch('data/cars/'+f,{cache:'no-cache'}).then(x=>{if(!x.ok)throw new Error(f);return x.json()})));
    CARS=res.filter(x=>x.status==='fulfilled').map(x=>x.value);
    const bad=res.length-CARS.length;
    loadMsg=bad?('No se pudieron leer '+bad+' archivo(s) de coches. Revisa data/index.json.'):'';
  }catch(e){
    CARS=[];
    loadMsg='No se pudieron cargar los coches. La calculadora funciona en modo personalizado. Revisa que la carpeta data esté publicada junto a la página.';
  }
  fillCarSel();
  renderParts();
}
/* ---------- Selector de coche por marca ---------- */
let pickBrand=null;
const RAR={'común':'comun','comun':'comun','raro':'raro','épico':'epico','epico':'epico','legendario':'legendario'};
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function updatePickLabel(){
  const c=carNow(),t=$('carPickTxt');
  if(t)t.textContent=c?(c.year+' '+c.maker+' '+c.name):'Personalizado';
}
function renderPicker(){
  const body=$('pickBody'),title=$('pickTitle');
  if(!pickBrand){
    title.textContent='Marca';body.className='pickBody';
    const by={};CARS.forEach(c=>{(by[c.maker]=by[c.maker]||[]).push(c)});
    let h='<button type="button" class="btile plain" data-pick="">Personalizado<span class="bn">Sin coche de la lista</span></button>';
    Object.keys(by).sort((a,b)=>a.localeCompare(b,'es')).forEach(m=>{
      h+='<button type="button" class="btile" data-brand="'+esc(m)+'"><img src="data/brands/'+slug(m)+'.png" alt=""><span class="bname">'+esc(m)+'</span>'
        +'<span class="bn">'+by[m].length+(by[m].length>1?' coches':' coche')+'</span></button>';
    });
    if(!CARS.length)h+='<p style="grid-column:1/-1;color:var(--muted)">'+esc(loadMsg||'Aún no hay coches cargados.')+'</p>';
    body.innerHTML=h;
  }else{
    title.textContent=pickBrand;body.className='pickBody cars';
    const list=CARS.filter(c=>c.maker===pickBrand).sort((a,b)=>(a.name+a.year).localeCompare(b.name+b.year,'es'));
    body.innerHTML=list.map(c=>{
      const full=c.year+' '+c.maker+' '+c.name;
      if(c.img)return '<button type="button" class="ccard img" data-pick="'+esc(c.id)+'" aria-label="'+esc(full+', '+c.rarity+', clase '+classFromPI(c.pi)+' '+c.pi)+'"><img src="'+esc(c.img)+'" alt=""></button>';
      return '<button type="button" class="ccard" data-pick="'+esc(c.id)+'" aria-label="'+esc(full)+'"><b class="cn">'+esc(c.name)+'</b><span class="cy">'+esc(c.year+' '+String(c.maker).toUpperCase())+'</span>'
        +'<span class="cph">Sin imagen</span><span class="cbar r-'+(RAR[String(c.rarity||'').toLowerCase()]||'comun')+'"><span>'+esc(c.rarity||'')+'</span>'+pibHtml(c.pi)+'</span></button>';
    }).join('');
  }
  body.scrollTop=0;
}
function openPicker(){
  pickBrand=null;renderPicker();
  $('picker').hidden=false;document.body.classList.add('pickOpen');
  $('pickClose').focus();
}
function closePicker(){
  $('picker').hidden=true;document.body.classList.remove('pickOpen');
  const b=$('carPick');if(b)b.focus();
}
function initPicker(){
  $('carPick').addEventListener('click',openPicker);
  $('pickClose').addEventListener('click',closePicker);
  $('pickBack').addEventListener('click',()=>{if(pickBrand){pickBrand=null;renderPicker()}else closePicker()});
  $('pickBody').addEventListener('click',e=>{
    const b=e.target.closest('[data-brand],[data-pick]');if(!b)return;
    if(b.dataset.brand!==undefined){pickBrand=b.dataset.brand;renderPicker();$('pickBack').focus();return;}
    const sel=$('carSel');sel.value=b.dataset.pick;
    sel.dispatchEvent(new Event('change'));
    closePicker();
  });
  $('pickBody').addEventListener('error',e=>{
    const t=e.target;if(t&&t.tagName==='IMG'){const b=t.closest('.btile');if(b)b.classList.add('nologo');t.remove();}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('picker').hidden)closePicker()});
}
function initCars(){
  initPicker();
  const box=$('partsBox');
  $('carSel').addEventListener('change',onCarChange);
  $('use').addEventListener('change',()=>{if(carNow())renderParts()});
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]');
    if(!b||!box.contains(b))return;
    const a=b.dataset.act;let sel=null;
    if(a==='group'){shopPath={g:b.dataset.g,c:null};}
    else if(a==='cat'){shopPath.c=b.dataset.c;}
    else if(a==='back'){if(shopPath.c)shopPath.c=null;else shopPath={g:null,c:null};}
    else if(a==='opt'){
      partSel[b.dataset.c]=parseInt(b.dataset.i,10);
      GROUPS.forEach(g=>{(carNow()[g.id]||[]).forEach(c=>{if(!catOn(c))delete partSel[c.k]})});
      applyPartsToInputs();render();
      sel='[data-act="opt"][data-c="'+b.dataset.c+'"][data-i="'+b.dataset.i+'"]';
    }else if(a==='reset'){partSel={};applyPartsToInputs();render();}
    renderParts(sel);
  });
  box.addEventListener('input',e=>{
    if(!e.target||e.target.id!=='rimKg')return;
    const v=parseFloat(e.target.value);
    partSel.rimKg=Number.isFinite(v)?v:0;
    applyPartsToInputs();
    const c=carNow();if(c)$('partsSum').innerHTML=summaryHtml(c);
    render();
  });
  box.addEventListener('mouseover',e=>{const t=e.target.closest('.tile[data-cam]');if(t)camTo(t.dataset.cam)});
  box.addEventListener('focusin',e=>{const t=e.target.closest('.tile[data-cam]');if(t)camTo(t.dataset.cam)});
  $('shop').addEventListener('mouseleave',()=>{const c=carNow();camTo(c?camFor(c):'all')});
  fillCarSel();
  renderParts();
  loadCars();
}

/* ---------- Diagnóstico ---------- */
const DIAG=[
  {c:'Subviraje',t:'No gira al entrar en la curva',w:'El eje delantero pierde agarre antes que el trasero.',f:['Baja la rigidez de la barra delantera.','Sube la rigidez de la barra trasera.','Pon más convergencia hacia fuera en el eje delantero.','Sube la caída negativa delantera.','Mueve el balance de frenos hacia atrás un punto.']},
  {c:'Subviraje',t:'Se abre a mitad de curva',w:'Falta agarre delantero con carga lateral sostenida.',f:['Ablanda los muelles delanteros o endurece los traseros.','Sube la carga aerodinámica delantera.','Baja la presión delantera de los neumáticos 0,05 bar.','Revisa la altura: demasiado alta delante reduce el agarre.']},
  {c:'Subviraje',t:'Se abre al acelerar a la salida',w:'El diferencial o el reparto empujan el coche recto.',f:['Baja el bloqueo de aceleración del diferencial.','En AWD, mueve el reparto central hacia atrás.','Ablanda la barra trasera para que ayude a rotar.','Espera a abrir el volante antes de dar gas a fondo.']},
  {c:'Sobreviraje',t:'La trasera se va al entrar',w:'El eje trasero pierde agarre al soltar el acelerador o frenar.',f:['Sube el bloqueo de deceleración del diferencial.','Mueve el balance de frenos hacia delante.','Ablanda la barra trasera y endurece la delantera.','Sube la carga aerodinámica trasera.']},
  {c:'Sobreviraje',t:'La trasera se va al dar gas (RWD)',w:'Más potencia que agarre trasero.',f:['Baja el bloqueo de aceleración.','Ablanda muelles y barra traseros.','Sube la presión trasera un poco si el neumático se deforma.','Sube la altura trasera o la carga aerodinámica trasera.']},
  {c:'Sobreviraje',t:'Inestable en rectas rápidas',w:'Falta carga o convergencia trasera a alta velocidad.',f:['Sube la carga aerodinámica trasera.','Pon algo más de convergencia hacia dentro en la trasera.','Baja la altura trasera con cuidado, sin llegar a tocar el suelo.']},
  {c:'Frenos',t:'Se bloquean las ruedas delanteras',w:'Demasiada presión o demasiado peso al frente.',f:['Baja la presión de freno.','Mueve el balance hacia atrás.','Endurece el rebote delantero para frenar la transferencia de peso.']},
  {c:'Frenos',t:'La trasera se descontrola al frenar',w:'Balance demasiado hacia atrás.',f:['Mueve el balance hacia delante.','Sube el bloqueo de deceleración.','Endurece la compresión trasera un punto.']},
  {c:'Suspensión',t:'Rebota en bordillos y baches',w:'Muelles o compresión demasiado duros para el terreno.',f:['Baja la compresión.','Ablanda los muelles.','Sube la altura para ganar recorrido.']},
  {c:'Suspensión',t:'Balancea demasiado',w:'La caja se mueve más de lo que aguantan las ruedas.',f:['Sube la rigidez de las barras.','Endurece los muelles y el rebote juntos.','Baja la altura un poco.']},
  {c:'Suspensión',t:'Salta y pierde contacto con el suelo',w:'El rebote deja libre el muelle demasiado rápido.',f:['Sube el rebote.','Baja la rigidez de muelles si el terreno es irregular.']},
  {c:'Tracción',t:'Patina al arrancar (drag o salida lenta)',w:'Poca presión sobre las ruedas motrices.',f:['Baja la presión de los neumáticos traseros en RWD.','Ablanda los muelles traseros y endurece los delanteros para transferir peso.','Mueve el reparto central hacia atrás en AWD.','Revisa que las marchas no sean demasiado cortas en primera.']},
  {c:'Tracción',t:'Pierde tracción en tierra',w:'Neumáticos demasiado duros o suspensión rígida.',f:['Baja la presión 1 a 2 psi.','Ablanda muelles y barras.','Sube la altura.','Baja el bloqueo de aceleración.']},
  {c:'Tracción',t:'Dirección pesada o vaga',w:'Ángulo de avance o presión delantera fuera de punto.',f:['Baja el avance si es pesada, súbelo si es vaga.','Revisa la presión delantera.','Comprueba la caída delantera.']}
];
let diagCat='Todos';
function renderDiag(){
  const cats=['Todos'].concat(Array.from(new Set(DIAG.map(d=>d.c))));
  $('diagChips').innerHTML=cats.map(c=>'<button type="button" data-c="'+c+'" aria-pressed="'+(c===diagCat)+'">'+c+'</button>').join('');
  $('diagList').innerHTML=DIAG.filter(d=>diagCat==='Todos'||d.c===diagCat).map(d=>
    '<article class="card"><span class="tag">'+d.c+'</span><h3>'+d.t+'</h3><p class="why">'+d.w+'</p><ol>'+d.f.map(f=>'<li>'+f+'</li>').join('')+'</ol></article>').join('');
}

/* ---------- Perfiles ---------- */
const KEY='bancoReglajes.perfiles.v1';
let profiles=[];
function loadProfiles(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');profiles=Array.isArray(r)?r:[]}catch(e){profiles=[]}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(profiles));return true}catch(e){return false}}
function collect(){
  const d={};
  FIELDS.forEach(id=>{d[id]=$(id).value});
  d.aero=$('aero').value;
  d.carId=$('carSel').value;
  d.parts=JSON.stringify(partSel);
  return {units:units,data:d};
}
function applyProfile(p){
  units=p.units==='imperial'?'imperial':'metric';
  const pd=p.data||{};
  if(pd.hMin!==undefined&&pd.hFmin===undefined){pd.hFmin=pd.hRmin=pd.hMin;pd.hFmax=pd.hRmax=pd.hMax}
  if(!KF[pd.kUnit])pd.kUnit=units==='imperial'?'lb':'kgf';
  kUnit=pd.kUnit;$('kUnit').value=kUnit;
  refreshLabels();
  FIELDS.forEach(id=>{if(pd[id]!==undefined)$(id).value=pd[id]});
  kUnit=$('kUnit').value;appliedRng={};
  $('carSel').value=(p.data&&p.data.carId)||'';
  try{partSel=p.data&&p.data.parts?JSON.parse(p.data.parts):{}}catch(e){partSel={}}
  renderParts();
  if(p.data&&p.data.aero!==undefined){
    const a=p.data.aero===true?'both':(p.data.aero===false?'none':p.data.aero);
    $('aero').value=['both','rear','front','none'].indexOf(a)>=0?a:'both';
  }
  render();
}
function renderProfiles(){
  const el=$('profList');
  if(!profiles.length){el.innerHTML='<p class="empty">Aún no hay perfiles. Configura un coche en Reglajes y pulsa Guardar perfil.</p>';return;}
  el.innerHTML='';
  profiles.forEach((p,n)=>{
    const d=p.data||{};
    const row=document.createElement('div');row.className='pitem';
    const nm=document.createElement('span');nm.className='nm';nm.textContent=p.name;
    const bt=document.createElement('span');bt.className='bt';
    const lo=document.createElement('button');lo.type='button';lo.className='btn';lo.textContent='Cargar';
    lo.addEventListener('click',()=>{applyProfile(p);selectTab('tabCalc');$('saveStatus').textContent='Perfil cargado';});
    const de=document.createElement('button');de.type='button';de.className='btn danger';de.textContent='Borrar';
    let armed=false;
    de.addEventListener('click',()=>{
      if(!armed){armed=true;de.textContent='Confirmar';setTimeout(()=>{armed=false;de.textContent='Borrar'},3000);return;}
      profiles.splice(n,1);persist();renderProfiles();
    });
    bt.append(lo,de);
    const mt=document.createElement('span');mt.className='mt';
    const useTxt={road:'Circuito',street:'Calle',dirt:'Tierra',cross:'Cross country',drift:'Drift',drag:'Drag'}[d.use]||'';
    mt.textContent='Clase '+(d.cls||'?')+' · '+String(d.drive||'').toUpperCase()+' · '+useTxt+' · '+(p.saved||'');
    row.append(nm,bt,mt);el.appendChild(row);
  });
}
function saveProfile(){
  const name=$('carName').value.trim()||('Coche '+(profiles.length+1));
  const c=collect();
  const item={name:name,units:c.units,data:c.data,saved:new Date().toLocaleDateString('es')};
  const at=profiles.findIndex(p=>p.name===name);
  if(at>=0)profiles[at]=item;else profiles.push(item);
  const ok=persist();
  $('saveStatus').textContent=ok?'Guardado: '+name:'Guardado solo en esta sesión. Usa Exportar para no perderlo.';
  renderProfiles();
}

/* ---------- Pestañas ---------- */
function selectTab(id){
  [['tabCalc','pCalc'],['tabDiag','pDiag'],['tabParts','pParts'],['tabProf','pProf']].forEach(([t,p])=>{
    $(t).setAttribute('aria-selected',String(t===id));
    $(p).hidden=t!==id;
  });
}

/* ---------- Arranque ---------- */
document.addEventListener('DOMContentLoaded',()=>{});
['tabCalc','tabDiag','tabParts','tabProf'].forEach(id=>$(id).addEventListener('click',()=>selectTab(id)));
$('uMetric').addEventListener('click',()=>{setUnits('metric',true);render()});
$('uImp').addEventListener('click',()=>{setUnits('imperial',true);render()});
$('kUnit').addEventListener('change',()=>{setKUnit($('kUnit').value,true);render()});
$('form').addEventListener('input',render);
$('form').addEventListener('change',render);
$('saveBtn').addEventListener('click',saveProfile);
$('diagChips').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;diagCat=b.dataset.c;renderDiag()});
$('exportBtn').addEventListener('click',()=>{$('ioBox').value=JSON.stringify(profiles,null,1);$('profStatus').textContent='Listo para copiar.'});
$('copyIoBtn').addEventListener('click',()=>{if(!$('ioBox').value)$('ioBox').value=JSON.stringify(profiles,null,1);copyText($('ioBox').value,'profStatus','Texto copiado')});
$('importBtn').addEventListener('click',()=>{
  try{
    const r=JSON.parse($('ioBox').value);
    if(!Array.isArray(r))throw new Error('formato');
    let n=0;
    r.forEach(p=>{
      if(p&&typeof p.name==='string'&&p.data&&typeof p.data==='object'){
        const at=profiles.findIndex(q=>q.name===p.name);
        const item={name:p.name,units:p.units==='imperial'?'imperial':'metric',data:p.data,saved:p.saved||''};
        if(at>=0)profiles[at]=item;else profiles.push(item);
        n++;
      }
    });
    persist();renderProfiles();
    $('profStatus').textContent=n?('Importados '+n+' perfiles.'):'No se encontró ningún perfil válido en el texto.';
  }catch(e){$('profStatus').textContent='El texto no tiene el formato esperado. Pega lo que copiaste con Exportar.'}
});

loadProfiles();
refreshLabels();
initCars();
renderDiag();
renderProfiles();
render();

/* ---------- Funciona sin conexión (service worker) ---------- */
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});
}
