// Polyfills básicos para navegadores de TV muy viejos
(function() {
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
      for (var i = 0; i < this.length; i += 1) {
        if (i in this) {
          callback.call(thisArg, this[i], i, this);
        }
      }
    };
  }

  if (!Array.prototype.map) {
    Array.prototype.map = function(callback, thisArg) {
      var result = [];
      for (var i = 0; i < this.length; i += 1) {
        if (i in this) {
          result[i] = callback.call(thisArg, this[i], i, this);
        }
      }
      return result;
    };
  }

  if (!Array.prototype.filter) {
    Array.prototype.filter = function(callback, thisArg) {
      var result = [];
      for (var i = 0; i < this.length; i += 1) {
        if (i in this && callback.call(thisArg, this[i], i, this)) {
          result.push(this[i]);
        }
      }
      return result;
    };
  }

  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function(callback, initialValue) {
      var accumulator = initialValue;
      var startIndex = 0;
      if (typeof accumulator === 'undefined') {
        while (startIndex < this.length && !(startIndex in this)) {
          startIndex += 1;
        }
        if (startIndex >= this.length) {
          throw new TypeError('Reduce de array vacío sin valor inicial');
        }
        accumulator = this[startIndex];
        startIndex += 1;
      }
      for (var i = startIndex; i < this.length; i += 1) {
        if (i in this) {
          accumulator = callback(accumulator, this[i], i, this);
        }
      }
      return accumulator;
    };
  }

  if (!String.prototype.trim) {
    String.prototype.trim = function() {
      return this.replace(/^\s+|\s+$/g, '');
    };
  }

  if (typeof Promise !== 'function') {
    var PENDING = 0;
    var FULFILLED = 1;
    var REJECTED = 2;

    var SimplePromise = function(executor) {
      if (!(this instanceof SimplePromise)) {
        throw new TypeError('Promise debe llamarse con new');
      }

      var state = PENDING;
      var value = null;
      var handlers = [];

      function fulfill(result) {
        if (state !== PENDING) {
          return;
        }
        state = FULFILLED;
        value = result;
        handlers.forEach(handle);
        handlers = null;
      }

      function reject(error) {
        if (state !== PENDING) {
          return;
        }
        state = REJECTED;
        value = error;
        handlers.forEach(handle);
        handlers = null;
      }

      function resolve(result) {
        try {
          if (result && (typeof result === 'object' || typeof result === 'function')) {
            var then = result.then;
            if (typeof then === 'function') {
              then.call(result, resolve, reject);
              return;
            }
          }
          fulfill(result);
        } catch (err) {
          reject(err);
        }
      }

      function handle(handler) {
        if (state === PENDING) {
          handlers.push(handler);
          return;
        }

        var callback = state === FULFILLED ? handler.onFulfilled : handler.onRejected;
        if (!callback) {
          if (state === FULFILLED) {
            handler.resolve(value);
          } else {
            handler.reject(value);
          }
          return;
        }

        try {
          var result = callback(value);
          handler.resolve(result);
        } catch (err) {
          handler.reject(err);
        }
      }

      this.then = function(onFulfilled, onRejected) {
        return new SimplePromise(function(resolve, reject) {
          handle({
            onFulfilled: typeof onFulfilled === 'function' ? onFulfilled : null,
            onRejected: typeof onRejected === 'function' ? onRejected : null,
            resolve: resolve,
            reject: reject
          });
        });
      };

      this.catch = function(onRejected) {
        return this.then(null, onRejected);
      };

      try {
        executor(resolve, reject);
      } catch (err) {
        reject(err);
      }
    };

    SimplePromise.resolve = function(value) {
      return new SimplePromise(function(resolve) {
        resolve(value);
      });
    };

    SimplePromise.reject = function(reason) {
      return new SimplePromise(function(resolve, reject) {
        reject(reason);
      });
    };

    window.Promise = SimplePromise;
  }
})();

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

function reportError(message) {
  if (statusBox) {
    statusBox.textContent = '⚠️ Error: ' + message;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', function(evt) {
    if (evt && evt.message) {
      reportError(evt.message);
    }
  });
}

function ensureSlidesContainerStyles() {
  if (!slidesContainer) {
    return;
  }
  var style = slidesContainer.style;
  if (!style.position) {
    style.position = 'relative';
  }
  if (!style.width) {
    style.width = '100%';
  }
  if (!style.height) {
    style.height = '100%';
  }
  if (!style.minHeight) {
    style.minHeight = '420px';
  }
  if (!style.backgroundColor) {
    style.backgroundColor = '#000000';
  }
  if (!style.overflow) {
    style.overflow = 'hidden';
  }
}

function setupSlideElement(slide, isVisible) {
  var style = slide.style;
  style.position = 'absolute';
  style.top = '0';
  style.left = '0';
  style.right = '0';
  style.bottom = '0';
  style.width = '100%';
  style.height = '100%';
  style.opacity = isVisible ? '1' : '0';
  style.transition = 'opacity 0.7s ease-in-out';
  style.display = 'block';
}

function toggleSlideVisibility(slide, visible) {
  if (!slide) {
    return;
  }
  slide.style.opacity = visible ? '1' : '0';
}

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
  if (!slidesContainer || !images || !images.length) {
    return;
  }

  ensureSlidesContainerStyles();
  slidesContainer.innerHTML = '';

  var slides = [];
  for (var i = 0; i < images.length; i += 1) {
    var slide = document.createElement('div');
    slide.className = 'slide';
    setupSlideElement(slide, i === 0);
    slide.innerHTML = '<img src="' + images[i] + '" alt="Imagen ' + (i + 1) + '" style="width:100%;height:100%;object-fit:contain;display:block;">';
    slidesContainer.appendChild(slide);
    slides.push(slide);
  }

  if (carouselTimer) {
    clearInterval(carouselTimer);
  }

  var current = 0;
  function advanceSlide() {
    if (!slides.length) {
      return;
    }
    toggleSlideVisibility(slides[current], false);
    current = (current + 1) % slides.length;
    toggleSlideVisibility(slides[current], true);
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
