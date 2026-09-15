# Disb Gestão v1.1.4

## Puxada - GPS
- Apontamentos manuais da Puxada passam a exigir precisão configurada entre 5 e 30 metros.
- A configuração existente é ajustada automaticamente para no máximo 30 m pelo SQL 10.
- No APK, a captura deixa de fazer várias chamadas longas em sequência e passa a acompanhar o GPS continuamente por uma janela curta.
- O sistema reaproveita uma leitura recente e precisa do rastreio, reduzindo a espera ao registrar a etapa.
- Enquanto busca sinal, a tela mostra a melhor precisão obtida.
- Se o Android estiver fornecendo apenas localização aproximada, é exibida orientação para ativar Localização Precisa.
- Pontos de rastreio com precisão acima do limite não são enviados, reduzindo linhas erráticas no mapa.

## Responsável por etapa
- Cada etapa principal possui o campo Motorista responsável: Motorista 1 ou Motorista 2.
- A saída inicial permanece obrigatoriamente com o Motorista 1.
- A tela do motorista só libera o apontamento para o motorista definido na etapa.
- O backend também valida o motorista responsável.
- As ocorrências continuam sendo registradas pelo motorista ativo.

## Dashboards
- Dashboard reorganizado em filtros, resumo operacional, indicador selecionado, histograma e detalhamentos.
- Novo histograma de horários de chegada à fábrica com 24 faixas de uma hora.
- Resumo com quantidade de chegadas, faixa de pico, mediana e amplitude de horários.
- Nova análise por fábrica com chegadas, faixa de pico, mediana, primeira e última chegada.

## Banco
Execute no Supabase, uma única vez:

`supabase/10_v1_1_4_gps_motorista_dashboard.sql`
