const CACHE="matbakh-v6-seasonal-test-v3";
const ASSETS=["./","./index.html","./styles.css?v=v6-seasonal-identity-r1","./data-validation.js?v=v6-seasonal-identity-r1","./app.js?v=v6-seasonal-identity-r1","./seasonal-test.css?v=seasonal-test-v3","./seasonal-test.js?v=seasonal-test-v3","./manifest.webmanifest","./apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&(key.startsWith("matbakh-vdef-")||key.startsWith("matbakh-v5-")||key.startsWith("matbakh-v6-")||key.startsWith("matbakh-v6-seasonal-test-") )).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function seasonalHtmlResponse(request){
  const response=await fetch(request,{cache:"no-store"});
  if(!response.ok)return response;
  const url=new URL(request.url);
  const test=url.searchParams.get("season-test");
  if(test!=="autumn"&&test!=="halloween")return response;
  const html=await response.text();
  const injection='\\n<script src="./seasonal-test.js?v=seasonal-test-v3"></script>\\n';
  const rewritten=html.includes("seasonal-test.js")?html:html.replace(/<\\/body>/i,injection+"</body>");
  return new Response(rewritten,{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)});
}
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const appShell=url.pathname.endsWith("/")||/\\.(html|js|css|webmanifest)$/.test(url.pathname);
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(appShell){
      try{
        if((url.pathname.endsWith("/")||url.pathname.endsWith("index.html"))&&(url.searchParams.get("season-test")==="autumn"||url.searchParams.get("season-test")==="halloween")){
          return await seasonalHtmlResponse(event.request);
        }
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
