const fs = require('fs');
const path = require('path');

function parseEnvFile(content) {
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
    throw new Error('.env no existe en ' + envPath);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const env = parseEnvFile(raw);

  if (!env.FOLDER_ID || !env.API_KEY) {
    throw new Error('FOLDER_ID y API_KEY son obligatorios en .env');
  }

  const config = {
    FOLDER_ID: env.FOLDER_ID,
    API_KEY: env.API_KEY
  };

  const configPath = path.resolve(process.cwd(), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

main();
