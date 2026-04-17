import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { buildTag, slugify, todayStamp, toCsv } from './utils.js';

const { Client, LocalAuth } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'groups.json');
const OUTPUT_DIR = path.join(ROOT, 'output');

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const cfg = JSON.parse(raw);
  if (!Array.isArray(cfg.groups) || cfg.groups.length === 0) {
    throw new Error('config/groups.json: preencha o array "groups" com os nomes dos grupos.');
  }
  return cfg.groups;
}

async function extractGroup(client, groupName) {
  const chats = await client.getChats();
  const chat = chats.find((c) => c.isGroup && c.name === groupName);
  if (!chat) {
    console.warn(`  [skip] grupo "${groupName}" não encontrado.`);
    return null;
  }

  const date = todayStamp();
  const tag = buildTag(groupName, date);
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
      grupo: groupName,
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

function writeOutputs(tag, rows) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `${tag}.json`);
  const csvPath = path.join(OUTPUT_DIR, `${tag}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify({ tag, total: rows.length, contatos: rows }, null, 2), 'utf8');
  fs.writeFileSync(csvPath, toCsv(rows), 'utf8');
  console.log(`  [ok] ${rows.length} contatos → ${path.relative(ROOT, csvPath)} / ${path.relative(ROOT, jsonPath)}`);
}

async function main() {
  const targetGroups = loadConfig();
  console.log(`Grupos alvo: ${targetGroups.join(', ')}`);

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
    console.log('Cliente pronto. Extraindo grupos...\n');
    for (const name of targetGroups) {
      console.log(`→ ${name}`);
      try {
        const result = await extractGroup(client, name);
        if (result) writeOutputs(result.tag, result.rows);
      } catch (err) {
        console.error(`  [erro] ${name}: ${err.message}`);
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
