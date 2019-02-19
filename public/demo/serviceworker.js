(function () {
  'use strict'
  /* global importScripts */
  /* global self */
  /* global caches */
  /* global fetch */
  /* global URL */

  // Cache name definitions
  var cacheNameStatic = 'v1.2'

  var currentCacheNames = [ cacheNameStatic ]

  var urls = [
    '/demo/',
    '/demo/login.html',
    '/demo/register.html',
    '/demo/css/envoydemo.css',
    '/demo/js/app.js',
    '/demo/js/index.js',
    '/demo/js/login.js',
    '/demo/js/mustache.js',
    '/demo/js/register.js',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/fonts/roboto/Roboto-Regular.woff2',
    'https://fonts.gstatic.com/s/materialicons/v17/2fcrYFNaTjcS6g4U3t-Y5UEw0lE80llgEseQY3FEmqw.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/css/materialize.min.css',
    'https://code.jquery.com/jquery-2.1.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/js/materialize.min.js',
    'https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js'
  ]

  // A new ServiceWorker has been registered
  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.delete(cacheNameStatic).then(function () {
        return caches.open(cacheNameStatic)
      }).then(function (cache) {
        return cache.addAll(urls)
      })
    )
  })

  // A new ServiceWorker is now active
  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys()
        .then(function (cacheNames) {
          return Promise.all(
            cacheNames.map(function (cacheName) {
              if (currentCacheNames.indexOf(cacheName) === -1) {
                return caches.delete(cacheName)
              }
            })
          )
        })
    )
  })

  // The page has made a request
  self.addEventListener('fetch', function (event) {
    var requestURL = new URL(event.request.url)

    event.respondWith(
      caches.match(event.request)
        .then(function (response) {
          if (response) {
            return response
          }

          var fetchRequest = event.request.clone()

          return fetch(fetchRequest).then(
            function (response) {
              var shouldCache = false
              if (urls.indexOf(requestURL.href) > -1 && response.status === 200) {
                shouldCache = cacheNameStatic
              }

              if (shouldCache) {
                var responseToCache = response.clone()

                caches.open(shouldCache)
                  .then(function (cache) {
                    var cacheRequest = event.request.clone()
                    cache.put(cacheRequest, responseToCache)
                  })
              }

              return response
            }
          )
        })
    )
  })
})()
