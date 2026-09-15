# Disb Gestão v1.0.12

## Alterações principais

### Menu lateral
- módulos NRI, Avarias, Conferência e Administração agora são recolhíveis;
- Histórico NRI passou para dentro do módulo NRI;
- Todas as avarias passou para Avarias;
- Histórico e Dashboard de conferência passaram para Conferência;
- Usuários e Bases / importação permanecem em Administração;
- o módulo da tela atual abre automaticamente e o estado dos módulos é lembrado no navegador.

### Registrar avaria
- resumo do cliente agora mostra PDV, Código, Cidade e Mapa nesta ordem;
- cada produto aceita de 1 a 5 fotos;
- cada foto registra seu próprio GPS;
- miniaturas podem ser removidas antes de adicionar o produto;
- o resumo dos produtos informa a quantidade de fotos e confirmação de GPS;
- o campo de produto e o código do cliente continuam sem sugestões automáticas.

### Visualização de avarias
- cabeçalho da ocorrência reorganizado;
- cards dos produtos mais compactos;
- evidências ficam recolhidas em “Ver evidências”;
- fotos e mapas aparecem somente ao expandir;
- assinatura do cliente também fica recolhida;
- contador de produtos pendentes e produtos selecionados;
- barra de aprovação permanece visível no rodapé do modal;
- avarias antigas de foto única continuam compatíveis.

### Dashboard de conferência
- conciliação continua sendo feita pelo número do mapa, independentemente da data da conferência;
- a data exibida e usada no filtro é a data da rota existente em `maps.map_date`;
- filtro permite “Todas as conferências” ou “Data específica”;
- mapa existente na base, mas ainda não conferido, não é incluído como divergência nem como linha do dashboard;
- conferência sem base MAPAS aparece como “Sem base MAPAS”, mas não gera valores de diferença;
- diferenças e impacto financeiro só são calculados quando existem base MAPAS e conferência;
- KPIs agora mostram Conferências analisadas, Sem diferença, Com diferença, Sem base MAPAS e impactos positivo/negativo;
- cidades longas são resumidas na tabela e a linha inteira pode ser clicada para detalhar.

### Android / GPS
- o script `scripts/prepare-android.mjs` foi reforçado para inserir e validar:
  - `ACCESS_COARSE_LOCATION`
  - `ACCESS_FINE_LOCATION`
- `npm run android:sync` falha com mensagem clara se não conseguir aplicar as permissões.

## Banco de dados obrigatório
Antes de publicar a aplicação v1.0.12, execute no Supabase SQL Editor:

`supabase/06_v1_0_12_avarias_multifotos.sql`

Esse script cria `damage_item_photos`, migra a foto histórica dos itens antigos e atualiza `create_damage_request` mantendo compatibilidade com versões anteriores.

## Ordem recomendada de atualização
1. Execute `supabase/06_v1_0_12_avarias_multifotos.sql` no Supabase.
2. Copie os arquivos do patch v1.0.12 sobre `C:\disbgestao-git`.
3. Faça `git add -A`, commit e push.
4. Execute `npm install`.
5. Execute `npm run android:sync`.
6. Confira as permissões no AndroidManifest.
7. Gere o APK.
