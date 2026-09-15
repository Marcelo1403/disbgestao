import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifest)) {
  console.log('Projeto Android ainda nao existe; rode npm run android:add primeiro.');
  process.exit(0);
}

let xml = fs.readFileSync(manifest, 'utf8');
const permissions = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];

const manifestOpen = xml.match(/<manifest\b[^>]*>/i)?.[0];
if (!manifestOpen) {
  throw new Error('AndroidManifest.xml invalido: tag <manifest> nao encontrada.');
}

const missing = permissions.filter(permission => !xml.includes(`android:name="${permission}"`));
if (missing.length) {
  const lines = missing.map(permission => `    <uses-permission android:name="${permission}" />`).join('\n');
  xml = xml.replace(manifestOpen, `${manifestOpen}\n${lines}`);
  fs.writeFileSync(manifest, xml, 'utf8');
}

const finalXml = fs.readFileSync(manifest, 'utf8');
const stillMissing = permissions.filter(permission => !finalXml.includes(`android:name="${permission}"`));
if (stillMissing.length) {
  throw new Error(`Falha ao aplicar permissoes Android: ${stillMissing.join(', ')}`);
}

console.log('GPS Android OK: ACCESS_COARSE_LOCATION e ACCESS_FINE_LOCATION presentes no AndroidManifest.xml.');
