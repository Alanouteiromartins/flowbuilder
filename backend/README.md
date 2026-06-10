# Amchat Flowbuilder Backend (Custom Express Server)

Este é um servidor backend personalizado desenvolvido com **Node.js** e **Express** para substituir as Firebase Cloud Functions. Ele lida com a recepção de webhooks do Chatwoot, executa o motor de fluxo (flowbuilder) e faz requisições proxy para o Chatwoot/Uazapi, mantendo a persistência de dados no Firestore.

## Por que migrar para este Backend?
- **Economia de Custos:** As Firebase Cloud Functions cobram por execução e tráfego de rede, o que pode se tornar caro com altos volumes de mensagens. Um backend próprio pode rodar em um servidor VPS ou em plataformas de hospedagem gratuitas/baratas (Render, Railway, etc.).
- **Simplicidade:** Todo o fluxo de tratamento de mensagens e interações é executado em um único servidor Express leve.
- **Portabilidade:** Funciona localmente ou em qualquer ambiente que suporte Node.js.

---

## Como Configurar as Credenciais do Firebase Firestore

Como os dados continuam no Firestore, o servidor backend precisa se conectar a ele usando credenciais com privilégios de administrador. Você tem duas opções para configurá-las:

### Opção A: Arquivo JSON de Chave Privada (Fácil para Desenvolvimento Local)
1. Vá para o [Console do Firebase](https://console.firebase.google.com/).
2. Abra o seu projeto.
3. Clique no ícone de engrenagem ao lado de "Visão geral do projeto" e selecione **Configurações do projeto**.
4. Acesse a aba **Contas de serviço**.
5. Clique em **Gerar nova chave privada** e confirme.
6. Um arquivo `.json` contendo as chaves será baixado.
7. Mova esse arquivo para a pasta `backend/` e renomeie-o para **`serviceAccountKey.json`**.
8. O servidor Express detectará e usará este arquivo automaticamente ao iniciar!

> [!WARNING]
> Nunca envie o arquivo `serviceAccountKey.json` para o controle de versão (Git). Ele já está incluído no `.gitignore`.

### Opção B: Variáveis de Ambiente (Recomendado para Produção / Cloud)
Se você for publicar o backend em plataformas como Render ou Railway, você pode configurar as credenciais diretamente nas variáveis de ambiente do painel de controle deles:
- `FIREBASE_PROJECT_ID`: O ID do seu projeto Firebase (ex: `flowbuilder-bb691`).
- `FIREBASE_CLIENT_EMAIL`: O e-mail da conta de serviço (ex: `flowbuilder-bb691@appspot.gserviceaccount.com`).
- `FIREBASE_PRIVATE_KEY`: A chave privada inteira gerada no JSON (incluindo as partes `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----` e substituindo quebras de linha por `\n`).

---

## Como Executar o Backend

### 1. Instalar as dependências
A partir do diretório raiz ou da pasta `backend`, execute:
```bash
# Na pasta backend
npm install

# Ou na raiz do projeto principal
npm install --prefix backend
```

### 2. Iniciar em modo de desenvolvimento (com recarregamento automático)
```bash
# Na pasta backend
npm run dev

# Ou na raiz do projeto principal (atalho configurado no package.json)
npm run backend
```

### 3. Iniciar em modo de produção
```bash
# Na pasta backend
npm start

# Ou na raiz do projeto principal
npm run backend:start
```

O servidor iniciará por padrão na porta **3000** e estará acessível em `http://localhost:3000`.

---

## Como Atualizar o Webhook no Chatwoot
1. Inicie o backend localmente ou publique-o na internet.
2. No painel do Amchat Flowbuilder (frontend), acesse os detalhes do projeto.
3. Se você estiver rodando em desenvolvimento local, a URL do Webhook exibida será:
   `http://localhost:3000/chatwootWebhook?projectId=SEU_PROJECT_ID`
4. Copie esta URL e atualize-a nas configurações de webhook da caixa de entrada do seu Chatwoot (substituindo a antiga URL das Cloud Functions do Firebase).
5. Certifique-se de selecionar o evento **Mensagem criada** (`message_created`).

---

## Estrutura do Código
- [package.json](file:///C:/Users/alan_/OneDrive/Área%20de%20Trabalho/Amchat%20flowbuilder/backend/package.json): Dependências (`express`, `cors`, `firebase-admin`, `dotenv`, `nodemon`).
- [src/index.js](file:///C:/Users/alan_/OneDrive/Área%20de%20Trabalho/Amchat%20flowbuilder/backend/src/index.js): Código principal do servidor contendo as rotas de webhook e os endpoints proxy para busca de agentes, equipes e marcadores.
- [.env](file:///C:/Users/alan_/OneDrive/Área%20de%20Trabalho/Amchat%20flowbuilder/backend/.env): Arquivo de configuração de ambiente.
