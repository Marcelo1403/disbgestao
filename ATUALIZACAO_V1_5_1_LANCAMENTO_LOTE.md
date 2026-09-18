# Disb Gestao v1.5.1 - melhoria do lancamento de avarias

Atualizacao complementar da v1.5.1.

## Alteracoes
- Botao individual de **Registrar avaria como lancada** ampliado e destacado.
- Produtos com status **APROVADO** podem ser selecionados por checkbox.
- **Selecionar tudo** inclui os produtos aprovados disponiveis para lancamento.
- Nova acao em lote: **Marcar selecionados como lancados**.
- A acao em lote reutiliza a RPC existente `mark_sales_damage_item_launched`, portanto nao exige SQL novo.
- Mantida a permissao `SALES_DAMAGE_POST`.
- Cache web atualizado para forcar a carga dos novos JS/CSS mantendo versionName 1.5.1.

## Banco de dados
Nenhuma alteracao adicional. O SQL 21 da v1.5.1 continua sendo a base do fluxo.
