# Disb Gestão v1.1.7

## Correção da tolerância GPS em tempo de execução

A configuração `gps_max_accuracy_m` passa a ser consultada novamente no Supabase imediatamente antes de cada ação que captura GPS na Puxada.

Isso evita que uma sessão aberta anteriormente continue usando um valor antigo, como 30 m, depois de o administrador alterar a tolerância para 200 m.

A tela de captura também mostra explicitamente o limite que acabou de ser carregado do servidor.

A correção vale para início de viagem, próxima etapa, início/fim de ocorrência e captura de GPS da fábrica.

Não há SQL novo nesta versão.
