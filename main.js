var slidesContainer = document.getElementById('slides');
var statusBox = document.getElementById('status');
var refreshButton = document.getElementById('refresh');
var carouselTimer = null;
var activeSlides = [];
var API_ENDPOINT = window.APP_CONFIG && window.APP_CONFIG.API_ENDPOINT;
var CACHE_KEY = 'kiosko-image-cache-v1';
var DB_NAME = 'kiosko-drive-images';
var DB_STORE = 'images';
var DB_VERSION = 1;
var dbInstance = null;

function showStatus(message, isError) {
  if (!statusBox) return;
  if (!message) {
    statusBox.style.display = 'none';
    statusBox.textContent = '';
    return;
  }
  statusBox.style.display = 'block';
  statusBox.style.color = isError ? '#f87171' : '#e2e8f0';
  statusBox.textContent = message;
}

function httpGetJSON(url, onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        onSuccess(JSON.parse(xhr.responseText));
      } catch (err) {
        onError(err);
      }
    } else {
      onError(new Error('HTTP ' + xhr.status));
    }
  };
  xhr.onerror = function() {
    onError(new Error('Fallo de red al contactar el servicio de imágenes.'));
  };
  xhr.send();
}

function normalizeItems(payload) {
  if (!payload) return [];
  if (payload.files && payload.files.length) return payload.files;
  if (payload.data && payload.data.length) return payload.data;
  if (payload.length) return payload;

  var items = [];
  if (typeof payload === 'object') {
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        items.push(payload[key]);
      }
    }
  }
  return items;
}

function openDatabase(callback) {
  if (!window.indexedDB) {
    callback(new Error('IndexedDB no está soportado en este navegador'));
    return;
  }

  if (dbInstance) {
    callback(null, dbInstance);
    return;
  }

  var request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = function(event) {
    var db = event.target.result;
    if (!db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE, { keyPath: 'id' });
    }
  };
  request.onsuccess = function(event) {
    dbInstance = event.target.result;
    callback(null, dbInstance);
  };
  request.onerror = function() {
    callback(new Error('No se pudo abrir IndexedDB'));
  };
}

function getCachedEntries(db, callback) {
  var transaction = db.transaction(DB_STORE, 'readonly');
  var store = transaction.objectStore(DB_STORE);
  var request = store.getAll();
  request.onsuccess = function() {
    callback(null, request.result || []);
  };
  request.onerror = function() {
    callback(new Error('No se pudo leer el cache local'));
  };
}

function saveEntries(db, entries, callback) {
  var transaction = db.transaction(DB_STORE, 'readwrite');
  var store = transaction.objectStore(DB_STORE);
  var remaining = entries.length;

  if (!remaining) {
    callback();
    return;
  }

  entries.forEach(function(entry) {
    var request = store.put(entry);
    request.onsuccess = function() {
      remaining -= 1;
      if (remaining === 0) {
        callback();
      }
    };
    request.onerror = function() {
      remaining -= 1;
      if (remaining === 0) {
        callback();
      }
    };
  });
}

function mergeCache(items, existing) {
  var map = {};
  (existing || []).forEach(function(entry) {
    if (entry && entry.id) {
      map[entry.id] = entry;
    }
  });

  var result = [];
  for (var i = 0; i < items.length; i += 1) {
    var file = items[i];
    if (!file || !file.id) continue;
    var direct = file.downloadUrl || file.url || file.link || file.image;
    if (!direct) continue;
    var label = file.name || file.nombre || 'Imagen ' + (i + 1);
    var cached = map[file.id];
    if (cached && cached.url === direct) {
      result.push(cached);
    } else {
      result.push({ id: file.id, url: direct, name: label });
    }
  }
  return result;
}

function fetchImages() {
  if (!API_ENDPOINT) {
    showStatus('⚠️ Configura IMAGE_SERVICE_URL para continuar.', true);
    return;
  }

  var endpoint = API_ENDPOINT;
  endpoint += endpoint.indexOf('?') === -1 ? '?' : endpoint.endsWith('?') || endpoint.endsWith('&') ? '' : '&';
  endpoint += 't=' + Date.now();

  showStatus('Preparando imágenes…');
  httpGetJSON(endpoint, function(payload) {
    var items = normalizeItems(payload);

    if (!window.indexedDB) {
      var directList = mergeCache(items, []);
      if (!directList.length) {
        showStatus('⚠️ El servicio no devolvió imágenes válidas.', true);
        return;
      }
      buildSlides(directList);
      return;
    }

    openDatabase(function(err, db) {
      if (err) {
        showStatus('⚠️ ' + err.message, true);
        return;
      }

      getCachedEntries(db, function(cacheErr, previousEntries) {
        if (cacheErr) {
          showStatus('⚠️ ' + cacheErr.message, true);
          return;
        }

        var merged = mergeCache(items, previousEntries);
        if (!merged.length) {
          showStatus('⚠️ El servicio no devolvió imágenes válidas.', true);
          return;
        }

        saveEntries(db, merged, function() {
          buildSlides(merged);
        });
      });
    });
  }, function(err) {
    showStatus('⚠️ ' + (err.message || err), true);
  });
}

function resetCarousel() {
  if (slidesContainer) {
    slidesContainer.innerHTML = '';
  }
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
  activeSlides = [];
}

function buildSlides(entries) {
  resetCarousel();

  entries.forEach(function(entry, index) {
    var url = entry.url;
    var slide = document.createElement('div');
    slide.style.position = 'absolute';
    slide.style.inset = '0';
    slide.style.opacity = '0';
    slide.style.transition = 'opacity 0.6s ease-in-out';
    slide.style.display = 'flex';
    slide.style.alignItems = 'center';
    slide.style.justifyContent = 'center';

    var img = document.createElement('img');
    img.src = url;
    img.alt = entry.name || 'Imagen ' + (index + 1);
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    img.style.backgroundColor = '#000';

    var placeholder = document.createElement('div');
    placeholder.style.position = 'absolute';
    placeholder.style.inset = '0';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.padding = '1rem';
    placeholder.style.backgroundColor = '#101010';
    placeholder.style.color = '#fff';
    placeholder.style.fontSize = '1.1rem';
    placeholder.textContent = 'Preparando imagen…';

    img.onload = function() {
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      activeSlides.push(slide);
      if (activeSlides.length === 1) {
        slide.style.opacity = '1';
        showStatus('');
        startCarousel();
      }
    };

    img.onerror = function() {
      placeholder.textContent = 'Imagen omitida (no se pudo cargar).';
      placeholder.style.backgroundColor = 'rgba(0,0,0,0.85)';
      placeholder.style.fontSize = '1rem';
    };

    slide.appendChild(img);
    slide.appendChild(placeholder);
    slidesContainer.appendChild(slide);
  });

  if (!entries.length) {
    showStatus('⚠️ No hay imágenes para mostrar.', true);
  }
}

function startCarousel() {
  if (carouselTimer || activeSlides.length === 0) {
    return;
  }

  var current = 0;
  carouselTimer = setInterval(function() {
    if (!activeSlides.length) {
      return;
    }
    activeSlides[current].style.opacity = '0';
    current = (current + 1) % activeSlides.length;
    activeSlides[current].style.opacity = '1';
  }, 5000);
}

window.addEventListener('load', fetchImages);

if (refreshButton) {
  refreshButton.addEventListener('click', function() {
    refreshButton.disabled = true;
    refreshButton.classList.add('opacity-60');
    fetchImages();
    setTimeout(function() {
      refreshButton.disabled = false;
      refreshButton.classList.remove('opacity-60');
    }, 1500);
  });
}
