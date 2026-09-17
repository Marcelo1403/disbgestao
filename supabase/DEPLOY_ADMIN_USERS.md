# Publicar admin-users

Na raiz do projeto:

```powershell
npx supabase@latest login
npx supabase@latest functions deploy admin-users --project-ref jrsjbcdahqpcgcvzdtfb --no-verify-jwt
```

A função valida o usuário logado e só permite operações quando o perfil está ativo e possui a permissão `ADMIN_USERS`. O ADMIN continua tendo todas as permissões por definição. Na v1.4.0 a função também aceita os cargos `VENDEDOR` e `GERENTE_VENDAS` e grava os overrides de funcionalidades em `user_permissions`.

Depois do deploy, atualize a aplicação e tente criar o usuário novamente. Se houver erro, a própria tela exibirá a causa devolvida pela função.
