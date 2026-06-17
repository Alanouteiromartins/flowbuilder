import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Setup Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let serviceAccount = null;
let db;
let projectIdForDashboard = 'Não configurado';

// Try initializing with environment variables first (if valid and not placeholder)
try {
  const hasEnvCreds = process.env.FIREBASE_PROJECT_ID && 
                     process.env.FIREBASE_CLIENT_EMAIL && 
                     process.env.FIREBASE_PRIVATE_KEY;
                     
  const isPlaceholder = process.env.FIREBASE_PRIVATE_KEY && 
                        process.env.FIREBASE_PRIVATE_KEY.includes('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ');

  if (hasEnvCreds && !isPlaceholder) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin inicializado via variáveis de ambiente.');
    db = admin.firestore();
    projectIdForDashboard = process.env.FIREBASE_PROJECT_ID;
  } else {
    throw new Error('Sem credenciais válidas nas variáveis de ambiente ou utilizando chave placeholder.');
  }
} catch (envErr) {
  // Option 2: Load serviceAccountKey.json
  const possiblePaths = [
    path.resolve('./serviceAccountKey.json'),
    path.resolve('../serviceAccountKey.json'),
    path.resolve('./backend/serviceAccountKey.json')
  ];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    possiblePaths.push(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
  }
  
  let initialized = false;
  for (const filePath of possiblePaths) {
    if (filePath && fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log(`Firebase Admin inicializado com a chave: ${filePath}`);
        db = admin.firestore();
        projectIdForDashboard = serviceAccount.project_id || 'Configurado';
        initialized = true;
        break;
      } catch (err) {
        console.error(`Erro ao carregar arquivo de chave em ${filePath}:`, err.message);
      }
    }
  }
  
  if (!initialized) {
    // Option 3: Fallback (ADC)
    try {
      admin.initializeApp();
      console.log('Firebase Admin inicializado via Application Default Credentials (ADC).');
      db = admin.firestore();
      projectIdForDashboard = 'Default Project';
    } catch (err) {
      console.warn('\n⚠️  ATENÇÃO: Não foi possível inicializar o Firebase Admin SDK automaticamente.');
      console.warn('Para que o backend funcione, siga uma das opções:');
      console.warn('1. Coloque o arquivo JSON de credenciais da sua conta de serviço em: backend/serviceAccountKey.json');
      console.warn('2. Ou configure as variáveis de ambiente corretas no arquivo "backend/.env".\n');
      projectIdForDashboard = 'Não configurado (Aguardando credenciais)';
    }
  }
}

// Global server start timestamp for dashboard
const serverStartTime = new Date();

// Simple Dashboard HTML for GET /
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - serverStartTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Amchat Flowbuilder Backend</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-gradient: linear-gradient(135deg, #0b0f19 0%, #111827 100%);
          --card-bg: rgba(31, 41, 55, 0.6);
          --card-border: rgba(255, 255, 255, 0.08);
          --primary: #0ea5e9;
          --primary-glow: rgba(14, 165, 233, 0.15);
          --success: #10b981;
          --success-glow: rgba(16, 185, 129, 0.15);
          --text-main: #f3f4f6;
          --text-muted: #9ca3af;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: var(--bg-gradient);
          color: var(--text-main);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-x: hidden;
        }

        .container {
          width: 100%;
          max-width: 650px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          backdrop-filter: blur(16px);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          position: relative;
        }

        .container::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(135deg, var(--primary) 0%, transparent 40%, transparent 60%, var(--success) 100%);
          border-radius: 26px;
          z-index: -1;
          opacity: 0.15;
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 20px;
        }

        .logo-section h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(90deg, #0ea5e9, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .logo-section p {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--success-glow);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--success);
          font-size: 13px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 100px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: var(--success);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--success);
          animation: pulse 1.8s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
          transition: transform 0.3s, border-color 0.3s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          border-color: rgba(14, 165, 233, 0.2);
        }

        .metric-card span {
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .metric-card strong {
          font-family: 'Outfit', sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-main);
        }

        .endpoints-list {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .endpoints-list h3 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 15px;
          color: var(--text-main);
        }

        .endpoint-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .endpoint-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .endpoint-item:first-child {
          padding-top: 0;
        }

        .method {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          color: #fff;
          width: 55px;
          text-align: center;
        }

        .method.post { background-color: var(--primary); }
        .method.get { background-color: var(--success); }

        .path {
          font-family: monospace;
          font-size: 13px;
          color: var(--text-main);
          margin-left: 12px;
          flex-grow: 1;
        }

        .desc {
          font-size: 12px;
          color: var(--text-muted);
        }

        footer {
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 30px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo-section">
            <h1>Amchat Flowbuilder</h1>
            <p>Servidor de Integrações & Webhooks</p>
          </div>
          <div class="status-badge">
            <div class="status-dot"></div>
            Online
          </div>
        </header>

        <div class="grid">
          <div class="metric-card">
            <span>Projeto Firestore</span>
            <strong>${projectIdForDashboard}</strong>
          </div>
          <div class="metric-card">
            <span>Uptime do Servidor</span>
            <strong>${uptimeStr}</strong>
          </div>
        </div>

        <div class="endpoints-list">
          <h3>Rotas do Servidor</h3>
          <div class="endpoint-item">
            <span class="method post">POST</span>
            <span class="path">/chatwootWebhook</span>
            <span class="desc">Webhook Principal</span>
          </div>
          <div class="endpoint-item">
            <span class="method get">GET</span>
            <span class="path">/getChatwootAgents</span>
            <span class="desc">Lista Agentes</span>
          </div>
          <div class="endpoint-item">
            <span class="method get">GET</span>
            <span class="path">/getChatwootTeams</span>
            <span class="desc">Lista Equipes</span>
          </div>
          <div class="endpoint-item">
            <span class="method get">GET</span>
            <span class="path">/getChatwootLabels</span>
            <span class="desc">Lista Etiquetas</span>
          </div>
        </div>

        <footer>
          Amchat Flowbuilder &copy; 2026 - Rodando localmente na porta ${port}
        </footer>
      </div>
    </body>
    </html>
  `);
});

// 1. Webhook Chatwoot
app.post('/chatwootWebhook', async (req, res) => {
  const { event, message_type } = req.body;
  const projectId = req.query.projectId;

  console.log(`[Webhook] Evento: ${event}, Tipo: ${message_type}, Projeto: ${projectId}`);

  if (!projectId) {
    return res.status(400).send('Missing projectId in query parameters');
  }

  if (event !== 'message_created' && event !== 'conversation_updated') {
    return res.status(200).send('Event ignored');
  }

  // No evento conversation_updated, o corpo do webhook é o próprio objeto da conversa
  const conversation = event === 'conversation_updated' ? req.body : req.body.conversation;

  if (!conversation || !conversation.id) {
    return res.status(400).send('Missing conversation information');
  }

  const conversationId = conversation.id;

  // Limite configurável (via variável de ambiente ou fixo) para ignorar conversas antigas
  const minConversationId = process.env.CHATWOOT_MIN_CONVERSATION_ID ? parseInt(process.env.CHATWOOT_MIN_CONVERSATION_ID, 10) : 952;
  if (conversationId <= minConversationId) {
    console.log(`[Webhook] Conversa ${conversationId} ignorada por ser menor ou igual ao ID limite (${minConversationId}).`);
    return res.status(200).send('Ignored old conversation based on ID limit.');
  }

  try {
    if (!db) {
      throw new Error('Database (Firestore) not initialized. Check server credentials.');
    }

    // 3. Load Project credentials (chatwootConfig) from Firestore
    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      console.error(`[Webhook] Projeto ${projectId} não encontrado no Firestore.`);
      return res.status(404).send('Project not found');
    }

    const projectData = projectSnap.data();
    const chatwootConfig = projectData?.chatwootConfig;

    if (!chatwootConfig || !chatwootConfig.url || !chatwootConfig.token || !chatwootConfig.accountId) {
      console.error(`[Webhook] Configurações de integração com o Chatwoot incompletas para o projeto ${projectId}.`);
      return res.status(400).send('Chatwoot integration not configured');
    }

    // 4. Load Active Flow with 'chatwoot' integration
    const flowsColl = db.collection(`projects/${projectId}/flows`);
    const flowsQuery = await flowsColl
      .where('integrationKey', '==', 'chatwoot')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (flowsQuery.empty) {
      console.log(`[Webhook] Nenhum fluxo ativo com integração Chatwoot encontrado para o projeto ${projectId}.`);
      return res.status(200).send('No active flow for Chatwoot');
    }

    const activeFlow = flowsQuery.docs[0].data();

    // 4.5. Check session details in Firestore
    const sessionRef = db.doc(`projects/${projectId}/sessions/${conversationId}`);
    const sessionSnap = await sessionRef.get();
    
    // Handle conversation_updated
    if (event === 'conversation_updated') {
      if (sessionSnap.exists) {
        const currentStatus = sessionSnap.data().status;
        if (currentStatus === 'active' && activeFlow.useBotLabel) {
          const currentLabels = conversation.labels || [];
          if (!currentLabels.includes('bot')) {
            await sessionRef.update({
              status: 'disabled',
              disabledReason: 'label_removed_manually',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Webhook] Etiqueta 'bot' removida manualmente na conversa ${conversationId}. Bot desativado.`);
          }
        }
      }
      return res.status(200).send('Conversation updated processed');
    }

    const messageType = req.body.message_type || '';
    const incomingMessage = req.body.content || '';

    let sessionData = sessionSnap.exists ? sessionSnap.data() : null;
    let sessionStatus = sessionData?.status || 'active';

    if (!sessionSnap.exists) {
      // Very first message of this conversation (from the perspective of the bot)!
      if (messageType === 'outgoing') {
        // Agent initiated conversation: disable bot forever for this conversation
        await sessionRef.set({
          status: 'disabled',
          disabledReason: 'initiated_by_agent',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Webhook] Conversa ${conversationId} iniciada por um agente. Bot desativado.`);
        return res.status(200).send('Conversation initiated by agent. Bot disabled.');
      } else {
        // Customer initiated conversation: activate session
        await sessionRef.set({
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Webhook] Conversa ${conversationId} iniciada pelo cliente. Bot ativo.`);
        sessionStatus = 'active';

        if (activeFlow.useBotLabel) {
          try {
            await addChatwootLabel(chatwootConfig, conversationId, 'bot');
          } catch (err) {
            console.error(`[Webhook] Erro ao adicionar etiqueta bot inicial: ${err.message}`);
          }
        }
      }
    } else {
      // Session already exists: verify current status
      if (sessionStatus === 'disabled' || sessionStatus === 'finished') {
        console.log(`[Webhook] Conversa ${conversationId} possui status "${sessionStatus}". Ignorando evento do bot.`);
        return res.status(200).send(`Bot is ${sessionStatus} for this conversation.`);
      }

      if (messageType === 'outgoing') {
        // Agent sent a message: check if it's the bot or a human agent
        const lastBotSentMessage = sessionData?.lastBotSentMessage || '';
        const lastBotSentAt = sessionData?.lastBotSentAt || 0;
        const timeDiff = Math.abs(Date.now() - lastBotSentAt);

        // Treat as bot message if content matches exactly or was sent very recently (within 5 seconds)
        const isSentByBot = (incomingMessage.trim() === lastBotSentMessage.trim()) || (timeDiff < 5000);

        if (isSentByBot) {
          console.log(`[Webhook] Mensagem de saída na conversa ${conversationId} enviada pelo próprio bot. Ignorando loop.`);
          return res.status(200).send('Bot message ignored.');
        } else {
          // Agent intervened: disable bot for this conversation
          await sessionRef.update({
            status: 'disabled',
            disabledReason: 'agent_intervention',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[Webhook] Agente interveio na conversa ${conversationId}. Bot desativado.`);

          if (activeFlow.useBotLabel) {
            try {
              await removeChatwootLabel(chatwootConfig, conversationId, 'bot');
            } catch (err) {
              console.error(`[Webhook] Erro ao remover etiqueta bot na intervenção: ${err.message}`);
            }
          }
          return res.status(200).send('Agent intervened. Bot disabled.');
        }
      }
    }

    const nodes = activeFlow.nodes || [];

    // 6. Find start node
    const startNode = nodes.find(n => n.type === 'start' || n.id === 'node-start');
    if (!startNode) {
      console.warn(`[Webhook] Nenhum nó de 'Início' encontrado no fluxo ativo.`);
      return res.status(200).send('Start node not found');
    }

    // 6.5. Load Project Global Variables
    const variablesColl = db.collection(`projects/${projectId}/variables`);
    const variablesSnap = await variablesColl.get();
    const globalVars = {};
    variablesSnap.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        globalVars[data.name] = data.defaultValue || '';
      }
    });

    // Merge global variables with dynamic context variables from sender or conversation
    const sender = req.body.sender || {};
    const contactName = sender.name || conversation.contact?.name || '';
    const contactEmail = sender.email || conversation.contact?.email || '';
    const contactPhone = sender.phone_number || sender.phone || conversation.contact?.phone_number || conversation.contact?.phone || '';

    const conversationDisplayId = conversation.display_id || '';
    const conversationStatus = conversation.status || '';
    const conversationInboxId = conversation.inbox_id || req.body.inbox_id || '';
    const contactId = sender.id || conversation.contact?.id || '';

    // Load session variables first if session exists
    const sessionVars = sessionData?.variables || {};

    const contextVars = {
      ...globalVars,
      ...sessionVars,
      'mensagem': incomingMessage,
      'nome_cliente': contactName,
      'email_cliente': contactEmail,
      'telefone_cliente': contactPhone,
      'id_conversa': conversationId.toString(),
      'codigo_atendimento': conversationDisplayId.toString(),
      'status_conversa': conversationStatus.toString(),
      'id_caixa_entrada': conversationInboxId.toString(),
      'id_cliente': contactId.toString(),
      'tipo_mensagem': messageType.toString()
    };

    // Helper to resolve variables in text
    const resolveVars = (text) => {
      if (!text) return '';
      let result = text;
      Object.keys(contextVars).forEach(key => {
        const placeholder = `{${key}}`;
        result = result.replaceAll(placeholder, contextVars[key] || '');
      });
      return result;
    };

    // 7. Session resumption state machine using already loaded session
    let currentNodeId = undefined;
    const activeNodeId = sessionData?.activeNodeId;

    if (sessionSnap.exists && activeNodeId) {
      console.log(`[Webhook] Conversa ${conversationId} possui sessão ativa. Retomando do nó: ${activeNodeId}`);

      // We clear the activeNodeId to resolve the wait, preserving variables
      await sessionRef.update({
        activeNodeId: admin.firestore.FieldValue.delete()
      });

      if (activeNodeId) {
        const waitNode = nodes.find(n => n.id === activeNodeId);
        if (waitNode && waitNode.type === 'question') {
          if (waitNode.saveVariableName) {
            const cleanVarName = waitNode.saveVariableName.replace(/[{}]/g, '').trim();
            sessionVars[cleanVarName] = incomingMessage.trim();
            contextVars[cleanVarName] = incomingMessage.trim();
            console.log(`[Webhook] Variável "${cleanVarName}" salva: "${incomingMessage.trim()}"`);
          }
          currentNodeId = waitNode.nextNodeId;
          console.log(`[Webhook] Resposta recebida. Direcionando para: ${currentNodeId}`);
        } else if (waitNode && (waitNode.type === 'uazapi_buttons' || waitNode.type === 'uazapi_list')) {
          const msgLower = incomingMessage.trim().toLowerCase();
          
          let extractedLabel = '';
          let extractedValue = '';
          const uazapiMatch = incomingMessage.match(/(?:🔘✅\s*✅|✅)?\s*(.+?)\s*\(id\s+(.+?)\)/i);
          if (uazapiMatch) {
            extractedLabel = uazapiMatch[1].trim().toLowerCase();
            extractedValue = uazapiMatch[2].trim().toLowerCase();
            console.log(`[Webhook] Botão Uazapi identificado. Label: "${extractedLabel}", Value: "${extractedValue}"`);
          }

          const b1Label = resolveVars(waitNode.button1Label || '').trim().toLowerCase();
          const b1Val = resolveVars(waitNode.button1Value || '').trim().toLowerCase();
          const b2Label = resolveVars(waitNode.button2Label || '').trim().toLowerCase();
          const b2Val = resolveVars(waitNode.button2Value || '').trim().toLowerCase();
          const b3Label = resolveVars(waitNode.button3Label || '').trim().toLowerCase();
          const b3Val = resolveVars(waitNode.button3Value || '').trim().toLowerCase();
          
          const b4Label = resolveVars(waitNode.button4Label || '').trim().toLowerCase();
          const b4Val = resolveVars(waitNode.button4Value || '').trim().toLowerCase();
          const b5Label = resolveVars(waitNode.button5Label || '').trim().toLowerCase();
          const b5Val = resolveVars(waitNode.button5Value || '').trim().toLowerCase();
          const b6Label = resolveVars(waitNode.button6Label || '').trim().toLowerCase();
          const b6Val = resolveVars(waitNode.button6Value || '').trim().toLowerCase();

          console.log(`[Debug Uazapi] Comparando msgLower: "${msgLower}"`);
          console.log(`[Debug Uazapi] Botão 1: Label="${b1Label}", Val="${b1Val}", Next="${waitNode.button1NodeId}"`);
          console.log(`[Debug Uazapi] Botão 2: Label="${b2Label}", Val="${b2Val}", Next="${waitNode.button2NodeId}"`);
          console.log(`[Debug Uazapi] Botão 3: Label="${b3Label}", Val="${b3Val}", Next="${waitNode.button3NodeId}"`);

          const isMatch = (btnLabel, btnVal) => {
            if (!btnLabel) return false;
            const match = msgLower === btnLabel || 
                   msgLower === btnVal || 
                   (extractedLabel && extractedLabel === btnLabel) || 
                   (extractedValue && extractedValue === btnVal);
            console.log(`[Debug Uazapi isMatch] btnLabel="${btnLabel}", btnVal="${btnVal}" -> Match: ${match}`);
            return match;
          };

          if (waitNode.button1Label && isMatch(b1Label, b1Val)) {
            currentNodeId = waitNode.button1NodeId;
          } else if (waitNode.button2Label && isMatch(b2Label, b2Val)) {
            currentNodeId = waitNode.button2NodeId;
          } else if (waitNode.button3Label && isMatch(b3Label, b3Val)) {
            currentNodeId = waitNode.button3NodeId;
          } else if (waitNode.button4Label && isMatch(b4Label, b4Val)) {
            currentNodeId = waitNode.button4NodeId;
          } else if (waitNode.button5Label && isMatch(b5Label, b5Val)) {
            currentNodeId = waitNode.button5NodeId;
          } else if (waitNode.button6Label && isMatch(b6Label, b6Val)) {
            currentNodeId = waitNode.button6NodeId;
          } else {
            currentNodeId = waitNode.fallbackNodeId;
            console.log(`[Webhook] Resposta não bateu com botões. Direcionando para fallback.`);
          }

          console.log(`[Debug Uazapi Match Result] currentNodeId definido para: ${currentNodeId}`);
        }
      }
    }

    if (currentNodeId === undefined) {
      currentNodeId = startNode.nextNodeId;
      console.log(`[Webhook] Novo fluxo iniciado. Próximo nó: ${currentNodeId}`);
    }

    let limit = 0;

    while (currentNodeId && limit < 30) {
      limit++;
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) {
        console.warn(`[Webhook] Nó com ID ${currentNodeId} não encontrado.`);
        break;
      }

      console.log(`[Webhook] Executando nó: ${node.name} (${node.type})`);

      if (node.type === 'message') {
        const messageText = node.messageText || '';
        if (messageText.trim()) {
          const resolvedMessage = resolveVars(messageText);
          await sendChatwootMessage(db, projectId, conversationId, chatwootConfig, resolvedMessage);
        }
      } else if (node.type === 'question') {
        const questionText = node.questionText || '';
        if (questionText.trim()) {
          const resolvedQuestion = resolveVars(questionText);
          await sendChatwootMessage(db, projectId, conversationId, chatwootConfig, resolvedQuestion);
        }

        await sessionRef.set({
          activeNodeId: node.id,
          variables: sessionVars,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[Webhook] Pergunta enviada. Pausando fluxo aguardando resposta.`);
        break;
      } else if (node.type === 'chatwoot_label') {
        try {
          const action = node.chatwootLabelAction || 'add';
          const labelName = resolveVars(node.chatwootLabelName || '').trim();
          
          if (action === 'clear') {
            await updateChatwootLabels(chatwootConfig, conversationId, []);
          } else if (labelName) {
            if (action === 'remove') {
              await removeChatwootLabel(chatwootConfig, conversationId, labelName);
            } else {
              await addChatwootLabel(chatwootConfig, conversationId, labelName);
            }
          }
        } catch (err) {
          console.error(`[Webhook] Erro no nó de etiqueta Chatwoot (${node.name}):`, err.message);
        }
      } else if (node.type === 'chatwoot_agent') {
        try {
          const action = node.chatwootAgentAction || 'assign';
          const agentId = node.chatwootAgentId ? Number(node.chatwootAgentId) : null;

          if (action === 'unassign') {
            await assignChatwootConversation(chatwootConfig, conversationId, null, undefined);
          } else if (agentId) {
            await assignChatwootConversation(chatwootConfig, conversationId, agentId, undefined);
          }
        } catch (err) {
          console.error(`[Webhook] Erro no nó de agente Chatwoot (${node.name}):`, err.message);
        }
      } else if (node.type === 'chatwoot_team') {
        try {
          const action = node.chatwootTeamAction || 'assign';
          const teamId = node.chatwootTeamId ? Number(node.chatwootTeamId) : null;

          if (action === 'unassign') {
            await assignChatwootConversation(chatwootConfig, conversationId, undefined, null);
          } else if (teamId) {
            await assignChatwootConversation(chatwootConfig, conversationId, undefined, teamId);
          }
        } catch (err) {
          console.error(`[Webhook] Erro no nó de equipe Chatwoot (${node.name}):`, err.message);
        }
      } else if (node.type === 'chatwoot_status') {
        try {
          const status = node.chatwootStatusAction || 'open';
          await updateChatwootConversationStatus(chatwootConfig, conversationId, status);
        } catch (err) {
          console.error(`[Webhook] Erro no nó de status Chatwoot (${node.name}):`, err.message);
        }
      } else if (node.type === 'http_request') {
        try {
          const resolvedNode = {
            ...node,
            httpUrl: resolveVars(node.httpUrl || ''),
            httpBody: resolveVars(node.httpBody || ''),
            httpHeaders: node.httpHeaders?.map(h => ({
              key: resolveVars(h.key),
              value: resolveVars(h.value)
            }))
          };
          await executeHttpRequest(resolvedNode);
        } catch (err) {
          console.error(`[Webhook] Erro no nó de requisição HTTP (${node.name}):`, err.message);
        }
      } else if (node.type === 'conditional') {
        const varInput = node.conditionVariable || '';
        const cleanVarName = varInput.replace(/[{}]/g, '').trim();

        const actualValueRaw = contextVars[cleanVarName] !== undefined
          ? contextVars[cleanVarName]
          : resolveVars(varInput);

        const actualValue = actualValueRaw !== null && actualValueRaw !== undefined
          ? actualValueRaw.toString()
          : '';

        const op = node.conditionOperator || 'equals';
        const expectedValue = resolveVars(node.conditionValue || '');

        let isTrue = false;

        switch (op) {
          case 'equals':
            isTrue = actualValue.toLowerCase() === expectedValue.toLowerCase();
            break;
          case 'not_equals':
            isTrue = actualValue.toLowerCase() !== expectedValue.toLowerCase();
            break;
          case 'contains':
            isTrue = actualValue.toLowerCase().includes(expectedValue.toLowerCase());
            break;
          case 'greater_than':
            isTrue = Number(actualValue) > Number(expectedValue);
            break;
          case 'less_than':
            isTrue = Number(actualValue) < Number(expectedValue);
            break;
          case 'exists':
            isTrue = actualValue !== '';
            break;
          case 'not_exists':
            isTrue = actualValue === '';
            break;
        }

        console.log(`[Webhook Condicional] "${actualValue}" ${op} "${expectedValue}"? ${isTrue}`);
        currentNodeId = isTrue ? node.trueNodeId : node.falseNodeId;
        continue;
      } else if (node.type === 'time_check') {
        const timezone = node.timeTimezone || 'America/Sao_Paulo';
        const startHour = node.timeStartHour ?? 9;
        const startMinute = node.timeStartMinute ?? 0;
        const endHour = node.timeEndHour ?? 18;
        const endMinute = node.timeEndMinute ?? 0;
        const weekdays = node.timeWeekdays || ['1', '2', '3', '4', '5'];

        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          weekday: 'short'
        }).formatToParts(now);

        let currentHour = 0;
        let currentMinute = 0;
        let currentWeekday = '';

        for (const part of parts) {
          if (part.type === 'hour') currentHour = parseInt(part.value, 10);
          if (part.type === 'minute') currentMinute = parseInt(part.value, 10);
          if (part.type === 'weekday') currentWeekday = part.value;
        }

        const dayMap = {
          'Mon': '1', 'Tue': '2', 'Wed': '3', 'Thu': '4', 'Fri': '5', 'Sat': '6', 'Sun': '7'
        };
        const weekdayIndex = dayMap[currentWeekday] || '1';

        const isCorrectDay = weekdays.includes(weekdayIndex);
        let isWithinTime = false;
        const currentMinutes = currentHour * 60 + currentMinute;
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (startMinutes <= endMinutes) {
          isWithinTime = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          isWithinTime = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }

        const isTrue = isCorrectDay && isWithinTime;
        currentNodeId = isTrue ? node.trueNodeId : node.falseNodeId;
        continue;
      } else if (node.type === 'delay') {
        const time = Number(node.delayTime) || 0;
        const unit = node.delayUnit || 'seconds';
        let ms = time;
        if (unit === 'minutes') ms *= 60;
        ms *= 1000;
        
        if (ms > 0) {
          console.log(`[Webhook] Aguardando ${time} ${unit} (${ms}ms) antes do próximo nó.`);
          await new Promise(resolve => setTimeout(resolve, ms));
        }
        
        currentNodeId = node.nextNodeId;
        continue;
      } else if (node.type === 'finish') {
        await sessionRef.update({
          status: 'finished',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Webhook] Conversa ${conversationId} finalizada pelo bloco.`);
        break;
      } else if (node.type === 'uazapi_send_text') {
        const uazapiConfig = projectData?.uazapiConfig;
        if (!uazapiConfig || !uazapiConfig.url || !uazapiConfig.token) {
          console.error(`[Webhook] Configurações Uazapi incompletas para o projeto ${projectId}.`);
          currentNodeId = node.nextNodeId;
          continue;
        }

        try {
          const numberClean = contactPhone.replace(/\D/g, '');
          const messageText = node.messageText || '';
          if (messageText.trim()) {
            const resolvedMessage = resolveVars(messageText);
            const payload = {
              number: numberClean,
              text: resolvedMessage
            };

            let cleanBaseUrl = uazapiConfig.url.trim();
            if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
              cleanBaseUrl = 'https://' + cleanBaseUrl;
            }
            if (cleanBaseUrl.endsWith('/')) {
              cleanBaseUrl = cleanBaseUrl.slice(0, -1);
            }
            const endpoint = `${cleanBaseUrl}/send/text`;

            console.log(`[Webhook] Enviando mensagem Uazapi para ${numberClean}. URL: ${endpoint}`);
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'token': uazapiConfig.token
              },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Uazapi API Error (Status ${response.status}): ${errorText}`);
            }

            console.log('[Webhook] Mensagem Uazapi enviada com sucesso!');

            await sessionRef.set({
              lastBotSentMessage: resolvedMessage.trim(),
              lastBotSentAt: Date.now(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.error(`[Webhook] Erro ao disparar mensagem Uazapi (${node.name}):`, err.message);
        }
      } else if (node.type === 'uazapi_buttons' || node.type === 'uazapi_list') {
        const uazapiConfig = projectData?.uazapiConfig;
        if (!uazapiConfig || !uazapiConfig.url || !uazapiConfig.token) {
          console.error(`[Webhook] Configurações Uazapi incompletas para o projeto ${projectId}.`);
          currentNodeId = node.fallbackNodeId;
          continue;
        }

        try {
          const numberClean = contactPhone.replace(/\D/g, '');
          const resolvedMenuText = resolveVars(node.menuText || 'Escolha uma opção:');
          const resolvedFooter = resolveVars(node.menuFooterText || '');
          const resolvedButtonText = resolveVars(node.menuButtonText || 'Selecionar');

          const choices = [];
          if (node.button1Label) {
            choices.push(`${resolveVars(node.button1Label)}|${resolveVars(node.button1Value || 'opcao_1')}`);
          }
          if (node.button2Label) {
            choices.push(`${resolveVars(node.button2Label)}|${resolveVars(node.button2Value || 'opcao_2')}`);
          }
          if (node.button3Label) {
            choices.push(`${resolveVars(node.button3Label)}|${resolveVars(node.button3Value || 'opcao_3')}`);
          }

          if (node.type === 'uazapi_list') {
            if (node.button4Label) {
              choices.push(`${resolveVars(node.button4Label)}|${resolveVars(node.button4Value || 'opcao_4')}`);
            }
            if (node.button5Label) {
              choices.push(`${resolveVars(node.button5Label)}|${resolveVars(node.button5Value || 'opcao_5')}`);
            }
            if (node.button6Label) {
              choices.push(`${resolveVars(node.button6Label)}|${resolveVars(node.button6Value || 'opcao_6')}`);
            }
          }

          const payload = {
            number: numberClean,
            type: node.type === 'uazapi_buttons' ? 'button' : 'list',
            text: resolvedMenuText,
            footerText: resolvedFooter,
            selectableCount: 1,
            choices,
            delay: node.type === 'uazapi_buttons' ? 1800 : 1200
          };

          if (node.type === 'uazapi_list') {
            payload.listButton = resolvedButtonText;
          }

          let cleanBaseUrl = uazapiConfig.url.trim();
          if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
            cleanBaseUrl = 'https://' + cleanBaseUrl;
          }
          if (cleanBaseUrl.endsWith('/')) {
            cleanBaseUrl = cleanBaseUrl.slice(0, -1);
          }
          const endpoint = `${cleanBaseUrl}/send/menu`;

          console.log(`[Webhook] Enviando menu Uazapi para ${numberClean}. URL: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': uazapiConfig.token
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Uazapi API Error (Status ${response.status}): ${errorText}`);
          }

          console.log('[Webhook] Menu Uazapi enviado com sucesso!');

          await sessionRef.set({
            activeNodeId: node.id,
            variables: sessionVars,
            lastBotSentMessage: resolvedMenuText.trim(),
            lastBotSentAt: Date.now(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          break;
        } catch (err) {
          console.error(`[Webhook] Erro ao disparar menu Uazapi (${node.name}):`, err.message);
          currentNodeId = node.fallbackNodeId;
          continue;
        }
      }

      currentNodeId = node.nextNodeId;
    }

    if (!currentNodeId) {
      await sessionRef.update({
        status: 'finished',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[Webhook] Conversa ${conversationId} chegou ao fim do fluxo.`);
    }

    res.status(200).send('Flow executed successfully');
  } catch (error) {
    console.error('[Webhook Error] Erro no processamento:', error);
    res.status(500).send('Internal Server Error: ' + error.message);
  }
});

// 2. GET Chatwoot Agents Proxy
app.get('/getChatwootAgents', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).send('Missing projectId');
  }

  try {
    if (!db) {
      throw new Error('Database not initialized.');
    }
    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).send('Project not found');
    }

    const projectData = projectSnap.data();
    const config = projectData?.chatwootConfig;

    if (!config || !config.url || !config.token || !config.accountId) {
      return res.status(400).send('Chatwoot integration not configured');
    }

    let rawUrl = config.url.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = 'https://' + rawUrl;
    }
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/agents`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.token
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      const errorText = await response.text();
      res.status(response.status).send(errorText);
    }
  } catch (err) {
    res.status(500).send(err.message || 'Internal server error');
  }
});

// 3. GET Chatwoot Teams Proxy
app.get('/getChatwootTeams', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).send('Missing projectId');
  }

  try {
    if (!db) {
      throw new Error('Database not initialized.');
    }
    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).send('Project not found');
    }

    const projectData = projectSnap.data();
    const config = projectData?.chatwootConfig;

    if (!config || !config.url || !config.token || !config.accountId) {
      return res.status(400).send('Chatwoot integration not configured');
    }

    let rawUrl = config.url.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = 'https://' + rawUrl;
    }
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/teams`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.token
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      const errorText = await response.text();
      res.status(response.status).send(errorText);
    }
  } catch (err) {
    res.status(500).send(err.message || 'Internal server error');
  }
});

// 4. GET Chatwoot Labels Proxy
app.get('/getChatwootLabels', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).send('Missing projectId');
  }

  try {
    if (!db) {
      throw new Error('Database not initialized.');
    }
    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).send('Project not found');
    }

    const projectData = projectSnap.data();
    const config = projectData?.chatwootConfig;

    if (!config || !config.url || !config.token || !config.accountId) {
      return res.status(400).send('Chatwoot integration not configured');
    }

    let rawUrl = config.url.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = 'https://' + rawUrl;
    }
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/labels`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.token
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      const errorText = await response.text();
      res.status(response.status).send(errorText);
    }
  } catch (err) {
    res.status(500).send(err.message || 'Internal server error');
  }
});

/**
 * Sends a message back to Chatwoot API
 */
async function sendChatwootMessage(db, projectId, conversationId, config, text) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': config.token
    },
    body: JSON.stringify({
      content: text,
      message_type: 'outgoing'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chatwoot API Error (Status ${response.status}): ${errorText}`);
  }

  try {
    await db.doc(`projects/${projectId}/sessions/${conversationId}`).set({
      lastBotSentMessage: text.trim(),
      lastBotSentAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn(`Erro ao atualizar lastBotSentMessage na sessão:`, err.message);
  }

  console.log(`Mensagem enviada com sucesso para o Chatwoot conversation ${conversationId}`);
}

/**
 * Overwrites/sets labels on a Chatwoot conversation directly
 */
async function updateChatwootLabels(config, conversationId, labels) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/labels`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': config.token
    },
    body: JSON.stringify({
      labels: labels
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chatwoot API Error (Status ${response.status}): ${errorText}`);
  }
  console.log(`Etiquetas atualizadas com sucesso para a conversa ${conversationId}: [${labels.join(', ')}]`);
}

/**
 * Adds a label to a Chatwoot conversation
 */
async function addChatwootLabel(config, conversationId, label) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/labels`;

  let existingLabels = [];
  try {
    const getResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.token
      }
    });

    if (getResponse.ok) {
      const getData = await getResponse.json();
      existingLabels = getData.payload || [];
    }
  } catch (err) {
    console.warn(`Erro ao carregar etiquetas atuais da conversa ${conversationId}:`, err.message);
  }

  const normalizedLabel = label.trim();
  const labelExists = existingLabels.some(l => l.toLowerCase() === normalizedLabel.toLowerCase());
  
  if (!labelExists) {
    existingLabels.push(normalizedLabel);
    await updateChatwootLabels(config, conversationId, existingLabels);
  } else {
    console.log(`Etiqueta "${label}" já existe na conversa ${conversationId}.`);
  }
}

/**
 * Removes a label from a Chatwoot conversation
 */
async function removeChatwootLabel(config, conversationId, label) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/labels`;

  let existingLabels = [];
  try {
    const getResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.token
      }
    });

    if (getResponse.ok) {
      const getData = await getResponse.json();
      existingLabels = getData.payload || [];
    }
  } catch (err) {
    console.warn(`Erro ao carregar etiquetas atuais da conversa ${conversationId}:`, err.message);
    return;
  }

  const normalizedLabel = label.trim().toLowerCase();
  const updatedLabels = existingLabels.filter(l => l.trim().toLowerCase() !== normalizedLabel);

  if (updatedLabels.length !== existingLabels.length) {
    await updateChatwootLabels(config, conversationId, updatedLabels);
  } else {
    console.log(`Etiqueta "${label}" não encontrada na conversa ${conversationId}. Nenhuma ação necessária.`);
  }
}

/**
 * Executes a custom HTTP API request defined in a FlowNode
 */
async function executeHttpRequest(node) {
  const url = node.httpUrl || '';
  if (!url) return;

  const method = node.httpMethod || 'GET';
  const headersObj = {};

  if (node.httpHeaders) {
    node.httpHeaders.forEach(h => {
      if (h.key && h.value) {
        headersObj[h.key] = h.value;
      }
    });
  }

  const options = {
    method,
    headers: headersObj,
  };

  if (method !== 'GET' && node.httpBody) {
    options.body = node.httpBody;
  }

  const response = await fetch(url, options);
  console.log(`HTTP Request node (${node.name}) executado. Status: ${response.status}`);
}

/**
 * Updates the status of a Chatwoot conversation
 */
async function updateChatwootConversationStatus(config, conversationId, status) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/toggle_status`;

  const payload = { status: status };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': config.token
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Chatwoot API error (Toggle Status): ${response.status} ${response.statusText}`);
  }
}

/**
 * Assigns an agent and/or team to a Chatwoot conversation
 */
async function assignChatwootConversation(config, conversationId, assigneeId, teamId) {
  let rawUrl = config.url.trim();
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
  const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/assignments`;

  const payload = {};
  if (assigneeId !== undefined) {
    payload.assignee_id = assigneeId;
  }
  if (teamId !== undefined) {
    payload.team_id = teamId;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': config.token
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chatwoot API Error (Status ${response.status}): ${errorText}`);
  }
  
  console.log(`Conversa ${conversationId} atualizada com atribuições: assignee_id=${assigneeId}, team_id=${teamId}`);
}

app.listen(port, () => {
  console.log(`🚀 Servidor backend Amchat Flowbuilder rodando na porta ${port}`);
});
