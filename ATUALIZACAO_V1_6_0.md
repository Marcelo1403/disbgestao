# Disb Gestao v1.6.0

Versao dedicada a continuidade operacional sem sinal, integridade dos lotes, correcao auditada do Ativo de Giro e separacao dos dados por unidade.

## 1. Modo offline e sincronizacao automatica

O modo offline foi limitado aos processos em que a operacao precisa continuar mesmo sem internet:

- **FEFO**: iniciar/continuar a contagem, incluir/alterar/excluir itens e finalizar. Os registros ficam no aparelho e entram na fila de sincronizacao.
- **Avaria de Entrega**: o motorista consegue registrar a avaria, fotos, GPS e assinatura. O envio ao servidor fica pendente ate a internet retornar. O comprovante de WhatsApp so e liberado depois da sincronizacao.
- **Puxada / Transferencia**: as etapas do ciclo podem ser registradas sem sinal e sao sincronizadas quando a conexao retorna.

A fila usa IDs unicos por operacao para impedir duplicidade em novas tentativas de sincronizacao. O topo do app mostra o estado Online/Offline e a quantidade pendente.

## 2. Ativo de Giro

- Corrigido o fluxo de **Adicionar a contagem**, que podia nao registrar a adicao.
- Pátio e Refugo continuam separados.
- Admin pode corrigir uma adicao ja registrada.
- Toda correcao exige motivo e grava auditoria com valores anteriores, valores novos, usuario e data/hora.

## 3. NRI e lotes nas Avarias de Entrega

- Um item de NRI passa a representar **um unico lote**.
- Se o mesmo produto chegar com tres lotes, devem ser adicionados tres itens, um para cada lote.
- A conciliacao da Avaria de Entrega procura NRI pela combinacao **produto + lote**.
- Registros historicos que possuam mais de um lote no campo continuam sendo interpretados separadamente para compatibilidade.

## 4. Acesso por unidade

Na tela **Admin > Usuarios e perfis**, cada usuario ativo deve possuir uma ou mais unidades autorizadas.

Exemplos:

- Iago: Matriz Caico
- Isaac: Filial Pau dos Ferros
- Marcelo: Matriz Caico + Filial Pau dos Ferros

Quem possui uma unidade trabalha automaticamente nela. Quem possui mais de uma usa o seletor **Unidade atual** no topo. As telas operacionais trabalham com uma unidade por vez.

O controle tambem foi aplicado no Supabase por RLS para impedir consulta cruzada de dados fora das unidades autorizadas. O vinculo de unidades do usuario possui auditoria.

### Importante depois do SQL 26

- Os ADMINs ativos existentes recebem inicialmente todas as unidades ativas, para nao bloquear o primeiro acesso administrativo.
- Usuarios nao-Admin existentes devem ter suas unidades associadas pelo Admin antes de continuar usando os modulos operacionais.
- Depois do SQL 26, republique a Edge Function `admin-users` usando o arquivo deste pacote.

## 5. Banco de dados

Para uma instalacao que ja recebeu todos os patches anteriores da v1.5.1, execute manualmente no Supabase, nesta ordem:

1. `25_v1_6_0_offline_sync_ativo_giro_auditoria.sql`
2. `26_v1_6_0_unidades_por_usuario.sql`

O pacote tambem inclui os SQLs 22, 23 e 24 apenas para referencia/recuperacao de ambientes que ainda nao os receberam. Se eles ja foram executados, nao precisam ser executados novamente.

## 6. Edge Function obrigatoria

Depois de executar o SQL 26, publique novamente:

`supabase/functions/admin-users/index.ts`

Essa funcao passa a salvar as unidades selecionadas no cadastro/edicao de usuarios e registrar a auditoria das alteracoes.

## 7. Android

- Versao: **1.6.0**
- `versionCode`: **160**
- `versionName`: **1.6.0**

Use `npm run android:sync` antes de gerar o APK.
