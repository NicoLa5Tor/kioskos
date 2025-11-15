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

function addClass(el, className) {
  if (!el || !className) {
    return;
  }
  if (el.classList && el.classList.add) {
    el.classList.add(className);
  } else if ((' ' + el.className + ' ').indexOf(' ' + className + ' ') === -1) {
    el.className = (el.className ? el.className + ' ' : '') + className;
  }
}

function removeClass(el, className) {
  if (!el || !className) {
    return;
  }
  if (el.classList && el.classList.remove) {
    el.classList.remove(className);
  } else if (el.className) {
    var pattern = new RegExp('(?:^|\\s)' + className + '(?:\\s|$)', 'g');
    el.className = el.className.replace(pattern, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }
}

function showStatus(message) {
  if (statusBox) {
    statusBox.textContent = message || '';
  }
}

function reportError(message) {
  showStatus('⚠️ Error: ' + message);
  if (window.console && console.error) {
    console.error(message);
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
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
  if (!style.position) style.position = 'relative';
  if (!style.width) style.width = '100%';
  if (!style.height) style.height = '100%';
  if (!style.minHeight) style.minHeight = '420px';
  if (!style.backgroundColor) style.backgroundColor = '#000000';
  if (!style.overflow) style.overflow = 'hidden';
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
  if (slide && slide.style) {
    slide.style.opacity = visible ? '1' : '0';
  }
}

function parseEnv(text) {
  var env = {};
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i];
    if (!line) continue;
    line = line.replace(/^\s+|\s+$/g, '');
    if (!line || line.charAt(0) === '#') {
      continue;
    }
    var parts = line.split('=');
    var key = parts.shift();
    env[key.replace(/^\s+|\s+$/g, '')] = parts.join('=').replace(/^\s+|\s+$/g, '');
  }
  return env;
}

function request(url, onSuccess, onError) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          onSuccess(xhr.responseText);
        } else {
          onError(new Error('HTTP ' + xhr.status + ' al solicitar ' + url));
        }
      }
    };
    xhr.onerror = function() {
      onError(new Error('Fallo de red al solicitar ' + url));
    };
    xhr.send(null);
  } catch (err) {
    onError(err);
  }
}

function requestJSON(url, onSuccess, onError) {
  request(url, function(text) {
    try {
      var data = JSON.parse(text);
      onSuccess(data);
    } catch (err) {
      onError(err);
    }
  }, onError);
}

function loadConfigFromIndex(index, onSuccess, onError) {
  if (index >= CONFIG_SOURCES.length) {
    onError(new Error('No se pudo cargar configuración (.env/config.json)'));
    return;
  }

  var source = CONFIG_SOURCES[index];
  request(source.path, function(text) {
    try {
      if (source.type === 'json') {
        onSuccess(JSON.parse(text));
      } else {
        onSuccess(parseEnv(text));
      }
    } catch (err) {
      loadConfigFromIndex(index + 1, onSuccess, onError);
    }
  }, function() {
    loadConfigFromIndex(index + 1, onSuccess, onError);
  });
}

function ensureConfig(onSuccess, onError) {
  if (runtimeConfig) {
    onSuccess(runtimeConfig);
    return;
  }

  loadConfigFromIndex(0, function(config) {
    runtimeConfig = config;
    onSuccess(runtimeConfig);
  }, onError);
}

function getDriveImages(folderId, apiKey, onSuccess, onError) {
  showStatus('🔄 Obteniendo lista de imágenes...');
  var query = encodeURIComponent("'" + folderId + "' in parents and mimeType contains 'image/'");
  var fields = encodeURIComponent('files(id,name)');
  var url = 'https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=' + fields + '&key=' + apiKey;

  requestJSON(url, function(data) {
    if (!data || !data.files || !data.files.length) {
      onError(new Error('No se encontraron imágenes en la carpeta.'));
      return;
    }

    var images = [];
    for (var i = 0; i < data.files.length; i += 1) {
      var file = data.files[i];
      images.push('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media&key=' + apiKey);
    }
    onSuccess(images);
  }, onError);
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

    var img = document.createElement('img');
    img.src = images[i];
    img.alt = 'Imagen ' + (i + 1);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';

    slide.appendChild(img);
    slidesContainer.appendChild(slide);
    slides.push(slide);
  }

  if (carouselTimer) {
    clearInterval(carouselTimer);
  }

  var current = 0;
  carouselTimer = setInterval(function() {
    if (!slides.length) {
      return;
    }
    toggleSlideVisibility(slides[current], false);
    current = (current + 1) % slides.length;
    toggleSlideVisibility(slides[current], true);
  }, 5000);
}

function loadCarousel(done) {
  var finalize = typeof done === 'function' ? done : function() {};
  ensureConfig(function(config) {
    var folderId = config.FOLDER_ID;
    var apiKey = config.API_KEY;
    if (!folderId || !apiKey) {
      reportError('Config incompleta: define FOLDER_ID y API_KEY en .env');
      finalize();
      return;
    }

    getDriveImages(folderId, apiKey, function(images) {
      createCarousel(images);
      showStatus('');
      finalize();
    }, function(err) {
      reportError(err.message || String(err));
      finalize();
    });
  }, function(err) {
    reportError(err.message || String(err));
    finalize();
  });
}

if (refreshButton) {
  refreshButton.addEventListener('click', function() {
    refreshButton.disabled = true;
    addClass(refreshButton, 'opacity-60');
    addClass(refreshButton, 'cursor-not-allowed');

    var enableButton = function() {
      refreshButton.disabled = false;
      removeClass(refreshButton, 'opacity-60');
      removeClass(refreshButton, 'cursor-not-allowed');
    };

    loadCarousel(enableButton);
  });
}

loadCarousel();
