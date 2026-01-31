import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import pino from 'pino';
import { getDuePayments, formatCurrency, formatDate } from './lib/bot.js';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('💡 [WHATSAPP] Novo QR Code gerado. Escaneie para conectar:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ [WHATSAPP] Conexão fechada. Motivo:', lastDisconnect.error, 'Reconectando:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ [WHATSAPP] Conexão estabelecida com sucesso!');
        }
    });

    // Agendamento: Todos os dias às 11:00 (Horário do Acre)
    cron.schedule('0 11 * * *', async () => {
        console.log('🚀 [CRON] Iniciando rotina de cobrança automática (11:00 AC)...');
        await runBillingRoutine(sock);
    }, {
        scheduled: true,
        timezone: "America/Rio_Branco"
    });

    // Comando de Teste: Executa 5 segundos após ligar
    setTimeout(() => {
        console.log('🧪 [SIMULAÇÃO] Iniciando disparo de teste em 5 segundos...');
        runBillingRoutine(sock);
    }, 5000);
}

async function runBillingRoutine(sock) {
    try {
        const alerts = await getDuePayments();
        console.log(`📡 [BOT] Encontrados ${alerts.length} alertas para envio.`);

        for (const alert of alerts) {
            const { student, payment, type } = alert;
            /**
             * NORMALIZAÇÃO SÊNIOR (Brasil): No WhatsApp, números com DDD > 31 
             * geralmente NÃO possuem o 9º dígito no JID oficial, mesmo que 
             * no discador o número tenha 9 dígitos.
             */
            function getJid(rawPhone) {
                let clean = rawPhone.replace(/\D/g, '');
                // Remove 55 se já estiver lá
                if (clean.length > 11 && clean.startsWith('55')) clean = clean.slice(2);

                if (clean.length === 11 && clean.startsWith('9', 2)) {
                    const ddd = parseInt(clean.substring(0, 2));
                    // Se DDD > 31, removemos o 9 (terceiro dígito) para o JID
                    if (ddd > 31) {
                        return `55${clean.substring(0, 2)}${clean.substring(3)}@s.whatsapp.net`;
                    }
                }
                return `55${clean}@s.whatsapp.net`;
            }

            const jid = getJid(student.phone);
            const valueStr = formatCurrency(payment.calculatedAmount || payment.amount);
            const dateStr = formatDate(payment.due_date);

            let message = '';
            const greeting = student.guardian_name ? `Olá *${student.guardian_name}*!` : `Olá!`;

            if (type === 'HOJE') {
                message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* *VENCE HOJE*. Valor: ${valueStr}. Conte conosco!`;
            } else if (type === '2_DIAS') {
                message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* vence em *2 DIAS* (${dateStr}). Valor: ${valueStr}.`;
            } else if (type === '3_DIAS') {
                message = `${greeting} Passando para lembrar que a mensalidade do(a) aluno(a) *${student.name}* vence em *3 DIAS* (${dateStr}). Valor: ${valueStr}.`;
            } else if (type === 'ATRASADO') {
                message = `${greeting} Informamos que a mensalidade do(a) aluno(a) *${student.name}* está *ATRASADA* (${alert.diffDays} dias). Valor atualizado: ${valueStr}. Por favor, regularize assim que possível.`;
            }

            if (message) {
                console.log(`📤 [BOT] Enviando mensagem para ${student.name} | JID: ${jid}...`);
                await sock.sendMessage(jid, { text: message });
                // Delay de segurança para evitar ban (3 a 7 segundos)
                await new Promise(r => setTimeout(r, Math.random() * 4000 + 3000));
            }
        }
        console.log('✅ [BOT] Rotina de cobrança finalizada.');
    } catch (error) {
        console.error('❌ [BOT] Erro na rotina de cobrança:', error);
    }
}

console.log('--------------------------------------------------');
console.log('🚀 RISE UP - SERVIÇO DE WHATSAPP INICIADO');
console.log('--------------------------------------------------');
connectToWhatsApp();
