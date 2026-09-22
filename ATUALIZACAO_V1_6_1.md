# Disb Gestão v1.6.1

Hotfix do cadastro de usuários e associação de unidades.

## Problema corrigido

Na v1.6.0, ao editar um usuário e salvar as unidades de acesso, uma falha retornada pelo Supabase podia chegar à interface apenas como `[object Object]`. Além disso, a substituição dos vínculos em `user_units` era feita em várias operações separadas pela Edge Function.

## Alterações

- Novo RPC `admin_set_user_units` no SQL 27.
- A troca das unidades do usuário passa a ocorrer em uma única transação no PostgreSQL.
- Continua obrigatório selecionar ao menos uma unidade para usuários ativos.
- As unidades são validadas contra a base `units` e precisam estar ativas.
- A alteração continua registrada em `user_unit_access_audit`.
- A Edge Function `admin-users` passa a usar o RPC autenticado para salvar as unidades.
- Erros do Supabase agora preservam `message`, `details`, `hint` e `code`, eliminando o toast genérico `[object Object]`.
- O frontend também trata corretamente erros estruturados da Edge Function.

## Aplicação

1. Execute manualmente no SQL Editor do Supabase:
   `supabase/27_v1_6_1_corrige_unidades_usuario.sql`
2. Aplique os arquivos do patch.
3. Republique a Edge Function `admin-users`.
4. Rode `npm run android:sync`.
5. Gere o APK.

## Versão

- Web: 1.6.1
- Android: versionCode 161 / versionName 1.6.1
