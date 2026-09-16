# Disb Gestão v1.3.0 — Contagem FEFO

Esta versão incorpora ao Disb Gestão o fluxo operacional observado no **DisbStock V1.6**, adaptado ao visual, autenticação e arquitetura Supabase já utilizados pelo sistema.

## O que foi incorporado

- Novo módulo lateral **Contagem FEFO**.
- **Nova Contagem** por unidade.
- **Contagens em andamento** com retomada.
- Pesquisa do produto pelo código utilizando a base `products` do Disb Gestão.
- Exibição de nome e imagem do produto quando houver arquivo em `imagens_produtos/`.
- Campos operacionais do DisbStock: **Código, Nome, Validade, Rua, Palete, Lastro, Caixa e Unidade**.
- Validação de data vencida com confirmação para continuar.
- Inclusão, edição e exclusão de produtos antes da finalização.
- Ordenação dos itens pela menor validade para apoiar FEFO.
- **Finalizar Contagem** com bloqueio de edição posterior.
- Histórico em **Relatórios FEFO**.
- Visualização detalhada de cada contagem.
- Exportação CSV no formato do DisbStock:
  `codigo;nome;validade;rua;palete;lastro;caixa;unidade`.
- Compartilhamento do CSV pelo recurso nativo do navegador/Android quando disponível; fallback para download.
- Realtime para atualizar contagens em andamento.
- Badge com quantidade de contagens abertas.

## Banco de dados

Execute uma única vez:

`supabase/17_v1_3_0_contagem_fefo.sql`

O script cria:

- `fefo_counts`
- `fefo_count_items`
- sequência de códigos `FEFO-000001...`
- RPCs de início, gravação/edição, exclusão, finalização e cancelamento
- RLS compatível com `ADMIN`, `COLABORADOR_ARMAZEM` e `CONFERENTE`
- Realtime das tabelas FEFO

## Catálogo do DisbStock

Foi extraído do APK o arquivo original de produtos com **19.978 produtos**:

`bases_fefo/PRODUTOS_DISBSTOCK_V1_6.csv`

Para utilizar esse catálogo no Disb Gestão:

1. Entre como Admin.
2. Abra **Administração > Bases / importação**.
3. Escolha **PRODUTOS**.
4. Importe `PRODUTOS_DISBSTOCK_V1_6.csv`.

O APK também contém **777 imagens de produtos**. O pacote de imagens é entregue separadamente para evitar tornar o patch principal desnecessariamente pesado. Extraia o conteúdo para `imagens_produtos/` se quiser utilizar as mesmas imagens do DisbStock.

## Android

A versão Android passa para:

- `versionCode 130`
- `versionName 1.3.0`

Depois de aplicar o patch, execute `npm run android:sync` antes de gerar o APK.
