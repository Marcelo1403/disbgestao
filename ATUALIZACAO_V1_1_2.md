# Disb Gestão v1.1.2

Atualização do módulo de Puxada.

## Alterações
- Unidade do NRI preenchida pela Puxada continua selecionada, mas pode ser editada pelo conferente.
- Motorista não escolhe mais parceiro/transportadora ao iniciar a viagem. Para novas viagens, o parceiro enviado é sempre `Ambev`.
- Não existe unidade padrão da Puxada: a origem continua sendo escolhida em cada viagem entre as unidades ativas.
- Etapas principais são exibidas com numeração sequencial.
- O mapa dos detalhes da Puxada mostra um marcador numerado para cada etapa com GPS registrado.
- O Histórico ganhou uma coluna para cada etapa principal, com data/hora, responsável e precisão do GPS.
- O Histórico pode ser baixado em CSV. O CSV inclui os horários e dados GPS de cada etapa.

## Banco de dados
Esta versão não exige novo SQL quando a v1.1.1 já foi aplicada no Supabase.
