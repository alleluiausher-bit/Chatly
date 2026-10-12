const VERSION = "chatly-v2";
const SHELL = ["./", "./index.html", "./style.css", "./script.js", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes("supabase.co")) return;
  if (url.hostname.includes("googleapis.com")) return;
  if (url.hostname.includes("gstatic.com")) return;
  if (url.hostname.includes("jsdelivr.net")) return;
  if (e.request.method !== "GET") return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }

  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
