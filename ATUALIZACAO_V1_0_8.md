# Disb Gestão v1.0.8

Esta versão corrige dois pontos de homologação:

- `admin-users` reescrita com `@supabase/server`, compatível com o modelo atual de chaves/autenticação do Supabase.
- criação de usuário idempotente: se uma tentativa anterior criou o usuário no Auth e falhou depois, a função reaproveita e corrige o cadastro.
- o frontend passa a mostrar o motivo real devolvido pela Edge Function.
- atualização do Service Worker/cache para v1.0.8.
- versão visível no login e no menu lateral, facilitando confirmar se o GitHub Pages realmente publicou os arquivos novos.
- mantém a conciliação de conferência por número do mapa, independentemente da data.

## Atualizar o GitHub

Extraia os arquivos deste ZIP diretamente sobre a raiz do repositório local, por exemplo `C:\disbgestao-main`, substituindo os existentes.

No terminal:

```powershell
cd C:\disbgestao-main
git status
git add -A
git commit -m "Disb Gestao v1.0.8"
git push origin main
```

No GitHub, abra `VERSION.txt` na raiz. Ele precisa começar com `v1.0.8`.

## Publicar admin-users

```powershell
cd C:\disbgestao-main
npx supabase@latest functions deploy admin-users --project-ref jrsjbcdahqpcgcvzdtfb --no-verify-jwt
```

Depois saia do Disb Gestão e entre novamente para renovar a sessão.
