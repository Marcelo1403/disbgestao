# Disb Gestão v1.7.0 — Push Notifications

## Objetivo
Receber alertas de novas Avarias de Entrega e Avarias de Vendas fora da tela do sistema.

## Comportamento
- PWA instalado no Windows/PC: usa Web Push do navegador e Service Worker. A notificação pode aparecer no Windows mesmo com a janela do Disb Gestão fechada.
- APK Android: usa Firebase Cloud Messaging (FCM) via `@capacitor/push-notifications`.
- Ao tocar/clicar na notificação, abre a área correspondente do Disb Gestão.
- O dispositivo é desativado no banco quando o usuário usa o botão Sair.
- O registro é associado ao usuário e à unidade atualmente selecionada.
- As notificações são enviadas ao criador da solicitação e aos usuários da unidade que possuem permissão para visualizar/analisar o módulo.

## Backend
- SQL `31_v1_7_0_push_notificacoes.sql`: cria `public.push_devices` com RLS por usuário.
- Edge Function `push-notifications`: fornece a chave pública VAPID e envia Web Push/FCM.
- O envio é solicitado pelo próprio app após a criação bem-sucedida da avaria, inclusive quando uma Avaria de Entrega criada offline é sincronizada.

## Segurança
- A chave privada VAPID e a credencial de Service Account do Firebase ficam apenas em Supabase Secrets.
- Nenhuma credencial privada deve ser salva em `app.js`, `config.js`, GitHub ou APK.
- `google-services.json` deve ficar localmente em `android/app/` e pode ser ignorado pelo Git.

## Pré-requisitos externos
1. Executar o SQL 31 no Supabase.
2. Gerar VAPID com `node scripts/generate-vapid.mjs` e cadastrar as duas chaves em Supabase Secrets.
3. Criar/configurar um projeto Firebase para Android, usando o package `br.com.disbecol.gestaooperacional`.
4. Colocar o arquivo `google-services.json` em `android/app/google-services.json`.
5. Converter o JSON da Service Account do Firebase em Base64 e cadastrá-lo no secret `FIREBASE_SERVICE_ACCOUNT_B64`.
6. Cadastrar `FIREBASE_PROJECT_ID` e `VAPID_SUBJECT` nos Secrets.
7. Publicar a Edge Function `push-notifications`.

Android: versionCode 170 / versionName 1.7.0.
