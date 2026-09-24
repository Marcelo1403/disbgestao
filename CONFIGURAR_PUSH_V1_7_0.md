# Configuração do Push — Disb Gestão v1.7.0

A implementação já está no código. Para ativar o envio fora do aplicativo, configure as credenciais abaixo.

## 1. Supabase
Execute no SQL Editor:

`supabase/31_v1_7_0_push_notificacoes.sql`

## 2. Web Push (PWA / Windows)
No terminal do projeto:

```powershell
node .\scripts\generate-vapid.mjs
```

Guarde os dois valores exibidos. Depois cadastre como Supabase Secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — use um contato válido, por exemplo `mailto:seu-email@empresa.com`

A chave privada nunca deve ser colocada em `app.js`, `config.js` ou GitHub.

## 3. Firebase / Android
No Firebase, crie ou use um projeto e registre um aplicativo Android com package:

`br.com.disbecol.gestaooperacional`

Baixe `google-services.json` e coloque em:

`android/app/google-services.json`

Em Firebase > Project settings > Service accounts, gere uma chave privada JSON para a Service Account.

Não copie esse JSON para o GitHub.

## 4. Transformar Service Account em Base64
No PowerShell:

```powershell
$FirebaseJson = "C:\CAMINHO\service-account.json"
$FirebaseB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($FirebaseJson))
$FirebaseB64
```

Cadastre o resultado no Supabase Secret:

`FIREBASE_SERVICE_ACCOUNT_B64`

Cadastre também:

`FIREBASE_PROJECT_ID`

com o Project ID do Firebase.

## 5. Publicar a Edge Function

```powershell
npx supabase@latest functions deploy push-notifications --project-ref jrsjbcdahqpcgcvzdtfb
```

A função deve continuar com verificação JWT habilitada.

## 6. Funcionamento no dispositivo
Depois da publicação:

1. Entre no Disb Gestão.
2. Clique no sino no cabeçalho.
3. Autorize notificações.
4. O dispositivo passa a constar em `public.push_devices`.
5. Se o usuário usar o botão `Sair`, o registro daquele dispositivo é desativado.

No PWA/Windows, a notificação é tratada pelo Service Worker e pode aparecer mesmo com a janela do Disb Gestão fechada. No Android, o FCM entrega a notificação ao sistema operacional.

## Arquivos que NÃO devem ser commitados
- `android/app/google-services.json`
- JSON da Service Account do Firebase
- qualquer arquivo `.env` contendo os Secrets
