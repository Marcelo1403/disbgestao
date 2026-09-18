# Disb Gestão — Supabase

Aplicativo unificado com **NRI + Avarias + Conferência de Vasilhames**, usando Supabase/PostgreSQL como banco principal.

## O que mudou

- Não usa Google Sheets/Apps Script nas operações do dia a dia.
- Cadastro, consultas e confirmações falam diretamente com o PostgreSQL do Supabase.
- A fila de NRI, avarias e conferências usa **Realtime**, sem atualização a cada 3 segundos.
- O navegador mantém as bases auxiliares em cache local para abrir os formulários mais rápido.
- Fotos e assinaturas de avarias ficam no **Supabase Storage**.
- O projeto é uma **PWA instalável** e já inclui estrutura para empacotar como APK com Capacitor.

## Perfis unificados

| Perfil | Acesso |
|---|---|
| ADMIN | Todos os módulos |
| COLABORADOR_ARMAZEM | Cadastro NRI e Impressões pendentes |
| COLABORADOR_ENTREGA | Registro de Avarias |
| CONFERENTE | Conferência de vasilhames e Minhas conferências |

## Módulos

### NRI
- Cadastro por carreta com vários produtos/lotes.
- Vários paletes/NRIs por produto/lote.
- Validade `dd/mm/aa`, bloqueio automático em validade - 30 dias.
- Fila de impressões em tempo real.
- 3 etiquetas idênticas por NRI em A4.
- Lote permanece no banco/histórico, mas não aparece na etiqueta.
- Histórico/rastreabilidade para Admin.

### Avarias
- Vários produtos na mesma requisição.
- Foto obrigatória por produto.
- GPS capturado ao escolher/tirar a foto.
- Assinatura do cliente.
- Google Maps no detalhamento Admin.
- Validação de lote contra o histórico de NRI.
- Aprovação/reprovação por produto.

### Conferência de Vasilhames
- Cadastro por mapa.
- Histórico individual do conferente.
- Histórico completo para Admin e exportação CSV.
- Dashboard planejado x conferido.
- Divergências positivas e negativas separadas.
- Ranking de motorista e ajudantes.
- Valores: 300ml R$ 69,50; 600 marrom R$ 71; 600 verde R$ 83; litrão R$ 59; barris 30/50L R$ 400.

---

# Instalação

## 1. Criar o projeto Supabase

Crie um projeto novo no Supabase.

No **SQL Editor**, execute:

`supabase/schema.sql`

Depois crie o primeiro usuário em **Authentication > Users > Add user**:

- e-mail: `marcelo@disbecol.app`
- senha: `Marcelo123`
- e-mail confirmado: sim

Em seguida execute:

`supabase/02_primeiro_admin.sql`

Isso promove Marcelo para ADMIN.

## 2. Implantar a função de Gestão de Usuários

O módulo Admin cria usuários através da Edge Function `admin-users`.

Com a Supabase CLI:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy admin-users
```

O código está em:

`supabase/functions/admin-users/index.ts`

O domínio interno padrão é `disbecol.app`. Não é necessário possuir esse domínio: ele é usado apenas como e-mail técnico interno do Supabase Auth.

## 3. Configurar o site

Em **Project Settings > API**, copie:

- Project URL
- anon / public key

Abra `config.js` e informe:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "SUA_ANON_KEY",
  USER_EMAIL_DOMAIN: "disbecol.app",
  PRODUCT_IMAGE_FOLDER: "imagens_produtos"
};
```

A **anon key pode ficar no frontend**; a segurança dos dados é controlada por Auth + RLS. Nunca coloque a `service_role` no GitHub.

## 4. Publicar no GitHub Pages

Envie os arquivos da raiz para um repositório e habilite GitHub Pages.

A aplicação funciona em HTTPS, necessário para GPS, câmera e instalação como PWA.

## 5. Migrar as bases atuais do Google Sheets

Entre como Admin e abra **Bases / importação**.

Exporte as abas atuais do Google Sheets como CSV e importe no aplicativo. Estão disponíveis:

- PRODUTOS
- UNIDADES
- MOTORISTAS
- FABRICAS
- CLIENTES
- MAPAS
- HISTÓRICO NRIS
- HISTÓRICO CONFERÊNCIAS

O importador reconhece os cabeçalhos usados nos aplicativos antigos.

### Usuários

As senhas antigas **não são migráveis**, porque o hash do Apps Script é diferente do Supabase Auth. Recrie os usuários pelo módulo **Usuários**. Os nomes de usuário podem permanecer iguais.

### Avarias antigas

A migração automática da parte textual e das fotos antigas do Google Drive não está incluída neste primeiro pacote. O sistema novo já registra todas as novas avarias no Supabase Storage.

## 6. Imagens dos produtos

Mantenha as imagens na pasta:

`imagens_produtos`

com o código como nome, por exemplo:

`9068.png`

Também são tentadas as extensões jpg, jpeg e webp.

---

# MAPAS após a migração

O Dashboard lê a tabela `maps` do Supabase. Para manter seu fluxo atual, você pode continuar preparando a aba MAPAS no Google Sheets e, ao finalizar, exportá-la como CSV e usar **Bases / importação > MAPAS**. O import é um *upsert*: o mesmo Mapa + Data é atualizado em vez de duplicado.

Isso evita que o aplicativo dependa do Google Sheets nas consultas do dia a dia.

---

# PWA / instalação no celular

No Chrome Android, abra o site publicado e use **Adicionar à tela inicial / Instalar aplicativo**. Ele abre como aplicativo, sem a barra normal do navegador.

# APK Android

A pasta `APK` e os arquivos do Capacitor já estão no projeto. Veja:

`APK/README_APK.md`

O APK usa exatamente o mesmo banco Supabase da versão web.

---

# Estrutura principal do banco

- `profiles`
- `products`
- `units`
- `drivers`
- `factories`
- `customers`
- `nri_requests`
- `nris`
- `print_events`
- `damage_requests`
- `damage_items`
- `container_conferences`
- `maps`

O bucket privado de fotos e assinaturas é `avarias`.

## v1.0.5 — Clientes por código + filial
A base de clientes agora aceita o mesmo Código PDV em filiais diferentes. A chave de importação é `Código PDV + Filial`.
Quando um código existir em mais de uma filial, o cadastro de Avarias solicita que o usuário selecione o cliente correto antes de continuar.

Para atualizar um banco criado em versões anteriores, execute `supabase/04_clientes_codigo_filial.sql` uma única vez no SQL Editor antes de importar CLIENTES.


## Alterações v1.0.7

- Dashboard e histórico de conferências conciliam `MAPA` pelo número, independentemente da data da linha em `MAPAS`.
- Quando houver mais de uma linha do mesmo mapa na base, é usada a ocorrência mais recente de `MAPAS`.
- O filtro de data do dashboard filtra a data da conferência; a base `MAPAS` continua disponível para localizar o mesmo número em qualquer data.
- A tela de usuários mostra uma mensagem específica quando a Edge Function `admin-users` não está publicada/acessível.
- Consulte `supabase/DEPLOY_ADMIN_USERS.md` para publicar a função.


## v1.1.0 - Módulo Puxada

A v1.1.0 adiciona o perfil **Motorista Puxador** e o módulo **Puxada**. O motorista inicia um ciclo informando placa, fábrica e Motorista 2; os dois usuários compartilham a mesma viagem, enquanto cada etapa é registrada com horário do servidor, GPS e usuário responsável.

O ADMIN possui Farol de andamento, Histórico, Dashboards, Metas e Configurações. As fábricas podem receber latitude, longitude e raio de geofence. O TMA Revenda é calculado entre a chegada da placa à revenda e a próxima saída da mesma placa, com ajuste manual auditado de horas a diminuir.

Na chegada à revenda, a carreta entra automaticamente em **NRI > Carretas pendentes**. Ao iniciar a conferência, unidade, tipo Ambev, data/hora, motorista que encerrou o ciclo, placa e fábrica são preenchidos automaticamente.

Antes de publicar esta versão execute `supabase/08_v1_1_0_modulo_puxada.sql` no SQL Editor e republique a Edge Function `admin-users`, pois ela passa a aceitar o perfil `MOTORISTA_PUXADOR`.

---

## v1.3.0 - Contagem FEFO

A v1.3.0 integra ao **Disb Gestão** o fluxo de contagem de estoque por FEFO baseado no aplicativo **DisbStock V1.6**.

O módulo usa a mesma autenticação, perfis, base de produtos, unidades e Supabase do restante do sistema. Os perfis `ADMIN`, `COLABORADOR_ARMAZEM` e `CONFERENTE` podem utilizar a Contagem FEFO.

Principais funções:

- iniciar uma nova contagem por unidade;
- retomar contagem em andamento;
- localizar produto pelo código e exibir nome/imagem quando disponível;
- registrar `Código`, `Nome`, `Validade`, `Rua`, `Palete`, `Lastro`, `Caixa` e `Unidade`;
- alertar quando a validade informada já passou e solicitar confirmação para continuar;
- editar e excluir itens enquanto a contagem estiver em andamento;
- ordenar os itens por validade para facilitar a aplicação do FEFO;
- finalizar a contagem;
- manter o relatório no Supabase;
- visualizar relatórios anteriores;
- baixar CSV com o cabeçalho `codigo;nome;validade;rua;palete;lastro;caixa;unidade`.

Antes de publicar, execute no SQL Editor:

`supabase/17_v1_3_0_contagem_fefo.sql`

O catálogo extraído do DisbStock V1.6 está em `bases_fefo/PRODUTOS_DISBSTOCK_V1_6.csv`. Se desejar utilizar essa base, importe em **Administração > Bases / importação > PRODUTOS**.

As imagens originais do catálogo são opcionais e podem ser copiadas para `imagens_produtos/`. O Disb Gestão já procura automaticamente por `.png`, `.jpg`, `.jpeg` e `.webp` usando o código do produto como nome do arquivo.

## v1.3.1 - Placas por cadastro e FEFO sem compartilhamento

- NRI: placa selecionada a partir dos veiculos ativos cadastrados em Puxada > Configuracoes.
- Puxada/Transferencia: placa selecionada no mesmo cadastro de veiculos, sem digitacao livre.
- FEFO: permanece com Visualizar e Baixar CSV; a opcao Compartilhar foi removida.
- Nenhum campo de area do armazem foi adicionado.
- Nao ha SQL novo nesta versao.

## v1.4.0 - Permissões por funcionalidade + Avarias de Vendas

A v1.4.0 adiciona os cargos **Vendedor** e **Gerente de Vendas** e muda o controle de acesso para **cargo + permissões por funcionalidade**. O cargo continua definindo um conjunto padrão, mas o responsável por Usuários pode habilitar ou desabilitar funções individualmente para cada usuário. O bloqueio é aplicado tanto na interface quanto nas RPCs/RLS do Supabase.

### Avarias de Vendas

- Vendedor: data e vendedor automáticos, Código PDV com preenchimento dos dados do cliente, vários produtos por solicitação, quantidade, Caixa/Unidade, motivo e uma foto obrigatória por produto.
- Motivo **Validade** exige data de validade.
- Não existe captura de GPS no fluxo de Vendas.
- A foto é comprimida no navegador antes do upload para reduzir consumo de Storage.
- Gerente de Vendas: consulta todas as solicitações e aprova/reprova um ou vários produtos. Toda decisão exige justificativa.
- Admin: acesso completo e possibilidade de reprovar uma aprovação realizada por Gerente de Vendas, também com justificativa e auditoria.
- Bucket privado: `avarias-vendas`.
- Tabelas principais: `sales_damage_requests` e `sales_damage_items`.

### Permissões

As tabelas `permissions`, `role_permissions` e `user_permissions` controlam os acessos. A tela **Administração > Usuários** permite editar as funcionalidades de cada usuário e restaurar o padrão do cargo.

A v1.4.0 também aplica as permissões no backend dos módulos existentes (NRI, Avarias de Entrega, Conferência, FEFO, Puxada, Marketplace, Bases e Usuários), evitando que uma função apenas escondida na tela continue acessível diretamente por API. O ajuste de TMA ganhou a permissão específica `PULL_TMA_ADJUST`.

Antes de publicar:

1. Execute `supabase/18_v1_4_0_permissoes_avarias_vendas.sql` no SQL Editor, depois do SQL 17.
2. Republique a Edge Function `admin-users`, pois ela passa a aceitar `VENDEDOR`, `GERENTE_VENDAS` e os overrides de permissões.
3. Atualize o site e force a recarga do navegador.

A versão Android preparada é `versionCode 140` / `versionName 1.4.0`.


### v1.4.0 - Paginação das bases de referência

A carga da base de clientes é paginada em lotes de 1.000 registros, com limite operacional de 5.000 clientes no cache. Avarias de Entrega e Avarias de Vendas também possuem busca direta de fallback no Supabase pelo Código PDV quando o código não estiver no cache. A base de produtos é carregada em páginas, preparada para até 25.000 registros.


### Regra de cadastro de lote
Os campos de lote do sistema aceitam somente letras e números (A-Z e 0-9). Caracteres especiais e espaços são removidos no preenchimento.


### Hotfix compatibilidade de clientes
- SQL 18 agora adiciona `customers.id` de forma idempotente para bases antigas antes de criar Avarias de Vendas.
- Cache de clientes foi versionado para descartar a carga antiga limitada/incompleta.
- Busca de PDV mantém modo compativel mesmo se a coluna `id` ainda nao existir, permitindo Avarias de Entrega localizar clientes.


### Seletor visual de produtos - Avarias de Entrega
O campo Produto avariado do motorista de entrega agora pesquisa a base de produtos por codigo ou descricao, mostra foto, codigo e nome, exige selecao de um produto cadastrado e reutiliza as imagens locais do catalogo.


## v1.4.1 - Seletor NRI/FEFO e múltiplos lotes

A v1.4.1 padroniza a escolha de produtos do Cadastro de NRI e da Contagem FEFO com o seletor visual usado em Avarias: busca por código/descrição, imagem e item selecionado. Também permite registrar vários lotes para o mesmo produto e validade. No FEFO, a coluna `lot` é adicionada por `supabase/19_v1_4_1_multiplos_lotes_fefo.sql`, refletindo na contagem, relatórios e CSV.

## v1.5.0 - Ativo de Giro e navegação por áreas

A v1.5.0 adiciona o módulo **Ativo de Giro**, com contagem cumulativa por ativo, múltiplas adições ao mesmo item, rastreabilidade de cada passagem e histórico consolidado dos totais. A barra lateral passa a organizar os módulos em **Armazém, Entrega, Vendas, Puxada e Configurações (Administração)**.

Antes de usar o módulo, execute `supabase/20_v1_5_0_ativo_giro_sidebar.sql`.


## v1.5.1 - Nova identidade visual

A v1.5.1 reúne tudo da v1.5.0 e aplica uma nova identidade visual corporativa ao Disb Gestão. A navegação continua organizada por áreas (Armazém, Entrega, Vendas, Puxada e Configurações), agora com sidebar grafite, cores de apoio por área, conteúdo claro, cards brancos, sombras discretas, tipografia mais limpa, botões sólidos, tabelas modernas e formulários padronizados.

O objetivo do redesign é melhorar leitura, hierarquia e uso diário em desktop e celular sem alterar regras de negócio. O módulo Ativo de Giro da v1.5.0 permanece incluído integralmente.
