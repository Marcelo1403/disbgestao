# Disb Gestão v1.5.1 — Consolidação Avarias

Esta atualização deve ser aplicada sobre a v1.5.1 e **não altera o versionName**.

## Alterações incluídas

- Avarias de Vendas, Avarias de Rota/Entrega e Paletes Avariados: somente captura pela câmera na interface.
- Avarias de Vendas: GPS por foto.
- Motivo Validade: até duas fotos por produto; demais motivos: uma foto.
- Minhas solicitações: sem histórico de decisões; acompanhamento pelo status atual do produto.
- Fluxo: Pendente → aprovação do GV → Em análise → decisão final → Aprovada/Reprovada → Avaria lançada → Lançada.
- `SALES_DAMAGE_OVERRIDE` passa a representar a decisão final, preservando os usuários que já tinham a antiga permissão Reverter decisões.
- Nova permissão `SALES_DAMAGE_POST` para confirmar que uma avaria aprovada foi lançada no sistema.
- Seleção de todos os produtos disponíveis para decisão em lote.

## Ordem de atualização

1. Faça backup do banco e da versão atual.
2. Se o módulo Avarias de Vendas ainda não existir, execute primeiro `supabase/18_v1_4_0_permissoes_avarias_vendas.sql`.
3. Execute `supabase/21_v1_5_1_avarias_vendas_fluxo_final_camera_gps.sql` no SQL Editor do Supabase.
4. Substitua os arquivos web deste pacote sobre a v1.5.1.
5. Rode `npm install` caso esteja preparando o projeto em uma pasta nova.
6. Rode `npm run android:sync` para reconstruir os assets Android.
7. Gere/instale o APK e faça os testes do `CHECKLIST_TESTES.md`.
8. Em Administração > Usuários, conceda `Marcar avaria lançada` somente a quem deve confirmar o lançamento.

## Compatibilidade dos dados existentes

- Solicitações antigas permanecem disponíveis.
- Fotos antigas são migradas para a nova relação de fotos, sem GPS retroativo.
- Itens que já estavam APROVADO permanecem APROVADO; o novo estágio Em análise passa a valer para aprovações realizadas depois da atualização.
- `REPROVADO_ADMIN` histórico é normalizado para `REPROVADO`, preservando os dados da antiga reversão na auditoria final.
