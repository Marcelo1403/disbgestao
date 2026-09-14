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
- TURNOS
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
- `shifts`
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
