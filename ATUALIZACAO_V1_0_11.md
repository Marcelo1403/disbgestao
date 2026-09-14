# Disb Gestão v1.0.11

## O que mudou

- **Colaborador Armazém** e **Conferente** passam a ter as duas funções: NRI e Conferência de Vasilhames.
- Na tela de usuários, **Colaborador Entrega** passa a aparecer como **Motorista**. O valor interno continua `COLABORADOR_ENTREGA` para manter compatibilidade com o banco.
- Cadastro de NRI: o código do produto não mostra mais sugestões. O produto/imagem só aparece quando o código completo existir.
- Cadastro de avaria: o PDV não mostra sugestões de clientes enquanto o motorista digita.
- Cadastro de NRI: novo campo **Tipo** com `Ambev` e `Marketplace`. Em Marketplace, Motorista da carreta, Placa e Fábrica ficam bloqueados com `--`.
- Validade de NRI: pode ser informada normalmente ou marcada como **Sem Validade**; neste caso o bloqueio fica `--`.
- APK: localização usa o plugin nativo do Capacitor e o `android:sync` passa a garantir as permissões `ACCESS_COARSE_LOCATION` e `ACCESS_FINE_LOCATION` no AndroidManifest.

## 1. Atualizar o Supabase

Antes de usar os novos campos, execute no **SQL Editor** todo o arquivo:

`supabase/05_nri_tipo_sem_validade_perfis_gps.sql`

Esse script também converte perfis `CONFERENTE` existentes para `COLABORADOR_ARMAZEM` e mantém compatibilidade com perfis antigos.

## 2. Atualizar GitHub

Copie os arquivos desta versão para a raiz do repositório e faça commit/push. Depois confirme que `VERSION.txt` mostra `v1.0.11`.

## 3. Atualizar o APK

Na raiz do projeto local:

```powershell
cd C:\disbgestao-main
npm install
npm run android:sync
```

O `android:sync` agora aplica automaticamente as permissões nativas de localização. Depois gere o APK:

```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

APK: `android\app\build\outputs\apk\debug\app-debug.apk`.

### Se o Android já registrou a permissão como negada

Depois de instalar a nova versão, abra **Configurações > Apps > Disb Gestão > Permissões > Localização** e selecione **Permitir durante o uso do app**. Em uma instalação limpa, o APK deve solicitar a permissão ao entrar em Registrar avaria.
