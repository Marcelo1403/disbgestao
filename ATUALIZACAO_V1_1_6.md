# Disb Gestão v1.1.6

## Correção de atualização/cache no APK

- Corrige o caso em que o aplicativo instalado continuava executando JavaScript antigo após atualizar o APK.
- No Android/Capacitor, o Service Worker passa a ser removido e os caches web são limpos na inicialização. O APK passa a usar diretamente os arquivos empacotados na versão instalada.
- No navegador/PWA, o Service Worker continua ativo, agora com cache `v1.1.6`.
- `index.html` passa a referenciar `app.js`, `config.js` e `styles.css` com `?v=1.1.6`.
- Identificação visual do aplicativo atualizada para `v1.1.6`.
- O `android:sync` também ajusta o APK para `versionCode 116` e `versionName 1.1.6`, evitando que o Android trate o pacote novo como a mesma compilação antiga.
- Mantida a tolerância GPS configurável de 5 a 500 m; o valor definido em `pull_settings.gps_max_accuracy_m` é o usado pelo motorista.

Não há SQL novo nesta versão. Mantenha o SQL da v1.1.5 aplicado e o valor desejado (ex.: 200 m) em `public.pull_settings`.
