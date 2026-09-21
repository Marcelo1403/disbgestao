# v1.5.1 - Fluxo de avarias, comprovante WhatsApp, contatos e descarte NRI

## Recebimentos pendentes
- Adiciona **Descartar pendência** para Puxada e Marketplace quando o veículo já chegou com NRI.
- O descarte altera somente o estado da emissão de NRI para `DISCARDED`.
- O histórico da Puxada ou do recebimento Marketplace permanece gravado.

## Avarias de Entrega
Novo fluxo por produto:

`PENDENTE -> APROVADO / REPROVADO -> LANCADO -> ENTREGUE`

- Aprovação/reprovação exige justificativa.
- Nova permissão `DELIVERY_DAMAGE_POST` para lançamento e entrega.
- O usuário que marcou um produto como **Lançado no Sistema** é o mesmo que pode confirmar **Entregue**.
- Auditoria guarda usuário e data do lançamento e da entrega.
- Status possuem identificação visual distinta.

## Avarias de Vendas
- Mantém o fluxo atual de Gerente de Vendas e decisão final.
- Depois de **Lançado no Sistema**, passa a existir **Entregue**.
- A confirmação de entrega é feita pelo mesmo usuário que registrou o lançamento.

## Comprovante de avaria para WhatsApp
Após registrar uma Avaria de Entrega, o motorista recebe uma tela de comprovante com:
- cliente / PDV;
- mapa;
- data;
- descrição dos produtos;
- quantidade;
- observação: **"O produto avariado será enviado junto ao próximo pedido realizado pelo cliente."**

Os contatos cadastrados são apresentados para abrir o WhatsApp com a mensagem preenchida. Quando houver mais de um número, há também a opção de abrir o comprovante para todos os contatos. O WhatsApp ainda exige a confirmação do envio pelo usuário.

## Contatos de clientes
- Nova tabela `customer_contacts` no Supabase.
- Importa a base `CONTATOS_CLIENTES.csv`, preservando até 3 contatos por PDV e removendo duplicidades de PDV + telefone.
- Motorista pode cadastrar um novo número durante o envio do comprovante; ele fica salvo no cliente.
- Admin possui tela **Contatos de clientes** para pesquisar, cadastrar e excluir números.
- A interface mostra **Atualizado por último em DD/MM/AAAA**.

## Banco de dados
Executar manualmente:

`supabase/24_v1_5_1_fluxo_avarias_comprovante_contatos_nri.sql`

O SQL deve ser executado depois do SQL 23.

## Ajuste adicional - FEFO sem coluna de lote

- A visualizacao de detalhe/historico do FEFO nao exibe mais a coluna **Lote(s)**.
- O CSV do FEFO tambem deixa de exportar a coluna de lote.
- A alteracao e somente de interface/relatorio; NRI e demais modulos que usam lote permanecem inalterados.
