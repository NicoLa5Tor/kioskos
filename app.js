var statusBox = document.getElementById('status');
var slidesContainer = document.getElementById('slides');
var refreshButton = document.getElementById('refresh');
var carouselTimer = null;
var runtimeConfig = null;
var CONFIG_SOURCES = [
  { path: './config.json', type: 'json' },
  { path: '../config.json', type: 'json' },
  { path: '/config.json', type: 'json' },
  { path: './.env', type: 'env' },
  { path: '../.env', type: 'env' },
  { path: '/.env', type: 'env' }
];

function fetchWithFallback(url, options) {
  if (typeof window.fetch === 'function') {
    return window.fetch(url, options || {});
  }

  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open((options && options.method) || 'GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        var response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          text: function() {
            return Promise.resolve(xhr.responseText);
          },
          json: function() {
            try {
              return Promise.resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              return Promise.reject(err);
            }
          }
        };
        resolve(response);
      }
    };
    xhr.onerror = function() {
      reject(new Error('Network error al solicitar ' + url));
    };
    xhr.send((options && options.body) || null);
  });
}

function parseEnv(text) {
  var lines = text.split('\n');
  var env = {};
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i].trim();
    if (!line || line.charAt(0) === '#') {
      continue;
    }
    var parts = line.split('=');
    var key = parts.shift();
    env[key.trim()] = parts.join('=').trim();
  }
  return env;
}

function loadConfig() {
  var index = 0;
  var lastError = null;

  function tryNext() {
    if (index >= CONFIG_SOURCES.length) {
      var triedPaths = CONFIG_SOURCES.map(function(src) {
        return src.path;
      }).join(', ');
      var message = 'No se pudo cargar configuración (probé ' + triedPaths + ')';
      if (lastError && lastError.message) {
        message += ': ' + lastError.message;
      }
      return Promise.reject(new Error(message));
    }

    var source = CONFIG_SOURCES[index];
    index += 1;

    return fetchWithFallback(source.path, { cache: 'no-store' })
      .then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        if (source.type === 'json') {
          return res.json();
        }
        return res.text().then(parseEnv);
      })
      .catch(function(err) {
        lastError = err;
        return tryNext();
      });
  }

  return tryNext();
}

function getDriveImages(folderId, apiKey) {
  if (statusBox) {
    statusBox.textContent = '🔄 Obteniendo lista de imágenes...';
  }
  var query = encodeURIComponent("'" + folderId + "' in parents and mimeType contains 'image/'");
  var fields = encodeURIComponent('files(id,name)');
  var url = 'https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=' + fields + '&key=' + apiKey;

  return fetchWithFallback(url)
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      if (!data.files || !data.files.length) {
        throw new Error('No se encontraron imágenes en la carpeta.');
      }
      return data.files.map(function(file) {
        return 'https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media&key=' + apiKey;
      });
    });
}

function createCarousel(images) {
  var i;
  slidesContainer.innerHTML = '';
  for (i = 0; i < images.length; i += 1) {
    var slide = document.createElement('div');
    var visibleClass = i === 0 ? 'opacity-100' : 'opacity-0';
    slide.className = 'slide absolute inset-0 transition-opacity duration-700 ease-in-out ' + visibleClass;
    slide.innerHTML = '<img src="' + images[i] + '" alt="Imagen ' + (i + 1) + '">';
    slidesContainer.appendChild(slide);
  }

  var slides = document.querySelectorAll('.slide');
  if (carouselTimer) {
    clearInterval(carouselTimer);
  }

  var current = 0;
  function advanceSlide() {
    if (!slides.length) {
      return;
    }
    slides[current].classList.remove('opacity-100');
    slides[current].classList.add('opacity-0');
    current = (current + 1) % slides.length;
    slides[current].classList.remove('opacity-0');
    slides[current].classList.add('opacity-100');
  }

  carouselTimer = setInterval(advanceSlide, 5000);
}

function ensureConfig() {
  if (runtimeConfig) {
    return Promise.resolve(runtimeConfig);
  }
  return loadConfig().then(function(config) {
    runtimeConfig = config;
    return runtimeConfig;
  });
}

function loadCarousel() {
  return ensureConfig()
    .then(function(config) {
      var folderId = config.FOLDER_ID;
      var apiKey = config.API_KEY;
      if (!folderId || !apiKey) {
        throw new Error('Config incompleta: define FOLDER_ID y API_KEY en .env');
      }
      return getDriveImages(folderId, apiKey);
    })
    .then(function(images) {
      createCarousel(images);
      if (statusBox) {
        statusBox.textContent = '';
      }
    })
    .catch(function(err) {
      if (statusBox) {
        statusBox.textContent = '⚠️ Error: ' + err.message;
      }
      if (window.console && console.error) {
        console.error(err);
      }
    });
}

if (refreshButton) {
  refreshButton.addEventListener('click', function() {
    refreshButton.disabled = true;
    refreshButton.classList.add('opacity-60');
    refreshButton.classList.add('cursor-not-allowed');

    var enableButton = function() {
      refreshButton.disabled = false;
      refreshButton.classList.remove('opacity-60');
      refreshButton.classList.remove('cursor-not-allowed');
    };

    loadCarousel().then(enableButton).catch(function() {
      enableButton();
    });
  });
}

loadCarousel();
