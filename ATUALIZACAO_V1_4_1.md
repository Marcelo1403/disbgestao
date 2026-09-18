# Disb Gestão v1.4.1

## Alterações

- NRI: campo de produto agora usa o mesmo seletor pesquisável por código/descrição do módulo de Avarias, com imagem e confirmação visual do item selecionado.
- Contagem FEFO: campo de produto também usa o seletor pesquisável com imagem.
- NRI: permite registrar vários lotes para o mesmo produto e a mesma validade. Os lotes são armazenados em uma única referência, separados visualmente por ` - `.
- FEFO: passa a registrar lote(s) por item e permite vários lotes para o mesmo produto/validade.
- Relatórios e CSV do FEFO passam a exibir a coluna `Lote(s)`.

## Banco de dados

Antes de usar a nova Contagem FEFO, execute no Supabase:

`supabase/19_v1_4_1_multiplos_lotes_fefo.sql`

O SQL adiciona a coluna `lot` em `fefo_count_items` e atualiza a RPC `save_fefo_item`.

## Android

A preparação Android foi atualizada para `versionCode 141` e `versionName 1.4.1`.
