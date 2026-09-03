// Service worker mínimo — existe só pra satisfazer o critério de
// "instalabilidade" do Chrome/Edge/Android (precisam de um service
// worker registrado com handler de fetch pra oferecer "Instalar app").
// Não faz cache nem funciona offline de propósito: o app depende de
// dados sempre atualizados do backend (login, assinatura, TTS), cachear
// agressivamente aqui criaria bugs de conteúdo desatualizado sem
// necessidade real (o app não pede suporte offline).
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
