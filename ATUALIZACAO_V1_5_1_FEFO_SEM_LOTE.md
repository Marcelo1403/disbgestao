# Disb Gestão v1.5.1 — FEFO sem lote na contagem

Alteração restrita à tela **Contagem de FEFO**:

- removido o campo **Lote(s)** do formulário da contagem;
- removida a coluna **Lote(s)** da lista de itens da contagem em andamento;
- lote deixa de ser obrigatório ao salvar/editar um item FEFO;
- NRI, Avarias e demais módulos continuam com lote normalmente;
- a coluna `lot` é preservada no banco para manter o histórico de contagens antigas;
- relatórios/históricos antigos continuam capazes de exibir lotes já registrados.

Execute `supabase/22_v1_5_1_fefo_contagem_sem_lote.sql` no Supabase antes de testar o novo fluxo.
