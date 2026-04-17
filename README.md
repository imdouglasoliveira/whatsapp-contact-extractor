# whatsapp-contact-extractor

Extrai contatos de grupos de WhatsApp via [whatsapp-web.js](https://wwebjs.dev). Seleção interativa de grupos no terminal, saída em CSV organizada por data.

## Stack

- Node.js 18+
- [whatsapp-web.js](https://wwebjs.dev) — Puppeteer + WhatsApp Web (não-oficial)
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) — multi-select no terminal
- `LocalAuth` — sessão persistida em `.wwebjs_auth/` (QR só na primeira vez)
- Versão do WhatsApp Web pinada via [wppconnect/wa-version](https://github.com/wppconnect-team/wa-version) pra evitar quebras

## Setup

```bash
pnpm install
```

O postinstall do `puppeteer` baixa o Chromium automaticamente (~170MB em `~/.cache/puppeteer/`).

## Uso

```bash
pnpm start
```

### Fluxo

1. **Boot** (15-60s na primeira execução) — Chromium sobe, WhatsApp Web carrega. Heartbeat a cada 5s mostra progresso.
2. **QR code** (só na primeira vez) — escaneia com WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho.
3. **Sync** (30-90s na primeira vez) — WhatsApp sincroniza chats. Logs `[loading] N%` mostram progresso.
4. **Seleção** — lista de grupos ordenada alfabeticamente. ↑↓ navega, **espaço** marca, **enter** confirma.
5. **Extração** — itera participantes, log de progresso a cada 10%.
6. **Saída** — CSV salvo em `output/DD-MM-AAAA/<slug-grupo>.csv`.

Nas execuções seguintes o QR não aparece — a sessão fica salva em `.wwebjs_auth/`.

## Estrutura de saída

```
output/
└── 16-04-2026/
    ├── meu-grupo-a.csv
    └── meu-grupo-b.csv
```

### Colunas do CSV

| coluna | descrição |
|--------|-----------|
| `tag` | `<slug-grupo>-AAAA-MM-DD` (identificador único da extração) |
| `grupo` | nome original do grupo |
| `data_extracao` | `AAAA-MM-DD` |
| `numero` | número do contato (sem `@c.us`) |
| `jid` | JID completo (`55119...@c.us`) |
| `nome` | nome salvo no contato do operador |
| `pushname` | nome que o próprio contato configurou no WhatsApp |
| `is_admin` | `true`/`false` |
| `is_super_admin` | `true`/`false` |

## Logs

Todos os eventos têm timestamp `HH:MM:SS.mmm` e tag semântica:

| tag | o que mostra |
|-----|--------------|
| `init` | paths, sessão existente, boot |
| `heartbeat` | tempo decorrido enquanto aguarda evento (a cada 5s) |
| `qr` | QR recebido |
| `loading` | % do loading screen do WhatsApp |
| `auth` | autenticado, sincronizando |
| `state` | mudanças de estado (`CONNECTED`, `CONFLICT`, etc.) |
| `chats` | total de chats e grupos carregados |
| `select` | grupos marcados pelo usuário |
| `extract` | progresso por grupo e por participante |
| `csv` | caminho do arquivo escrito |
| `done` | totais finais |

Watchdog de 120s avisa se `ready` não disparar.

## Troubleshooting

### "Could not find Chrome"

Falta Chromium. Rode:

```bash
pnpm dlx puppeteer browsers install chrome
```

### Trava após escanear QR

Geralmente é incompatibilidade de versão do WhatsApp Web. Apague a sessão e tente novamente:

```bash
rm -rf .wwebjs_auth .wwebjs_cache
pnpm start
```

Se persistir, atualize o `remotePath` em [src/index.js](src/index.js) pra uma versão mais recente em [wppconnect-team/wa-version](https://github.com/wppconnect-team/wa-version/tree/main/html).

### Sessão expirou

Aconteceu se você vir `[disconnected]` ou `[auth_failure]`. Solução:

```bash
rm -rf .wwebjs_auth .wwebjs_cache
pnpm start
```

## Notas

- `output/`, `.wwebjs_auth/` e `.wwebjs_cache/` são gitignored.
- `whatsapp-web.js` é **não-oficial**. Uso em escala viola o ToS do WhatsApp e pode banir o número. Para grupos próprios e uso pontual, risco é baixo.
- Para automação oficial/em escala, considere a [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) (exige aprovação Meta).
