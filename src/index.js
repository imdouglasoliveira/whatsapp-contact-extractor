import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { checkbox } from '@inquirer/prompts';
import { buildTag, todayStamp, toCsv } from './utils.js';

const { Client, LocalAuth } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

async function extractGroup(client, chat) {
  const date = todayStamp();
  const tag = buildTag(chat.name, date);
  const participants = chat.participants ?? [];

  const rows = [];
  for (const p of participants) {
    const id = p.id._serialized;
    let name = '';
    let pushname = '';
    try {
      const contact = await client.getContactById(id);
      name = contact.name ?? contact.verifiedName ?? '';
      pushname = contact.pushname ?? '';
    } catch (err) {
      console.warn(`    [warn] falha ao buscar contato ${id}: ${err.message}`);
    }
    rows.push({
      tag,
      grupo: chat.name,
      data_extracao: date,
      numero: p.id.user,
      jid: id,
      nome: name,
      pushname,
      is_admin: p.isAdmin ? 'true' : 'false',
      is_super_admin: p.isSuperAdmin ? 'true' : 'false',
    });
  }

  return { tag, rows };
}

function writeCsv(tag, rows) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const csvPath = path.join(OUTPUT_DIR, `${tag}.csv`);
  fs.writeFileSync(csvPath, toCsv(rows), 'utf8');
  console.log(`  [ok] ${rows.length} contatos → ${path.relative(ROOT, csvPath)}`);
}

async function main() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(ROOT, '.wwebjs_auth') }),
    puppeteer: { headless: true, args: ['--no-sandbox'] },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1027014171-alpha.html',
    },
  });

  client.on('qr', (qr) => {
    console.log('\nEscaneie o QR abaixo com o WhatsApp (Configurações → Aparelhos conectados):');
    qrcode.generate(qr, { small: true });
  });

  client.on('loading_screen', (pct, msg) => console.log(`[loading] ${pct}% ${msg}`));
  client.on('authenticated', () => console.log('[auth] autenticado, sincronizando (pode demorar 30-90s)...'));
  client.on('auth_failure', (m) => console.error('[auth_failure]', m));
  client.on('change_state', (s) => console.log(`[state] ${s}`));
  client.on('disconnected', (r) => console.log(`[disconnected] ${r}`));

  client.on('ready', async () => {
    console.log('Cliente pronto. Carregando grupos...\n');
    const chats = await client.getChats();
    const groups = chats
      .filter((c) => c.isGroup)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    if (groups.length === 0) {
      console.log('Nenhum grupo encontrado.');
      await client.destroy();
      process.exit(0);
    }

    let selected;
    try {
      selected = await checkbox({
        message: 'Selecione os grupos para extrair (espaço marca, enter confirma):',
        choices: groups.map((g) => ({
          name: `${g.name} (${g.participants?.length ?? '?'} membros)`,
          value: g.id._serialized,
        })),
        pageSize: 20,
        required: true,
      });
    } catch (err) {
      console.log('\nSeleção cancelada.');
      await client.destroy();
      process.exit(0);
    }

    console.log(`\nExtraindo ${selected.length} grupo(s)...\n`);
    for (const id of selected) {
      const chat = groups.find((g) => g.id._serialized === id);
      console.log(`→ ${chat.name}`);
      try {
        const result = await extractGroup(client, chat);
        writeCsv(result.tag, result.rows);
      } catch (err) {
        console.error(`  [erro] ${chat.name}: ${err.message}`);
      }
    }

    console.log('\nConcluído.');
    await client.destroy();
    process.exit(0);
  });

  await client.initialize();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
