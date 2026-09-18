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


### Hotfix compatibilidade de clientes
- SQL 18 agora adiciona `customers.id` de forma idempotente para bases antigas antes de criar Avarias de Vendas.
- Cache de clientes foi versionado para descartar a carga antiga limitada/incompleta.
- Busca de PDV mantém modo compativel mesmo se a coluna `id` ainda nao existir, permitindo Avarias de Entrega localizar clientes.

## Avarias de Vendas — seletor de produtos
- [ ] Ao focar Produto avariado, a lista da base aparece.
- [ ] Digitar `SKOL` filtra produtos contendo SKOL na descrição.
- [ ] Cada opção exibe código, descrição e foto quando disponível; sem imagem mostra `Sem foto`.
- [ ] Pesquisar pelo código também localiza o produto.
- [ ] Não é possível adicionar produto sem selecionar uma opção da lista.
- [ ] O produto adicionado mostra código e descrição e mantém a foto da avaria obrigatória.


## v1.4.1 - Seletor NRI/FEFO e múltiplos lotes

- [ ] NRI: pesquisar produto por código parcial e selecionar o item correto.
- [ ] NRI: pesquisar produto por descrição e confirmar imagem/código/nome selecionados.
- [ ] NRI: adicionar 2 ou mais lotes ao mesmo produto e mesma validade; os lotes devem aparecer juntos no item da carreta.
- [ ] NRI: editar o item e confirmar que todos os lotes voltam como chips editáveis.
- [ ] NRI: impedir cadastro sem produto selecionado e sem ao menos um lote.
- [ ] FEFO: executar `supabase/19_v1_4_1_multiplos_lotes_fefo.sql` antes do teste.
- [ ] FEFO: pesquisar produto por código e por descrição no novo seletor visual.
- [ ] FEFO: adicionar 2 ou mais lotes para o mesmo produto/validade e salvar.
- [ ] FEFO: editar o item e confirmar preservação dos lotes.
- [ ] FEFO: conferir Lote(s) na tabela da contagem, relatório detalhado, pesquisa e CSV.
- [ ] FEFO: impedir salvamento sem produto selecionado, validade ou lote.
- [ ] Android: `npm run android:sync` deve aplicar `versionCode 141` e `versionName 1.4.1`.

## v1.5.0 - Ativo de Giro e barra lateral por áreas

- [ ] Executar `supabase/20_v1_5_0_ativo_giro_sidebar.sql` depois do SQL 19.
- [ ] Conferente/Colaborador de Armazém visualiza **Armazém > Ativo de Giro**.
- [ ] Iniciar contagem informando a unidade.
- [ ] Lista contém todos os ativos do formulário fornecido.
- [ ] Registrar 20 em CAIXA/GFA para CERVEJA 600ML.
- [ ] Voltar ao mesmo item e registrar mais 50 em CAIXA/GFA.
- [ ] Total atual do item passa a C 70 sem apagar as duas adições.
- [ ] Excluir uma adição recalcula o total.
- [ ] Finalizar a contagem somente quando houver ao menos uma adição.
- [ ] Histórico exibe contagem, data, unidade, conferente, número de adições e totais consolidados.
- [ ] CSV do histórico contém os totais por ativo.
- [ ] Barra lateral possui as áreas Armazém, Entrega, Vendas, Puxada e Configurações.
- [ ] Cada área abre os módulos e cada módulo abre suas subtelas.
- [ ] A tela atual abre automaticamente a área/módulo correspondentes.
- [ ] Permissões continuam ocultando áreas e telas não autorizadas.
- [ ] `node --check app.js` sem erros.
- [ ] `npm run android:sync` aplica `versionCode 150` e `versionName 1.5.0`.


## v1.5.1 - Redesign visual

- [ ] Sidebar exibe as cinco áreas com contraste adequado e destaque da área/tela ativa.
- [ ] Armazém usa azul como cor de apoio.
- [ ] Entrega usa verde como cor de apoio.
- [ ] Vendas usa laranja como cor de apoio.
- [ ] Puxada usa roxo como cor de apoio.
- [ ] Configurações usa cinza/azul ardósia como cor de apoio.
- [ ] Cards, tabelas, inputs e botões seguem o novo padrão visual sem perda de funcionalidade.
- [ ] Layout permanece utilizável em celular e tablet.
- [ ] Ativo de Giro continua aceitando múltiplas adições e consolidando os totais.
- [ ] NRI e FEFO continuam aceitando múltiplos lotes.
- [ ] `npm run android:sync` aplica `versionCode 151` e `versionName 1.5.1`.


## v1.5.1 - Avarias: câmera, GPS e decisão final

### Captura de evidências
- [ ] Avarias de Vendas: não existe botão de upload/arquivo; existe somente **Abrir câmera**.
- [ ] Avarias de Rota/Entrega: não existe botão de upload/arquivo; existe somente **Abrir câmera**.
- [ ] Paletes Avariados no NRI: não existe botão de upload/arquivo; existe somente **Abrir câmera**.
- [ ] Avarias de Vendas: uma foto só é aceita depois de capturar GPS válido.
- [ ] Motivo diferente de Validade aceita no máximo 1 foto por produto.
- [ ] Motivo Validade exige data de validade e aceita 1 ou 2 fotos por produto.
- [ ] No detalhe de gestão, as fotos novas mostram GPS; foto histórica sem GPS aparece como legado/indisponível.

### Minhas solicitações
- [ ] O vendedor visualiza o status atual de cada produto: Pendente, Em análise, Aprovada, Reprovada ou Lançada.
- [ ] Em **Minhas solicitações** não aparecem o histórico/justificativas das decisões do GV nem da decisão final.
- [ ] Em **Minhas solicitações** não aparecem ações de aprovação, reprovação ou marcação de lançamento, mesmo se o mesmo usuário possuir permissões administrativas.

### Fluxo da gestão
- [ ] Solicitação nova inicia com produtos PENDENTE.
- [ ] `SALES_DAMAGE_REVIEW`: aprovar produto PENDENTE muda para EM_ANALISE.
- [ ] `SALES_DAMAGE_REVIEW`: reprovar produto PENDENTE muda para REPROVADO.
- [ ] `SALES_DAMAGE_OVERRIDE`: aprovar produto EM_ANALISE muda para APROVADO.
- [ ] `SALES_DAMAGE_OVERRIDE`: reprovar produto EM_ANALISE muda para REPROVADO.
- [ ] A tela exibe **Selecionar tudo** e a decisão em lote afeta todos os itens elegíveis selecionados.
- [ ] Produto APROVADO mostra **Avaria lançada** somente para usuário com `SALES_DAMAGE_POST`.
- [ ] Confirmar **Avaria lançada** muda somente o produto escolhido para LANCADO.
- [ ] O status consolidado da solicitação acompanha a combinação dos status dos produtos.
- [ ] Aprovações históricas anteriores à atualização permanecem APROVADO; não são reabertas automaticamente.

### Banco / atualização
- [ ] Executar `supabase/21_v1_5_1_avarias_vendas_fluxo_final_camera_gps.sql` depois do SQL 18.
- [ ] Confirmar no cadastro de permissões `SALES_DAMAGE_REVIEW`, `SALES_DAMAGE_OVERRIDE` e `SALES_DAMAGE_POST`.
- [ ] Conceder `SALES_DAMAGE_POST` apenas aos usuários autorizados a confirmar lançamento no sistema.
- [ ] `node --check app.js` sem erros.
- [ ] `npm run android:sync` continua aplicando `versionCode 151` e `versionName 1.5.1`.
