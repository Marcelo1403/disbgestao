# Disb Gestão v1.1.1 — ajuste do módulo Puxada

## O que mudou

- A **origem da viagem** não fica mais nas Configurações. O motorista escolhe a origem antes de iniciar cada viagem.
- O início da viagem agora exige: **Origem, Placa, Fábrica, Parceiro/Transportadora e Motorista 2**.
- O parceiro é selecionado a partir das transportadoras cadastradas nos veículos; ao informar uma placa conhecida, o parceiro correspondente é pré-selecionado.
- Na **Chegada à fábrica**, o raio passou a ser **somente uma evidência de auditoria**. Estar fora do raio não impede o registro.
- O evento continua gravando latitude, longitude, precisão do GPS, distância até a fábrica, raio cadastrado e status Dentro/Fora do raio.
- A precisão GPS passou a usar até 4 leituras em modo de alta precisão e mantém a melhor leitura obtida. Não existe fallback intencional para baixa precisão.
- A precisão acima do parâmetro configurado é registrada para auditoria, sem bloquear o apontamento.

## Atualização de uma instalação v1.1.0

1. No Supabase, execute `supabase/09_v1_1_1_origem_gps_auditoria.sql`.
2. Publique os arquivos web desta pasta (principalmente `index.html`, `app.js` e `sw.js`).
3. Se usar APK/Capacitor, execute `npm install` (se necessário), depois `npm run android:sync` e gere novamente o APK.
4. Confirme no cadastro de veículos que cada placa possui **Transportadora/Parceiro** preenchido.
5. Teste uma viagem: origem > placa > fábrica > parceiro > Motorista 2 > iniciar.
6. Na chegada à fábrica, faça também um teste deliberadamente fora do raio: o evento deve ser registrado e aparecer como **Fora do raio de auditoria**, sem bloqueio.

## Instalação nova

O `supabase/schema.sql` e o `supabase/08_v1_1_0_modulo_puxada.sql` deste pacote já estão consolidados com as novas regras.
