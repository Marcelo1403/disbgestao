# Checklist de homologação

Antes de desligar os aplicativos antigos, valide:

- [ ] Login ADMIN
- [ ] Login Colaborador Armazém
- [ ] Login Colaborador Entrega
- [ ] Login Conferente
- [ ] Cadastro de carreta com vários produtos/lotes
- [ ] Geração correta da quantidade de NRIs
- [ ] Impressão de 3 etiquetas por NRI
- [ ] Confirmação de impressão e saída da fila em tempo real
- [ ] Pesquisa de lote no histórico NRI
- [ ] Cadastro de avaria com foto + GPS + assinatura
- [ ] Google Maps no detalhe da avaria
- [ ] Aprovação por produto e aprovação em lote
- [ ] Cadastro de conferência de vasilhames
- [ ] Minhas conferências
- [ ] Importação MAPAS
- [ ] Dashboard e rankings
- [ ] Criação/edição de usuários pelo Admin
- [ ] Teste no celular instalado como PWA

---

## Contagem FEFO — v1.3.0

- [ ] Perfil ADMIN visualiza o módulo Contagem FEFO.
- [ ] Perfil COLABORADOR_ARMAZEM visualiza o módulo Contagem FEFO.
- [ ] Perfil CONFERENTE visualiza o módulo Contagem FEFO.
- [ ] Motorista de entrega e Motorista Puxador não recebem o módulo FEFO por padrão.
- [ ] Nova contagem exige uma unidade ativa.
- [ ] Um usuário com contagem em andamento é orientado a retomar a existente.
- [ ] Código cadastrado carrega nome e, se disponível, imagem do produto.
- [ ] Código inexistente informa “Produto não cadastrado”.
- [ ] Validade aceita DD/MM/AAAA.
- [ ] Data vencida exibe confirmação antes de salvar.
- [ ] Rua, Palete, Lastro, Caixa e Unidade são persistidos.
- [ ] Item pode ser editado enquanto a contagem está em andamento.
- [ ] Item pode ser excluído enquanto a contagem está em andamento.
- [ ] Lista da contagem fica ordenada por validade.
- [ ] Finalização é bloqueada quando não há itens.
- [ ] Finalizar altera a contagem para concluída e impede edição posterior.
- [ ] Contagem finalizada aparece em Relatórios.
- [ ] CSV usa cabeçalho codigo;nome;validade;rua;palete;lastro;caixa;unidade.
- [ ] CSV usa nome contagem_yyyyMMdd_HHmm.csv.
- [ ] Badge “Em andamento” atualiza via Realtime.

## v1.3.1
- [ ] NRI AMBEV mostra apenas placas ativas cadastradas em Veiculos / parceiros.
- [ ] NRI originada pela Puxada exibe a placa vinculada mesmo quando o campo fica bloqueado.
- [ ] Marketplace continua mostrando placa `--` e bloqueada.
- [ ] Puxada e Transferencia usam seletor de placa e nao permitem digitacao livre.
- [ ] FEFO finalizado oferece Baixar CSV e Fechar, sem Compartilhar.
- [ ] Relatorios FEFO exibem Visualizar e CSV, sem Compartilhar.

## v1.4.0 - Permissões e Avarias de Vendas

### Usuários / permissões
- [ ] Cadastro de usuário oferece os cargos Vendedor e Gerente de Vendas.
- [ ] Ao trocar o cargo, as permissões padrão são carregadas corretamente.
- [ ] Botão Restaurar padrão do cargo volta ao conjunto padrão.
- [ ] É possível habilitar e desabilitar funcionalidades individualmente para usuário não-Admin.
- [ ] Permissão removida oculta menu/tela e também bloqueia a RPC/RLS no Supabase.
- [ ] Usuário com ADMIN_USERS consegue criar/editar usuários pela Edge Function.
- [ ] Admin continua com acesso a todas as funcionalidades.
- [ ] PULL_TMA_ADJUST controla a ação Ajustar TMA e registra auditoria.

### Vendedor
- [ ] Vendedor vê Nova solicitação e Minhas solicitações de Avarias de Vendas por padrão.
- [ ] Data é preenchida automaticamente.
- [ ] Vendedor é preenchido automaticamente pelo usuário autenticado.
- [ ] Código PDV localiza e exibe as informações do cliente.
- [ ] Código PDV duplicado entre filiais exige seleção do cliente correto.
- [ ] Solicitação aceita um ou vários produtos.
- [ ] Cada produto exige quantidade, Caixa/Unidade, motivo e exatamente uma foto.
- [ ] Motivo Validade exige data de validade.
- [ ] Demais motivos não exigem validade.
- [ ] Fluxo de Vendas não solicita nem grava GPS.
- [ ] Foto é comprimida antes do envio ao Storage.
- [ ] Solicitação criada aparece em Minhas solicitações.

### Gerente de Vendas
- [ ] Gerente possui o mesmo cadastro de solicitação do Vendedor.
- [ ] Gestão lista solicitações de todos os vendedores.
- [ ] Detalhe exibe dados do PDV, vendedor, produtos e foto de cada produto.
- [ ] É possível selecionar um ou vários produtos pendentes.
- [ ] Aprovação exige justificativa no campo da própria tela.
- [ ] Reprovação exige justificativa no campo da própria tela.
- [ ] Decisão registra responsável, cargo, horário e justificativa por produto.
- [ ] Status da requisição passa para Pendente, Parcial, Aprovado ou Reprovado conforme os itens.

### Admin / reversão
- [ ] Admin acessa todas as solicitações.
- [ ] Admin consegue selecionar produto aprovado por Gerente de Vendas.
- [ ] Reprovar aprovação do gerente exige justificativa.
- [ ] Reversão registra Admin, data/hora e justificativa sem apagar a decisão original do gerente.
- [ ] Produto revertido aparece como REPROVADO PELO ADMIN.

### Regressão dos módulos existentes
- [ ] NRI Create/Print/History respeitam permissões no backend.
- [ ] Avarias de Entrega Create/View/Review respeitam permissões no backend e no Storage.
- [ ] Conferência Create/Own/History/Dashboard respeitam permissões.
- [ ] FEFO Create/Active/Report respeitam permissões; usuário somente FEFO_ACTIVE visualiza sem editar.
- [ ] Marketplace Receive respeita permissão.
- [ ] Puxada Trip/Farol/History/Dashboard/Goals/Config respeitam permissões.
- [ ] Bases / importação respeita ADMIN_BASES.


### v1.4.0 - Bases paginadas / busca de PDV
- [ ] A carga de clientes busca todos os registros em páginas de 1.000 até o limite de 5.000.
- [ ] Com mais de 1.000 clientes, PDVs acima da primeira página são encontrados em Avarias de Entrega.
- [ ] Com mais de 1.000 clientes, PDVs acima da primeira página são encontrados em Avarias de Vendas.
- [ ] Se um PDV não estiver no cache, a aplicação consulta o Supabase diretamente pelo código.
- [ ] PDV duplicado entre filiais continua apresentando seletor de cliente/filial.
- [ ] A carga de produtos é paginada e não fica restrita aos primeiros 1.000 registros.

- [ ] **Lote alfanumérico:** em NRI e Avarias de Entrega, confirmar que os campos de lote aceitam apenas A-Z e 0-9, inclusive ao colar texto com caracteres especiais.
