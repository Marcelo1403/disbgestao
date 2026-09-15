# Disb Gestão v1.1.9

## Trava de etapa durante ocorrência

Enquanto uma ocorrência estiver em andamento (`pull_occurrences.status = OPEN`), a próxima etapa principal obrigatória da Puxada fica bloqueada.

- O botão da próxima etapa fica desabilitado e informa qual ocorrência precisa ser finalizada.
- A mensagem da etapa explica que o ciclo está pausado pela ocorrência.
- Os botões para iniciar outra ocorrência também ficam bloqueados enquanto houver uma aberta.
- Ao encerrar a ocorrência, a próxima etapa é liberada automaticamente após a atualização da viagem.
- A regra também foi adicionada no Supabase (`record_pull_step`), impedindo que uma etapa obrigatória seja gravada por chamada direta/API enquanto existir ocorrência aberta.

## Banco

Execute `supabase/13_v1_1_9_bloqueia_etapas_ocorrencia.sql` depois da migração `12_v1_1_8_corrige_limite_gps_rpc.sql`.
