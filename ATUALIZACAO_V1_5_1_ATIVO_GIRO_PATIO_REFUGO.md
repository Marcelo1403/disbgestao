# Disb Gestão v1.5.1 — Ativo de Giro por Pátio / Refugo

Atualização incremental da v1.5.1.

## Alterações

- Ao abrir uma área da barra lateral, todos os submódulos começam recolhidos.
- O estado aberto de NRI/FEFO/Ativo de Giro/etc. não é mais restaurado automaticamente ao recarregar.
- Melhorias no cadastro de Ativo de Giro no mobile:
  - cabeçalho desktop oculto no celular;
  - nome do ativo maior;
  - campos numéricos maiores;
  - cartão mais organizado.
- Cada adição de Ativo de Giro agora possui local:
  - **Pátio** (padrão);
  - **Refugo**.
- Totais do item são exibidos separadamente por Pátio e Refugo.
- Últimas adições exibem o local registrado.
- Histórico de cada contagem exibe resumo separado de Pátio e Refugo.
- Detalhamento e CSV também separam os totais por local.
- Registros antigos são migrados para **Pátio** para preservar o histórico.

## Banco de dados

Executar:

`supabase/23_v1_5_1_ativo_giro_patio_refugo.sql`

O SQL adiciona a coluna `location` em `rotating_asset_entries` e atualiza a RPC `add_rotating_asset_entry`.
