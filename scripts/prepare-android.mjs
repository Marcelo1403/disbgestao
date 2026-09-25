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
  'android.permission.POST_NOTIFICATIONS',
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

console.log('Android OK: localizacao e permissao de notificacoes presentes no AndroidManifest.xml.');



const googleServices = path.join(root, 'android', 'app', 'google-services.json');
if (fs.existsSync(googleServices)) {
  console.log('Firebase Android OK: google-services.json encontrado.');
} else {
  console.warn('ATENCAO: android/app/google-services.json nao encontrado. O APK sera gerado, mas Push remoto Android nao funcionara ate configurar o Firebase.');
}

// Mantem a versao nativa alinhada com a versao web para que o Android reconheca a atualizacao.
const gradleGroovy = path.join(root, 'android', 'app', 'build.gradle');
const gradleKts = path.join(root, 'android', 'app', 'build.gradle.kts');
if (fs.existsSync(gradleGroovy)) {
  let g = fs.readFileSync(gradleGroovy, 'utf8');
  g = g.replace(/versionCode\s+\d+/, 'versionCode 170');
  g = g.replace(/versionName\s+["'][^"']+["']/, 'versionName "1.7.0"');
  fs.writeFileSync(gradleGroovy, g, 'utf8');
  console.log('Versao Android OK: versionCode 170 / versionName 1.7.0.');
} else if (fs.existsSync(gradleKts)) {
  let g = fs.readFileSync(gradleKts, 'utf8');
  g = g.replace(/versionCode\s*=\s*\d+/, 'versionCode = 170');
  g = g.replace(/versionName\s*=\s*["'][^"']+["']/, 'versionName = "1.7.0"');
  fs.writeFileSync(gradleKts, g, 'utf8');
  console.log('Versao Android OK: versionCode 170 / versionName 1.7.0.');
}

/* DISB_FCM_BUILD_FLAG_V170
   O APK somente ativa o FCM quando TODA a configuracao
   Android Firebase estiver presente. Caso contrario,
   o Push nativo fica desativado sem derrubar o aplicativo.
*/
{
  const fsFcmV170 = await import('node:fs');
  const pathFcmV170 = await import('node:path');

  const rootFcmV170 = process.cwd();

  const googleFcmV170 = pathFcmV170.join(
    rootFcmV170,
    'android',
    'app',
    'google-services.json'
  );

  const appGradleFcmV170 = pathFcmV170.join(
    rootFcmV170,
    'android',
    'app',
    'build.gradle'
  );

  const rootGradleFcmV170 = pathFcmV170.join(
    rootFcmV170,
    'android',
    'build.gradle'
  );

  const androidAppJsFcmV170 = pathFcmV170.join(
    rootFcmV170,
    'android',
    'app',
    'src',
    'main',
    'assets',
    'public',
    'app.js'
  );

  const appGradleTextFcmV170 =
    fsFcmV170.existsSync(appGradleFcmV170)
      ? fsFcmV170.readFileSync(appGradleFcmV170, 'utf8')
      : '';

  const rootGradleTextFcmV170 =
    fsFcmV170.existsSync(rootGradleFcmV170)
      ? fsFcmV170.readFileSync(rootGradleFcmV170, 'utf8')
      : '';

  const fcmEnabledV170 =
    fsFcmV170.existsSync(googleFcmV170) &&
    appGradleTextFcmV170.includes('com.google.gms.google-services') &&
    rootGradleTextFcmV170.includes('com.google.gms:google-services');

  if (!fsFcmV170.existsSync(androidAppJsFcmV170)) {
    throw new Error(
      'app.js Android nao encontrado para configurar FCM.'
    );
  }

  let androidJsFcmV170 =
    fsFcmV170.readFileSync(
      androidAppJsFcmV170,
      'utf8'
    );

  const flagRegexFcmV170 =
    /const ANDROID_FCM_ENABLED_V170=(?:true|false);/;

  if (!flagRegexFcmV170.test(androidJsFcmV170)) {
    throw new Error(
      'ANDROID_FCM_ENABLED_V170 nao encontrado no app.js Android.'
    );
  }

  androidJsFcmV170 =
    androidJsFcmV170.replace(
      flagRegexFcmV170,
      `const ANDROID_FCM_ENABLED_V170=${fcmEnabledV170};`
    );

  fsFcmV170.writeFileSync(
    androidAppJsFcmV170,
    androidJsFcmV170,
    'utf8'
  );

  if (fcmEnabledV170) {
    console.log(
      'FCM Android: ATIVADO - configuracao Firebase completa.'
    );
  } else {
    console.log(
      'FCM Android: DESATIVADO com seguranca - Supabase e demais funcoes continuam normais.'
    );
  }
}
