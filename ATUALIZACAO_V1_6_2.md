# Disb Gestão v1.6.2

Atualização operacional sobre a v1.6.1.

## Correções

- **Ativo de Giro:** corrige o clique em “Adicionar à contagem”. O evento de seleção Pátio/Refugo estava interceptando o clique do botão porque a linha inteira também carregava o atributo de localização.
- **NRI / Placas:** o cadastro passa a tentar carregar as placas diretamente de `pull_vehicles` quando a lista local estiver vazia, sem depender do carregamento completo do módulo Puxada.
- **NRI / Lotes:** volta o fluxo de “+ Adicionar lote” para incluir vários lotes no mesmo preenchimento. Ao salvar, cada lote passa a virar uma linha distinta do rascunho/NRI. Quando houver vários lotes, a quantidade de `Paletes / NRIs` deve ser igual à quantidade de lotes, garantindo 1 NRI por lote e evitando concatenação.
- **Avarias de Entrega:** adiciona “Selecionar tudo” e melhora a apresentação dos botões “Marcar como lançada” e “Marcar como entregue”.

## Banco de dados

Esta atualização não cria novo SQL. O SQL 28, se ainda não foi executado, continua necessário apenas para corrigir os privilégios de `service_role` do cadastro de usuários.

## Versão

- Web: 1.6.2
- Android: versionCode 162 / versionName 1.6.2
