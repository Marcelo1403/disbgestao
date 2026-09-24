# Disb Gestão v1.6.8

## Alterações
- Avarias de Entrega: botão **Baixar CSV** na página **Todas as avarias**.
- Avarias de Vendas: botão **Baixar CSV** na página **Gestão de solicitações**.
- Os CSVs respeitam os filtros atuais e exportam uma linha por produto, com dados da solicitação, status e histórico de decisão/lançamento/entrega.
- Avarias de Vendas: quem possui `SALES_DAMAGE_OVERRIDE` pode realizar a decisão final diretamente em itens `PENDENTE`, sem depender da aprovação prévia do GV.
- O fluxo tradicional `PENDENTE -> EM_ANALISE (GV) -> decisão final` continua funcionando.
- Corrigidos os emojis do comprovante WhatsApp usando escapes Unicode, evitando caracteres corrompidos no navegador/Android.

## SQL manual
Executar:
`supabase/30_v1_6_8_decisao_final_direta_avarias_vendas.sql`

Android: versionCode 168 / versionName 1.6.8.
