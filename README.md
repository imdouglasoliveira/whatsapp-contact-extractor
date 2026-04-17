# whatsapp-contact-extractor

Extrai contatos de grupos de WhatsApp via [whatsapp-web.js](https://wwebjs.dev). Saída em CSV com tag no formato `nome-grupo-AAAA-MM-DD`.

## Stack

- Node.js 18+
- whatsapp-web.js (Puppeteer + WhatsApp Web)
- `@inquirer/prompts` — seleção interativa de grupos no terminal
- LocalAuth — sessão persistida em `.wwebjs_auth/` (QR só na primeira vez)

## Setup

```bash
pnpm install
```

## Uso

```bash
pnpm start
```

Fluxo:

1. Primeira vez: aparece QR code — escaneie (WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho).
2. Após sync (30-90s na primeira vez), os grupos aparecem numa lista.
3. Use ↑↓ pra navegar, **espaço** pra marcar, **enter** pra confirmar.
4. Contatos salvos em `output/<slug-grupo>-AAAA-MM-DD.csv`.

Nas próximas execuções o QR não aparece — sessão fica em `.wwebjs_auth/`.

## Formato do CSV

Colunas: `tag`, `grupo`, `data_extracao`, `numero`, `jid`, `nome`, `pushname`, `is_admin`, `is_super_admin`.

## Notas

- `output/`, `.wwebjs_auth/` e `.wwebjs_cache/` são gitignored.
- Uso é não-oficial (viola ToS do WhatsApp se usado em escala). Para grupos próprios/pontuais, risco é baixo.
- Se a sessão expirar ou der erro de versão, apague `.wwebjs_auth/` e reescaneie.
