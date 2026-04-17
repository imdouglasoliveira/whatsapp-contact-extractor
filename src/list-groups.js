import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const { Client, LocalAuth } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(ROOT, '.wwebjs_auth') }),
  puppeteer: { headless: true, args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  console.log('Escaneie o QR:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  const chats = await client.getChats();
  const groups = chats.filter((c) => c.isGroup);
  console.log(`\n${groups.length} grupos:`);
  for (const g of groups) {
    console.log(`- ${g.name}  (${g.participants?.length ?? '?'} membros)`);
  }
  await client.destroy();
  process.exit(0);
});

client.initialize();
