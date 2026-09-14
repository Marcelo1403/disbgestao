# Gerar APK Android

A versão web já é uma PWA instalável. Para gerar um APK nativo com Capacitor:

1. Instale Node.js e Android Studio no computador.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run android:add` apenas na primeira vez.
4. Depois use `npm run android:sync` sempre que atualizar os arquivos web.
5. Execute `npm run android:open`.
6. No Android Studio use **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

O APK usa o mesmo Supabase e o mesmo banco da versão publicada no GitHub Pages.
