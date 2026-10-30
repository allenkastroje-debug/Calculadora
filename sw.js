/* Guarda la página para usarla sin conexión.
   Con conexión siempre intenta traer la versión más nueva; sin ella usa la guardada. */
const CACHE='banco-reglajes-v1';
const SHELL=['./','index.html','styles.css','js/app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','data/index.json'];
const slug=t=>String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function precacheData(c){
  try{
    const idx=await (await fetch('data/index.json',{cache:'no-cache'})).json();
    for(const f of (idx.cars||[])){
      const res=await fetch('data/cars/'+f,{cache:'no-cache'});
      await c.put('data/cars/'+f,res.clone());
      const car=await res.json();
      if(car.img)await c.add(car.img).catch(()=>{});
      for(const u of Object.values(car.stage||{}))await c.add(u).catch(()=>{});
      await c.add('data/brands/'+slug(car.maker)+'.png').catch(()=>{});
    }
  }catch(e){}
}
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(async c=>{await Promise.allSettled(SHELL.map(u=>c.add(u)));await precacheData(c)}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(
    fetch(r).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
      return res;
    }).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error())))
  );
});
