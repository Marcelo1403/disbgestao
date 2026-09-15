# Disb Gestão v1.1.0 — Módulo Puxada

## O que entrou

- Novo perfil `MOTORISTA_PUXADOR` (Motorista Puxador).
- Puxada compartilhada entre Motorista 1 e Motorista 2.
- Início de viagem com placa, fábrica, Motorista 2 e GPS.
- Etapas principais configuráveis pelo ADMIN, com sequência controlada.
- Ocorrências configuráveis (descanso, abastecimento, manutenção, espera etc.).
- Todos os apontamentos registram usuário, horário do servidor, GPS e precisão.
- Troca de motorista alterna o motorista ativo do ciclo.
- Chegada à fábrica pode validar geofence por latitude, longitude e raio em metros.
- Farol de andamento com última posição, etapa e mapa/linha do tempo.
- Histórico com percurso, etapas, ocorrências e auditoria.
- Metas globais anuais para TMV Ida, TMA Fábrica, TMV Volta, TMA Revenda e Ciclo.
- Dashboard e Planificador com filtros por período, transportadora, fábrica, placa/motorista.
- TMA Revenda = chegada à revenda até a próxima saída da mesma placa.
- ADMIN pode registrar “Horas a diminuir” no TMA Revenda com motivo e auditoria.
- Chegada à revenda cria automaticamente uma carreta pendente no módulo NRI.
- NRI iniciado pela Puxada recebe automaticamente unidade, tipo Ambev, data, hora, motorista de chegada, placa e fábrica.

## Banco de dados

Execute uma única vez `supabase/08_v1_1_0_modulo_puxada.sql` antes de usar a nova versão.

## Edge Function

A função `supabase/functions/admin-users/index.ts` foi atualizada para aceitar o perfil `MOTORISTA_PUXADOR`. Depois de substituir os arquivos, republique `admin-users`.

## GPS / percurso

Cada etapa sempre exige captura de GPS. O aplicativo também registra pontos de percurso enquanto a Puxada está ativa e o Android/web app mantém o rastreamento disponível. A v1.1.0 não instala um serviço nativo de rastreamento permanente com o aplicativo totalmente encerrado.
