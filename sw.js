const CACHE='disb-gestao-v1.7.0-push-diagnostico4';
const STATIC=['./','index.html','styles.css?v=1.7.0-push-diagnostico4','app.js?v=1.7.0-push-diagnostico4','config.js?v=1.7.0','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png'];

self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.hostname.includes('supabase.co'))return;
  e.respondWith(
    fetch(e.request,{cache:'no-store'})
      .then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./')))
  );
});

// Web Push real: funciona mesmo com a PWA fechada, desde que o navegador/SO
// mantenha as notificacoes permitidas para este site.
self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json?.()||{};}catch(_e){try{payload={body:event.data?.text?.()||''};}catch(_e2){payload={};}}
  const title=String(payload.title||'Disb Gestão');
  const data=payload.data||{};
  const options={
    body:String(payload.body||'Nova atualização no Disb Gestão.'),
    icon:payload.icon||'assets/icon-192.png',
    badge:payload.badge||'assets/icon-192.png',
    tag:payload.tag||`disb-push-${data.request_id||Date.now()}`,
    renotify:true,
    data
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const view=String(event.notification?.data?.view||'');
  const url=`./${view?`?notificationView=${encodeURIComponent(view)}`:''}`;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{
    const client=list[0];
    if(client){
      await client.focus();
      client.postMessage({type:'DISB_OPEN_PUSH_NOTIFICATION',view});
      return;
    }
    if(self.clients.openWindow)return self.clients.openWindow(url);
  }));
});
