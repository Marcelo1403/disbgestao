# Disb Gestão v1.4.0

## Permissões por funcionalidade

- Novos cargos: `VENDEDOR` e `GERENTE_VENDAS`.
- Cargo passa a funcionar como modelo de permissões padrão.
- Admin/usuário autorizado pode habilitar ou desabilitar funcionalidades individualmente.
- Botão **Restaurar padrão do cargo**.
- Permissões aplicadas no frontend, RLS, Storage e RPCs dos módulos existentes.
- Nova permissão `PULL_TMA_ADJUST` para ajuste auditado de TMA.

## Novo módulo: Avarias de Vendas

### Vendedor
- Data automática.
- Vendedor automático.
- Código PDV e informações do cliente.
- Vários produtos por solicitação.
- Quantidade e unidade: Caixa ou Unidade.
- Motivo.
- Se motivo = Validade, a data de validade é obrigatória.
- Exatamente uma foto obrigatória por produto.
- Sem GPS.
- Foto comprimida no navegador antes do upload.

### Gerente de Vendas
- Mesmo cadastro do Vendedor.
- Consulta todas as solicitações.
- Pode selecionar um ou mais produtos pendentes para aprovar/reprovar.
- Justificativa obrigatória para aprovação e reprovação.
- Auditoria por produto.

### Admin
- Acesso integral.
- Pode reprovar uma aprovação registrada por Gerente de Vendas.
- Reversão exige justificativa e preserva a decisão original do gerente.

## Banco / Storage

Novas tabelas:
- `permissions`
- `role_permissions`
- `user_permissions`
- `sales_damage_requests`
- `sales_damage_items`

Novo bucket privado:
- `avarias-vendas`

## Implantação

1. Executar `supabase/18_v1_4_0_permissoes_avarias_vendas.sql`.
2. Republicar `supabase/functions/admin-users`.
3. Publicar os arquivos web v1.4.0.

O SQL 18 pressupõe que os scripts anteriores, inclusive o SQL 17 do FEFO, já foram aplicados.

## Correção da base de clientes (até 5.000)

- A base de clientes passa a ser carregada de forma paginada em blocos de 1.000 registros, até 5.000 clientes.
- Avarias de Entrega e Avarias de Vendas usam a mesma base completa.
- Se o Código PDV não estiver no cache carregado, o sistema faz consulta direta ao Supabase pelo código antes de informar que o cliente não foi localizado.
- Códigos existentes em mais de uma filial continuam exigindo a seleção do cliente/filial correta.
- A base de produtos também passa a usar paginação, com capacidade preparada para até 25.000 produtos, evitando o mesmo limite padrão de 1.000 linhas.

## Ajuste de lotes alfanuméricos

- Campos de **Lote** em NRI e Avarias de Entrega aceitam somente letras e números.
- Espaços, hífens, barras, pontos e demais caracteres especiais são removidos imediatamente ao digitar ou colar.
- Os lotes continuam sendo normalizados em maiúsculas.


### Hotfix compatibilidade de clientes
- SQL 18 agora adiciona `customers.id` de forma idempotente para bases antigas antes de criar Avarias de Vendas.
- Cache de clientes foi versionado para descartar a carga antiga limitada/incompleta.
- Busca de PDV mantém modo compativel mesmo se a coluna `id` ainda nao existir, permitindo Avarias de Entrega localizar clientes.

## Ajuste complementar — seletor visual de produtos em Avarias de Vendas

- O campo Produto avariado agora pesquisa a base ativa de produtos por código ou descrição.
- A lista exibe foto do produto quando disponível, código e descrição.
- A seleção é obrigatória: não é mais possível cadastrar texto livre como produto na Avaria de Vendas.
- A busca local usa a base já paginada de até 25.000 produtos e limita apenas a renderização simultânea a 200 resultados; todos os produtos continuam pesquisáveis.
- Foram incluídas as imagens disponíveis do catálogo DisbStock V1.6 em `imagens_produtos/`; produtos sem imagem disponível exibem `Sem foto`.
- Não há SQL adicional para este ajuste.
