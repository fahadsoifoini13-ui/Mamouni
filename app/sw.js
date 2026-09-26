const CACHE="matbakh-v6-seasonal-identity-r1";
const ASSETS=["./","./index.html","./styles.css?v=v6-seasonal-identity-r1","./data-validation.js?v=v6-seasonal-identity-r1","./app.js?v=v6-seasonal-identity-r1","./manifest.webmanifest","./apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&(key.startsWith("matbakh-vdef-")||key.startsWith("matbakh-v5-")||key.startsWith("matbakh-v6-"))).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const appShell=url.pathname.endsWith("/")||/\.(html|js|css|webmanifest)$/.test(url.pathname);
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(appShell){
      try{
        const response=await fetch(event.request,{cache:"no-store"});
        if(response.ok)await cache.put(event.request,response.clone());
        return response;
      }catch(error){
        const fallback=await cache.match(event.request);
        if(fallback)return fallback;
        throw error;
      }
    }
    const cached=await cache.match(event.request);
    return cached||fetch(event.request);
  }));
});
