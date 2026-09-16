# Referência funcional — DisbStock V1.6

O APK fornecido foi analisado para orientar a integração do módulo FEFO. A implementação v1.3.0 não copia o visual do DisbStock: ela transpõe o fluxo funcional para o padrão visual e técnico do Disb Gestão.

Elementos observáveis no APK que serviram de base:

- aplicativo Flutter identificado pelo pacote Dart `contagem_estoque`;
- armazenamento local SQLite `estoque.db`;
- tabela de produtos com `codigo` e `nome`;
- tabela de conferências com `codigo`, `nome`, `validade`, `rua`, `palete`, `lastro`, `caixa`, `unidade` e `status`;
- tela **Nova Contagem**;
- tela **Relatórios**;
- recuperação de registros `em_andamento`;
- busca de produto pelo código;
- gravação, atualização e exclusão de itens;
- validação de **Data vencida**, permitindo continuar mediante confirmação;
- ação **Finalizar Contagem**;
- geração e compartilhamento de relatório CSV;
- formato de data `dd/MM/yyyy`;
- nome de arquivo de relatório com timestamp `yyyyMMdd_HHmm`;
- cabeçalho CSV `codigo;nome;validade;rua;palete;lastro;caixa;unidade`;
- catálogo embarcado `assets/produtos.csv`;
- imagens embarcadas em `assets/imagens_produtos/`.

O APK não contém plugin de câmera/OCR ou leitura de código de barras entre as dependências específicas encontradas. Por isso a v1.3.0 não adiciona uma dependência de scanner inexistente no fluxo original analisado.

Na integração, o SQLite local foi substituído por tabelas Supabase multiusuário e o diretório local de relatórios foi substituído por histórico persistente no banco, mantendo download/compartilhamento CSV.
