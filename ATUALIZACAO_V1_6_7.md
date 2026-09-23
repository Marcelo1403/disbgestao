# Disb Gestão v1.6.7

Melhoria exclusiva do módulo **Avarias de Vendas**.

## Alterações
- Novo campo **Observação da solicitação (opcional)** no cadastro de Avaria de Vendas.
- A observação é da solicitação inteira, não de cada produto.
- Limite de 500 caracteres.
- A observação é exibida em destaque no detalhe da solicitação para Gerente de Vendas, decisão final e demais usuários com acesso ao fluxo.
- Ao limpar/enviar uma solicitação, o campo é zerado normalmente.
- Nenhuma alteração em Avarias de Entrega, NRI, FEFO, Ativo de Giro ou Puxada.

## Supabase
Executar manualmente o SQL `29_v1_6_7_observacao_avarias_vendas.sql`.

Android: versionCode 167 / versionName 1.6.7.
