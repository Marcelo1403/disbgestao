# Disb Gestao v1.1.5

## GPS da Puxada

- Remove o limite fixo de 30 m.
- A tolerancia passa a ser configuravel de 5 a 500 m.
- Valor inicial recomendado: 200 m.
- O app continua solicitando localizacao de alta precisao (`enableHighAccuracy`).
- Se o aparelho entregar uma leitura melhor que o limite configurado, a etapa e registrada imediatamente.
- Se a leitura estiver pior que o limite, o app continua aguardando durante a janela de captura e informa a precisao atual.
- O banco valida o mesmo limite configurado no painel.

### Recomendacao operacional

Como os aparelhos observados estao entregando normalmente entre 130 e 150 m, iniciar com 200 m evita bloqueios e ainda preserva uma margem de auditoria. Se os aparelhos passarem a entregar leituras melhores, o administrador pode reduzir para 150, 100 ou outro valor.

## Banco

Executar `supabase/11_v1_1_5_gps_tolerancia_flexivel.sql` depois da v1.1.4.
