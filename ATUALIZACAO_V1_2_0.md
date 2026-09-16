# Disb Gestão v1.2.0

## Principais incrementos

### Recebimento Marketplace
- nova tela para Colaborador Armazém / Conferente;
- seleção de unidade e fornecedor;
- data, hora de início, hora de fim e conferente automáticos;
- cronômetro de recebimento em tempo real;
- duração gravada em segundos para análises e histogramas futuros;
- ao finalizar, o recebimento entra em **Recebimentos pendentes** e segue o mesmo fluxo de cadastro/impressão de NRI;
- no NRI vinculado ao Marketplace, o campo **Fábrica** recebe automaticamente o fornecedor do recebimento;
- cadastro de fornecedores Marketplace disponível ao ADMIN.

### NRI - Palete avariado
- nova pergunta **Palete avariado?**, iniciando em **Não**;
- ao marcar **Sim**, exige quantidade de paletes avariados, motivo e de 1 a 5 fotos;
- fotos ficam armazenadas no bucket privado `nri-avarias`;
- avaria fica vinculada à requisição, produto, lote e quantidade de paletes.

### Puxada x Transferência
- motorista escolhe **Puxada** ou **Transferência** antes de iniciar;
- Puxada mantém o fluxo atual;
- Transferência usa placa + origem fixa **Matriz Caicó** e rota Matriz → Filial Pau dos Ferros → Matriz;
- etapas da Transferência: Saída da revenda Matriz, Chegada na Filial, Saída da Filial, Chegada na Matriz;
- ocorrências são iguais às da Puxada e continuam bloqueando etapas obrigatórias enquanto abertas;
- dados ficam separados por `cycle_type` e podem ser filtrados como Todos, Puxada ou Transferência em Histórico e Dashboard.

### Dashboards
- mantém o histograma de chegada à fábrica para Puxadas;
- adiciona histograma de **chegada à revenda / final do ciclo** usando `ended_at`;
- em Transferência, o final do ciclo é a chegada à Matriz Caicó;
- filtro por tipo permite analisar todos os ciclos ou cada fluxo separadamente.

## Banco de dados obrigatório
Execute no Supabase, depois dos scripts 12, 13 e 14:

`supabase/15_v1_2_0_marketplace_transferencia_avarias.sql`

Esse script cria as tabelas/RPCs do Marketplace, armazenamento e dados de avaria de palete e o fluxo de Transferência.
