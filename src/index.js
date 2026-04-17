import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { checkbox } from '@inquirer/prompts';
import { buildTag, slugify, todayFolder, todayStamp, toCsv } from './utils.js';

const { Client, LocalAuth } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

function ts() {
  return new Date().toISOString().slice(11, 23);
}
function log(tag, msg) {
  console.log(`[${ts()}] [${tag}] ${msg}`);
}
function warn(tag, msg) {
  console.warn(`[${ts()}] [${tag}] ${msg}`);
}
function err(tag, msg) {
  console.error(`[${ts()}] [${tag}] ${msg}`);
}

async function extractGroup(client, chat) {
  const date = todayStamp();
  const tag = buildTag(chat.name, date);
  const participants = chat.participants ?? [];
  log('extract', `"${chat.name}" — ${participants.length} participantes, tag="${tag}"`);

  const rows = [];
  const total = participants.length;
  const progressEvery = Math.max(1, Math.floor(total / 10));
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < total; i++) {
    const p = participants[i];
    const id = p.id._serialized;
    let name = '';
    let pushname = '';
    try {
      const contact = await client.getContactById(id);
      name = contact.name ?? contact.verifiedName ?? '';
      pushname = contact.pushname ?? '';
      ok++;
    } catch (e) {
      fail++;
      warn('extract', `falha contato ${id}: ${e.message}`);
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
    if ((i + 1) % progressEvery === 0 || i + 1 === total) {
      log('extract', `  progresso ${i + 1}/${total} (ok=${ok}, fail=${fail})`);
    }
  }

  return { tag, rows, ok, fail };
}

function writeCsv(groupName, rows) {
  const folder = path.join(OUTPUT_DIR, todayFolder());
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const csvPath = path.join(folder, `${slugify(groupName)}.csv`);
  fs.writeFileSync(csvPath, toCsv(rows), 'utf8');
  log('csv', `${rows.length} linhas → ${path.relative(ROOT, csvPath)}`);
}

async function main() {
  log('init', `ROOT=${ROOT}`);
  log('init', `auth dir=${path.join(ROOT, '.wwebjs_auth')}`);
  log('init', `output dir=${OUTPUT_DIR}`);

  const authDirExists = fs.existsSync(path.join(ROOT, '.wwebjs_auth'));
  log('init', `sessão existente: ${authDirExists ? 'sim (não deve pedir QR)' : 'não (vai pedir QR)'}`);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(ROOT, '.wwebjs_auth') }),
    puppeteer: { headless: true, args: ['--no-sandbox'] },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1027014171-alpha.html',
    },
  });

  client.on('qr', (qr) => {
    log('qr', 'QR recebido — escaneie no WhatsApp (Configurações → Aparelhos conectados):');
    qrcode.generate(qr, { small: true });
  });

  client.on('loading_screen', (pct, msg) => log('loading', `${pct}% ${msg ?? ''}`));
  client.on('authenticated', () => log('auth', 'autenticado, sincronizando chats (pode demorar 30-90s na primeira vez)...'));
  client.on('auth_failure', (m) => err('auth_failure', m));
  client.on('change_state', (s) => log('state', s));
  client.on('disconnected', (r) => log('disconnected', r));

  const readyTimer = setTimeout(() => {
    warn('ready', 'ainda não ficou pronto após 120s — pode ser incompatibilidade de versão ou sync travado.');
  }, 120000);

  client.on('ready', async () => {
    clearTimeout(readyTimer);
    log('ready', 'cliente pronto.');

    log('chats', 'carregando lista de chats...');
    const t0 = Date.now();
    const chats = await client.getChats();
    log('chats', `${chats.length} chats carregados em ${Date.now() - t0}ms`);

    const groups = chats
      .filter((c) => c.isGroup)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    log('chats', `${groups.length} grupos encontrados`);

    if (groups.length === 0) {
      warn('chats', 'nenhum grupo encontrado. Encerrando.');
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
    } catch (e) {
      warn('select', 'seleção cancelada.');
      await client.destroy();
      process.exit(0);
    }

    log('select', `${selected.length} grupo(s) selecionado(s)`);

    let totalOk = 0;
    let totalFail = 0;
    for (let i = 0; i < selected.length; i++) {
      const id = selected[i];
      const chat = groups.find((g) => g.id._serialized === id);
      log('extract', `(${i + 1}/${selected.length}) iniciando "${chat.name}"`);
      const t = Date.now();
      try {
        const result = await extractGroup(client, chat);
        writeCsv(chat.name, result.rows);
        totalOk += result.ok;
        totalFail += result.fail;
        log('extract', `concluído em ${Date.now() - t}ms`);
      } catch (e) {
        err('extract', `"${chat.name}": ${e.message}`);
      }
    }

    log('done', `total contatos ok=${totalOk}, fail=${totalFail}. Encerrando.`);
    await client.destroy();
    process.exit(0);
  });

  log('init', 'inicializando cliente (abrindo Chromium headless)...');
  const tInit = Date.now();
  await client.initialize();
  log('init', `client.initialize() retornou em ${Date.now() - tInit}ms`);
}

main().catch((e) => {
  err('fatal', e.stack ?? e.message);
  process.exit(1);
});
