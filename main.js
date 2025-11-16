var slidesContainer = document.getElementById('slides');
var statusBox = document.getElementById('status');
var carouselTimer = null;
var API_IMAGES_ENDPOINT = (window.APP_CONFIG && window.APP_CONFIG.API_ENDPOINT) || '';
var readySlides = [];
var failedSlides = 0;

function showStatus(message, isError) {
  if (!statusBox) return;
  if (!message) {
    statusBox.textContent = '';
    statusBox.style.display = 'none';
  } else {
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    statusBox.style.color = isError ? '#f87171' : '#f1f5f9';
  }
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
          onError(new Error('HTTP ' + xhr.status));
        }
      }
    };
    xhr.onerror = function() {
      onError(new Error('Fallo de red'));
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

function parseItems(payload) {
  if (!payload) return [];
  if (payload.files && payload.files.length) return payload.files;
  if (payload.data && payload.data.length) return payload.data;
  if (payload.length) return payload;

  var collected = [];
  if (typeof payload === 'object') {
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        collected.push(payload[key]);
      }
    }
  }
  return collected;
}

function fetchCarouselImages(onSuccess, onError) {
  if (!API_IMAGES_ENDPOINT) {
    onError(new Error('Falta IMAGE_SERVICE_URL en la configuración.'));
    return;
  }

  var endpoint = API_IMAGES_ENDPOINT;
  if (endpoint.indexOf('?') === -1) {
    endpoint += '?';
  } else if (endpoint.charAt(endpoint.length - 1) !== '&' && endpoint.charAt(endpoint.length - 1) !== '?') {
    endpoint += '&';
  }
  endpoint += 't=' + new Date().getTime();

  requestJSON(endpoint, function(payload) {
    var items = parseItems(payload);
    if (!items.length) {
      onError(new Error('No hay imágenes disponibles.'));
      return;
    }

    var urls = [];
    for (var i = 0; i < items.length; i += 1) {
      var file = items[i];
      if (!file) continue;
      var direct = file.downloadUrl || file.url || file.link || file.image;
      if (direct) {
        urls.push(direct);
      }
    }

    if (!urls.length) {
      onError(new Error('No se pudieron preparar las imágenes.'));
      return;
    }

    showStatus('');
    onSuccess(urls);
  }, onError);
}

function startCarousel() {
  if (carouselTimer || readySlides.length === 0) {
    return;
  }
  var current = 0;
  readySlides[current].style.opacity = '1';
  carouselTimer = setInterval(function() {
    if (!readySlides.length) {
      return;
    }
    readySlides[current].style.opacity = '0';
    current = (current + 1) % readySlides.length;
    readySlides[current].style.opacity = '1';
  }, 5000);
}

function clearSlides() {
  if (slidesContainer) {
    slidesContainer.innerHTML = '';
  }
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
  readySlides = [];
  failedSlides = 0;
}

function registerImageSuccess(slide) {
  readySlides.push(slide);
  if (readySlides.length === 1) {
    showStatus('');
    startCarousel();
  }
}

function registerImageFailure(totalSlides) {
  failedSlides += 1;
  if (failedSlides >= totalSlides && readySlides.length === 0) {
    showStatus('⚠️ Ninguna imagen se pudo cargar. Revisa tamaños o permisos.', true);
  }
}

function createSlides(urls) {
  clearSlides();
  for (var i = 0; i < urls.length; i += 1) {
    var slide = document.createElement('div');
    slide.style.position = 'absolute';
    slide.style.inset = '0';
    slide.style.opacity = '0';
    slide.style.transition = 'opacity 0.6s ease-in-out';

    var img = document.createElement('img');
    img.src = urls[i];
    img.alt = 'Imagen ' + (i + 1);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.backgroundColor = '#000';
    img.style.display = 'block';

    var placeholder = document.createElement('div');
    placeholder.style.position = 'absolute';
    placeholder.style.inset = '0';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = '#101010';
    placeholder.style.color = '#fff';
    placeholder.style.fontSize = '1.25rem';
    placeholder.textContent = 'Preparando imagen…';

    (function(slideRef, placeholderRef) {
      img.onload = function() {
        if (placeholderRef.parentNode) {
          placeholderRef.parentNode.removeChild(placeholderRef);
        }
        registerImageSuccess(slideRef);
      };
      img.onerror = function() {
        placeholderRef.textContent = 'Imagen omitida (peso excesivo o sin acceso)';
        placeholderRef.style.backgroundColor = 'rgba(0,0,0,0.8)';
        placeholderRef.style.fontSize = '1rem';
        registerImageFailure(urls.length);
      };
    })(slide, placeholder);

    slide.appendChild(img);
    slide.appendChild(placeholder);
    slidesContainer.appendChild(slide);
  }

  if (!urls.length) {
    reportError(new Error('No hay imágenes para mostrar.'));
  }
}

function reportError(err) {
  console.error(err);
  showStatus('⚠️ ' + (err.message || err), true);
}

function loadCarousel() {
  fetchCarouselImages(function(images) {
    createSlides(images);
    if (readySlides.length === 0) {
      showStatus('Esperando la primera imagen…');
    }
  }, function(err) {
    reportError(err);
  });
}

window.addEventListener('load', loadCarousel);
setInterval(function() {
  if (readySlides.length === 0) {
    showStatus('Seguimos cargando… si tarda, revisa que las imágenes no sean enormes.');
  }
}, 15000);
