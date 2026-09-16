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
- [ ] Compartilhar CSV abre o compartilhamento nativo quando suportado.
- [ ] Em dispositivo sem compartilhamento de arquivo, a ação faz fallback para download.
- [ ] Badge “Em andamento” atualiza via Realtime.

## v1.3.1
- [ ] NRI AMBEV mostra apenas placas ativas cadastradas em Veiculos / parceiros.
- [ ] NRI originada pela Puxada exibe a placa vinculada mesmo quando o campo fica bloqueado.
- [ ] Marketplace continua mostrando placa `--` e bloqueada.
- [ ] Puxada e Transferencia usam seletor de placa e nao permitem digitacao livre.
- [ ] FEFO finalizado oferece Baixar CSV e Fechar, sem Compartilhar.
- [ ] Relatorios FEFO exibem Visualizar e CSV, sem Compartilhar.
