# Disb Gestão v1.2.2

## NRI - palete avariado
- Ao marcar **Palete avariado = Sim**, o campo **Número da Nota Fiscal** passa a ser obrigatório.
- O número da NF é salvo somente na rastreabilidade da avaria e **não aparece na impressão da NRI**.
- Novo submódulo **NRI > Paletes avariados** com histórico separado, filtros, fotos, rastreabilidade completa e CSV.

## Marketplace
- O histograma passou a representar o **horário de início do recebimento**, e não a duração do atendimento.
- Distribuição em 24 faixas horárias, com pico, mediana, primeiro e último horário.
- Análise por fornecedor e unidade.

## Navegação
- Módulos e submódulos ganharam hierarquia visual mais clara.
- Apenas um módulo lateral permanece aberto por vez. Ao abrir outro, o anterior fecha automaticamente.

## Dashboards
- Dashboard de Conferência e Dashboard da Puxada receberam nova hierarquia visual, filtros destacados, KPIs mais legíveis, seções e histogramas organizados.

## Banco de dados obrigatório
Execute no Supabase SQL Editor:

`supabase/16_v1_2_2_nf_historico_paletes_avariados.sql`
