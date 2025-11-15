const statusBox = document.getElementById('status');
const slidesContainer = document.getElementById('slides');
const refreshButton = document.getElementById('refresh');
let carouselTimer = null;
let runtimeConfig = null;
const CONFIG_SOURCES = [
  { path: './config.json', type: 'json' },
  { path: '../config.json', type: 'json' },
  { path: '/config.json', type: 'json' },
  { path: './.env', type: 'env' },
  { path: '../.env', type: 'env' },
  { path: '/.env', type: 'env' }
];

async function parseEnv(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((env, line) => {
      const [key, ...valueParts] = line.split('=');
      env[key.trim()] = valueParts.join('=').trim();
      return env;
    }, {});
}

async function loadConfig() {
  let lastError;
  for (const source of CONFIG_SOURCES) {
    try {
      const res = await fetch(source.path, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (source.type === 'json') {
        return await res.json();
      }
      const text = await res.text();
      return parseEnv(text);
    } catch (err) {
      lastError = err;
    }
  }
  const triedPaths = CONFIG_SOURCES.map(src => src.path).join(', ');
  throw new Error(
    `No se pudo cargar configuración (probé ${triedPaths})` +
      (lastError ? `: ${lastError.message}` : '')
  );
}

async function getDriveImages(folderId, apiKey) {
  statusBox.textContent = '🔄 Obteniendo lista de imágenes...';
  const query = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/'`);
  const fields = encodeURIComponent('files(id,name)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.files || data.files.length === 0) {
    throw new Error('No se encontraron imágenes en la carpeta.');
  }

  return data.files.map(f => `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${apiKey}`);
}

function createCarousel(images) {
  slidesContainer.innerHTML = '';
  images.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = `slide absolute inset-0 transition-opacity duration-700 ease-in-out ${i === 0 ? 'opacity-100' : 'opacity-0'}`;
    slide.innerHTML = `<img src="${src}" alt="Imagen ${i + 1}">`;
    slidesContainer.appendChild(slide);
  });

  const slides = document.querySelectorAll('.slide');
  if (carouselTimer) {
    clearInterval(carouselTimer);
  }

  let current = 0;
  const advanceSlide = () => {
    if (!slides.length) return;
    slides[current].classList.replace('opacity-100', 'opacity-0');
    current = (current + 1) % slides.length;
    slides[current].classList.replace('opacity-0', 'opacity-100');
  };

  carouselTimer = setInterval(advanceSlide, 5000);
}

async function ensureConfig() {
  if (!runtimeConfig) {
    runtimeConfig = await loadConfig();
  }
  return runtimeConfig;
}

async function loadCarousel() {
  try {
    const config = await ensureConfig();
    const folderId = config.FOLDER_ID;
    const apiKey = config.API_KEY;

    if (!folderId || !apiKey) {
      throw new Error('Config incompleta: define FOLDER_ID y API_KEY en .env');
    }

    const images = await getDriveImages(folderId, apiKey);
    createCarousel(images);
    statusBox.textContent ="";
  } catch (err) {
    statusBox.textContent = `⚠️ Error: ${err.message}`;
    console.error(err);
  }
}

if (refreshButton) {
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.classList.add('opacity-60', 'cursor-not-allowed');
    await loadCarousel();
    refreshButton.disabled = false;
    refreshButton.classList.remove('opacity-60', 'cursor-not-allowed');
  });
}

loadCarousel();
