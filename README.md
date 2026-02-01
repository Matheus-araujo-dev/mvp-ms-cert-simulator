# MVP — Simulador de Certificação Microsoft (AZ-900)

Este projeto é um simulador de prova em **Next.js (App Router)**, começando pela certificação **AZ-900**.

Modos disponíveis:
- **Study (Estudo):** sem tempo; você responde e só vê o resultado ao clicar **Conferir resposta**; depois a questão fica travada.
- **Exam (Prova):** com tempo; você responde sem gabarito; só vê correta/incorreta + explicação após finalizar.

O conteúdo é **fixo em JSON** (sem banco de dados neste MVP).

---

## Para quem nunca usou Git / terminal

Você vai fazer 3 coisas:
1) Instalar programas necessários (Git + Node.js).
2) Baixar o projeto (clone).
3) Instalar dependências e rodar (um comando).

Você pode fazer o “clone” por **app com interface** (mais fácil) ou por **terminal**.

---

## 0) Instalar o que precisa

### 0.1 Instalar Git
Você precisa do Git para “clonar” o projeto.

- Windows: instale o **Git for Windows**
- macOS: instale o **Git** (pode pedir para instalar “Command Line Tools” na primeira vez)

Links (copie/cole no navegador):
```text
https://git-scm.com/downloads
```

Depois de instalar, reinicie o computador se ele pedir.

### 0.2 Instalar Node.js
Você precisa do Node.js para rodar o projeto.

Recomendado: **Node 18+** (ideal 20+).

Links (copie/cole no navegador):
```text
https://nodejs.org/
```

### 0.3 (Opcional, recomendado) Instalar pnpm
O projeto funciona com npm, mas **pnpm** costuma ser melhor em monorepo.

No final, se você preferir, pode instalar com um comando:
```bash
npm i -g pnpm
```

---

## 1) Preparar um lugar para o projeto no computador

Crie uma pasta simples, por exemplo:
- Windows: `C:\Projetos`
- macOS: `~/Projetos`

Isso é só para organizar.

---

## 2) Baixar o projeto (Clone)

Escolha **uma** opção:

## Opção A (mais fácil): GitHub Desktop (sem terminal para clonar)

Se o repositório estiver no GitHub, essa é a forma mais simples.

1) Instale o **GitHub Desktop** (pesquise “GitHub Desktop” no Google e instale).
2) Abra o GitHub Desktop e faça login (se necessário).
3) Clique em **File > Clone repository**.
4) Cole a **URL** do repositório (ou selecione na lista).
5) Escolha a pasta local (ex.: `C:\Projetos\mvp-ms-cert-simulator`).
6) Clique em **Clone**.

Pronto. O projeto já está no computador.

## Opção B: Pelo terminal (clone com comando)

### Windows (PowerShell)
1) Abra o **PowerShell**:
   - Pressione `Windows`, digite `PowerShell`, e abra.
2) Vá para sua pasta de projetos (exemplo `C:\Projetos`):
```powershell
cd C:\Projetos
```
3) Clone:
```powershell
git clone <URL_DO_REPOSITORIO>
```
4) Entre na pasta do projeto:
```powershell
cd mvp-ms-cert-simulator
```

### macOS (Terminal)
1) Abra o **Terminal** (Spotlight: digite “Terminal”).
2) Vá para sua pasta de projetos:
```bash
mkdir -p ~/Projetos
cd ~/Projetos
```
3) Clone:
```bash
git clone <URL_DO_REPOSITORIO>
```
4) Entre na pasta:
```bash
cd mvp-ms-cert-simulator
```

> Observação: você vai substituir `<URL_DO_REPOSITORIO>` pela URL real do repo.

---

## 3) Abrir o projeto no VS Code (recomendado)

1) Instale o **Visual Studio Code** (VS Code).
2) Abra o VS Code.
3) Clique em **File > Open Folder** e selecione a pasta `mvp-ms-cert-simulator`.

### Abrir o terminal dentro do VS Code
No VS Code:
- Menu **Terminal > New Terminal**

Você vai digitar os comandos ali.

---

## 4) Instalar dependências

Dentro da pasta do projeto (`mvp-ms-cert-simulator`), rode **uma** opção:

### Opção A: pnpm (recomendado)
```bash
pnpm install
```

### Opção B: npm
```bash
npm install
```

Isso baixa tudo que o projeto precisa.

---

## 5) Rodar o projeto

Ainda no terminal, rode:

### Com pnpm
```bash
pnpm dev
```

### Com npm
```bash
npm run dev
```

O app vai subir normalmente em:
- `http://localhost:3000`

Abra esse endereço no navegador.

---

## 6) Como acessar um simulado

Exemplo (AZ-900 Simulado 01):

- **Estudo:**
  - `http://localhost:3000/az-900/az900-sim-01?mode=study`

- **Prova:**
  - `http://localhost:3000/az-900/az900-sim-01?mode=exam`

---

## Estrutura do projeto (resumo)

- `apps/web/`
  - Frontend Next.js + rotas API
  - Runner: `apps/web/src/components/FixedSimulationRunner.tsx`
  - Página do simulado: `apps/web/src/app/az-900/[simulationId]/page.tsx`
  - API:
    - `apps/web/src/app/api/az-900/grade/route.ts`
    - `apps/web/src/app/api/az-900/grade-question/route.ts`
  - Loader de conteúdo:
    - `apps/web/src/lib/content/az900-fixed.ts`

- `packages/content/`
  - Conteúdo JSON (questões e simulados)
  - `packages/content/exams/az-900/`

---

## Persistência de progresso

O progresso do usuário é salvo no navegador via `localStorage` (por simulado, idioma e modo).
Ao clicar em **Sair**, o progresso daquela execução é apagado e você volta para a Home.

---

## Problemas comuns

### “git não é reconhecido” (Windows)
Significa que o Git não foi instalado corretamente ou o terminal não foi reaberto.
- Reinstale o Git
- Feche e reabra o PowerShell/VS Code

### Porta 3000 ocupada
O Next pode subir em outra porta (ex.: 3001). Veja no terminal e use a URL indicada.

### Erro de dependências
Apague e reinstale.

macOS / Linux:
```bash
rm -rf node_modules
pnpm install
pnpm dev
```

Windows (PowerShell):
```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
pnpm dev
```

### “pnpm não é reconhecido”
Instale:
```bash
npm i -g pnpm
```

---

## Checklist rápido (para não errar)
1) Instale Git e Node.
2) Clone o repo (GitHub Desktop ou `git clone`).
3) Abra a pasta no VS Code.
4) Terminal no VS Code → `pnpm install` → `pnpm dev`
5) Abra `http://localhost:3000`


### Commit falha com Husky / pre-commit
Este projeto roda validações automaticamente antes do commit.

Se o commit falhar, rode manualmente para ver o erro com detalhes:

```bash
node tools/content-cli/validate-az900.mjs
