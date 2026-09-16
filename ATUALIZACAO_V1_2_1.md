# Disb Gestão v1.2.1

## Evidências de paletes avariados no NRI
- Impressões pendentes e Histórico NRI agora identificam NRIs com palete avariado.
- Botão **Ver avaria** abre quantidade de paletes recebidos, quantidade avariada, motivo, produto, lote e todas as fotos.
- As fotos continuam no bucket privado `nri-avarias` e são exibidas por URL assinada temporária.

## Histograma Marketplace
- Adicionado no mesmo painel dos histogramas da Puxada.
- Usa a duração entre início e fim do recebimento Marketplace.
- Histograma em faixas de 30 minutos, com total, média, mediana e maior tempo.
- Tabela analítica por fornecedor e unidade.
- Ano e Mês do painel filtram o Marketplace; filtros específicos de Puxada/Transferência não interferem.

## Assinatura do cliente
- O canvas passa a ser preenchido com fundo branco real, e não apenas branco visual.
- A exportação JPEG também força fundo branco.
- Novas assinaturas ficam legíveis na visualização. Registros antigos já gravados com fundo preto não podem recuperar traços que tenham sido perdidos no JPEG original.

## Banco de dados
Nenhum SQL novo. A v1.2.1 usa as tabelas e o bucket criados na v1.2.0.
