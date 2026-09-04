const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0"]
    });

    if (!sock.authState.creds.registered) {
        console.log('\n==================================================');
        let phoneNumber = await question('📱 WhatsApp අංකය Country Code එක සමඟ ඇතුළත් කරන්න (උදා: 94771234567): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber) {
            console.log('❌ වලංගු Phone Number එකක් ඇතුළත් කරන්න!');
            process.exit(1);
        }

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n🔑 ඔයාගේ Pairing Code එක: \x1b[32m${code}\x1b[0m\n`);
                console.log('👉 WhatsApp > Linked Devices > Link with phone number instead ගොස් මේ Code එක ලබාදෙන්න.\n');
                console.log('==================================================\n');
            } catch (err) {
                console.log('❌ Pairing Code එක ලබාගැනීමට අපොහොසත් විය:', err.message);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 සම්බන්ධතාවය බිඳ වැටුණි. නැවත Connect වෙමින් පවතී...');
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('❌ Session එක Log out වී ඇත. කරුණාකර නැවත run කර Pairing Code එක ලබාගන්න.');
            }
        } else if (connection === 'open') {
            console.log('\n✅ ------------------------------------------- ✅');
            console.log('🚀 ANUU WHATSAPP BOT SUCCESSFUL CONNECTED!');
            console.log('✅ ------------------------------------------- ✅\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        const from = m.key.remoteJid;

        if (text === '.alive') {
            await sock.sendMessage(from, { 
                text: '🤖 *ANUU BOT IS ACTIVE AND WORKING!* \n\n' +
                      '⚡ *Status:* Online 24/7\n' +
                      '✨ *Developer:* ANUU Studios' 
            });
        }

        if (text === '.ping') {
            await sock.sendMessage(from, { text: '🏓 *Pong!* Bot එක හොඳින් වැඩ කරයි.' });
        }
    });
}

startBot();
