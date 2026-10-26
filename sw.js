/* ==========================================================================
   ROUTER Dept - Offline shell
   Network-first for the app shell so updates arrive immediately, with a
   cached copy as fallback when the device has no connection.
   ========================================================================== */
'use strict';

var CACHE_NAME = 'router-app-shell-v2';
var OFFLINE_URL = new URL('./index.html', self.location.href).href;
var APP_SHELL = [
  './',
  './index.html',
  './fonts.css',
  './css/styles.css',
  './js/api.js',
  './js/store.js',
  './js/charts.js',
  './js/app.js',
  './js/vendor/chart.umd.min.js',
  './fonts/prompt-300.ttf',
  './fonts/prompt-400.ttf',
  './fonts/prompt-500.ttf',
  './fonts/prompt-600.ttf',
  './fonts/prompt-700.ttf'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  // Google Apps Script requests must always go to the network. Offline writes
  // are already handled by the pending queue in the app itself.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME)
            .then(function (cache) { return cache.put(request, copy); })
            .catch(function () { /* quota / private mode */ });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return Response.error();
        });
      })
  );
});
