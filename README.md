# whatsapp-contact-extractor

Extrai contatos de grupos de WhatsApp via [whatsapp-web.js](https://wwebjs.dev) e salva em CSV/JSON com tag no formato `nome-grupo-AAAA-MM-DD`.

## Stack

- Node.js 18+
- whatsapp-web.js (Puppeteer + WhatsApp Web)
- LocalAuth — sessão persistida em `.wwebjs_auth/` (QR só na primeira vez)

## Setup

```bash
pnpm install   # ou npm install
```

## Uso

### 1. Descobrir os nomes exatos dos grupos

```bash
pnpm list-groups
```

Escaneie o QR (WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho). Os grupos aparecem no terminal.

### 2. Configurar os grupos alvo

Edite [config/groups.json](config/groups.json) com os nomes **exatos** dos grupos:

```json
{
  "groups": ["Meu Grupo", "Outro Grupo"]
}
```

### 3. Extrair

```bash
pnpm start
```

Saída em `output/`:
- `<slug-grupo>-AAAA-MM-DD.csv`
- `<slug-grupo>-AAAA-MM-DD.json`

Cada linha/registro inclui a `tag` (`nome-grupo-AAAA-MM-DD` tudo minúsculo), número, nome, pushname e flags de admin.

## Notas

- `output/`, `.wwebjs_auth/` e `.wwebjs_cache/` são gitignored.
- Uso é não-oficial (viola ToS do WhatsApp se usado em escala). Para um grupo próprio/pontual, risco é baixo.
- Se a sessão expirar, apague `.wwebjs_auth/` e reescaneie o QR.
