const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line.charAt(0) !== '#')
    .reduce((acc, line) => {
      const parts = line.split('=');
      const key = parts.shift();
      acc[key.trim()] = parts.join('=').trim();
      return acc;
    }, {});
}

function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró .env en ' + envPath);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const env = parseEnv(raw);

  if (!env.IMAGE_SERVICE_URL) {
    throw new Error('Define IMAGE_SERVICE_URL en .env');
  }

  const config = {
    API_ENDPOINT: env.IMAGE_SERVICE_URL
  };

  const configJs = 'window.APP_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';
  const outputPath = path.resolve(process.cwd(), 'config.js');
  fs.writeFileSync(outputPath, configJs);
}

main();
