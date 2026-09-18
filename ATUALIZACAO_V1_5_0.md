# Disb Gestão v1.5.0

## Ativo de Giro

Novo módulo em **Armazém > Ativo de Giro** com duas telas:

- **Nova contagem**: o conferente inicia uma contagem por unidade e data, visualiza os ativos fixos e pode registrar quantidades em `PALET/GFA`, `LASTRO/GFA`, `CAIXA/GFA`, `AVULSO` e `UNIDADES`.
- **Histórico / Totais**: lista contagens finalizadas e consolida a soma de todas as adições por ativo.

Cada clique em **Adicionar à contagem** cria um lançamento independente. Isso permite, por exemplo, registrar 20 caixas de CERVEJA 600ML e depois voltar ao mesmo item e registrar mais 50. O total exibido passa a ser 70 caixas, preservando as duas adições para rastreabilidade.

A lista inicial de ativos foi carregada conforme o formulário fornecido, incluindo CERVEJA 600ML, GFA VERDE 600ML, CERVEJA 300ML, embalagens de 1L/290ML, CHAPATEX, PBR1, PBR2 e barris 30L/50L.

## Barra lateral por áreas

A navegação agora possui dois níveis:

- **Armazém**
  - NRI
  - Conferência
  - Contagem FEFO
  - Ativo de Giro
- **Entrega**
  - Avarias de Entrega
- **Vendas**
  - Avarias de Vendas
- **Puxada**
  - Operação de Puxada
- **Configurações (Administração)**
  - Puxada: Metas e Configurações
  - Administração: Usuários e Bases / importação

A área e o módulo da tela atual são abertos automaticamente e a última navegação permanece salva no navegador.

## Banco de dados

Execute, após o SQL 19 da v1.4.1:

`supabase/20_v1_5_0_ativo_giro_sidebar.sql`

O SQL cria permissões, cadastro de ativos, contagens, lançamentos cumulativos, RPCs e políticas RLS.

## Android

A preparação Android passa a usar:

- `versionCode 150`
- `versionName 1.5.0`
