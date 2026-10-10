# 10 — Submissão ao catálogo do Grafana

Como publicar o TopoFlow no [catálogo de plugins](https://grafana.com/grafana/plugins/)
do Grafana, e o diário de cada submissão já feita. Escrito na primeira submissão
(v1.4.0, outubro de 2026) para que as próximas não precisem redescobrir nada.

Fontes oficiais, que valem mais que este documento se divergirem:

- [Publish or update a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-a-plugin)
- [Publishing best practices](https://grafana.com/developers/plugin-tools/publish-a-plugin/publishing-best-practices)
- [Help us test your plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/provide-test-environment)
- [Sign a plugin](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Critérios de publicação e assinatura](https://grafana.com/legal/plugins/)
- [FAQ de publicação](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-faqs)

## Visão geral do fluxo

```text
tag vX.Y.Z ──► GitHub Actions (release.yml) ──► draft release com .zip + .zip.sha1
                                                   │
                         publicar o draft release ◄┘
                                   │
grafana.com ► My Plugins ► Submit New Plugin (ou Submit Update)
   URL do .zip · URL do código (tag) · SHA1 · testing guidance
                                   │
validação automática ► fila ► revisão manual (código + teste num Grafana deles)
                                   │
                aprovado ► publicado no catálogo e assinado pela Grafana
```

Não há prazo de revisão: a Grafana não estima nem agenda data de publicação.

## Pré-requisitos (bloqueiam a submissão)

| # | Requisito | Por quê |
| --- | --- | --- |
| 1 | **Repositório público no GitHub** | Plugins Community "must already exist in a public Git repository". O campo *Source code URL* e o link do zip na release precisam abrir sem login. |
| 2 | **Organização `jlcp` existir no grafana.com**, com você como **Admin** | O ID `jlcp-topoflow-panel` tem prefixo `jlcp`. O validador (`org`) confere se essa org existe, e a assinatura sai em nome dela (`signedByOrg`). Só admin da org vê **My Plugins**. |
| 3 | Licença compatível | Apache-2.0, MIT, BSD, GPL-3.0, LGPL-3.0 ou AGPL-3.0. O TopoFlow é Apache-2.0. |
| 4 | `plugin-validator` sem erros | A Grafana roda o mesmo validador na entrada; o `release.yml` também roda. |
| 5 | Ambiente de teste provisionado | Opcional, mas reduz muito o tempo de revisão. Já existe: `docker-compose.yaml` + `provisioning/` com TestData e dashboards. |

> **O ID do plugin não muda.** Se a org `jlcp` não puder ser criada (slug
> tomado), o ID teria que mudar, e isso quebra todo dashboard salvo com
> `"type": "jlcp-topoflow-panel"`. Resolva a org **antes** de qualquer outra coisa.

### Classificação: Community ou Commercial

O formulário pergunta sobre a natureza do plugin para definir o nível de
assinatura:

- **Community** (grátis): open source, "not commercial in nature and not
  affiliated with any commercial endeavor".
- **Commercial** (exige assinatura paga do Grafana): "offered in connection with a
  commercial offering, commercial dependencies or offered by a for-profit
  business".

O autor no `plugin.json` cita a Jlcp. Responda o formulário com a verdade. Se o
plugin for oferecido pela empresa, a Grafana pode classificá-lo como Commercial.

## Passo a passo

Comandos no ambiente deste projeto: commit e tag pelo git do WSL, push pelo git
do Windows, porque o git do WSL trava esperando credencial.

### 1. Conta e organização no grafana.com

1. Entre em <https://grafana.com/auth/sign-in>. Se não tiver conta, crie uma; o
   plano Free do Grafana Cloud basta.
2. Garanta uma organização com slug **`jlcp`**. Na criação da conta, o nome da
   org/stack define o slug. Já tendo conta, crie uma org nova pelo menu de
   organizações. Confira com
   `curl -s https://grafana.com/api/orgs/jlcp`: tem que responder com JSON da
   org, e não `Org not found`.
3. Você precisa ser **Admin** dessa org.

### 2. Tornar o repositório público

GitHub → `MathewsJLCP/jlcp-topoflow-panel` → **Settings** → **General** →
*Danger Zone* → **Change repository visibility** → **Public**.

Antes de abrir, verifique se há segredos. Em 2026-10-10 foram verificados os
arquivos versionados e todo o histórico (tokens `glsa_`, `ghp_`,
`github_pat_`, chaves de API e senhas): nada encontrado. Os IPs nos `examples/`
são de faixas privadas ou de documentação. `temp/` e `releases/` não são
versionados.

### 3. Validar

```bash
npm run build
# zip com a pasta jlcp-topoflow-panel/ na raiz — ver docs/07
npx @grafana/plugin-validator@latest -sourceCodeUri file://. releases/jlcp-topoflow-panel-X.Y.Z.zip
```

O validador também roda o **osv-scanner** sobre o `package-lock.json` inteiro,
**inclusive as dependências de dev**. CVE de severidade alta ou crítica vira
**erro**. Os únicos ignorados são os pacotes trazidos pelos `@grafana/*` e uma
whitelist mínima. Como surgem CVEs novos toda semana, um lockfile que passou
ontem pode reprovar hoje. Rode o validador **no dia** da tag.

Para corrigir, nesta ordem:

1. `npm audit fix` (sem `--force`): atualiza o lockfile dentro das faixas do
   `package.json`.
2. O que sobrar e tiver versão corrigida, mas preso por faixa de um pacote
   intermediário: `"overrides"` no `package.json`.
3. O que não tiver versão corrigida: documentar e explicar ao revisor (ver
   *Testing guidance*).

Avisos que podem ser ignorados:

- "unsigned plugin": normal na primeira submissão;
- `react/jsx-runtime`: falso positivo, porque ele é externo;
- link do LinkedIn "possibly broken (999)": o LinkedIn bloqueia robôs, e o link
  funciona no navegador.

#### Estado do validador na v1.4.0 (2026-10-10)

| Achado | Origem | Tratamento |
| --- | --- | --- |
| 6 pacotes com CVE alto (`fast-uri`, `js-yaml`, `nanoid`, `source-map-js`...) | lockfile defasado | `npm audit fix` |
| `basic-ftp` ≤ 6.2.0 (CVE-2026-102990) | `@grafana/sign-plugin` → `proxy-agent` → `get-uri`, que fixa `^5` | `"overrides": { "basic-ftp": "^6.2.3" }`. O FTP nunca é usado pelo `sign-plugin`. |
| **`braces` ≤ 3.0.3 (CVE-2026-93687)** | `micromatch` ← `eslint-webpack-plugin` (webpack de `.config/`) e `jest` 29 | **Sem correção**: não existe versão corrigida. O próprio modelo do `create-plugin` traz essas dependências. É só de dev e não entra no zip. Explicado ao revisor. Quando sair o `braces` 3.0.4+, rodar `npm audit fix` e remover esta linha. |

### 4. Tag e release pelo GitHub Actions

A versão do `package.json` e a tag precisam coincidir (`1.4.0` ↔ `v1.4.0`).

```bash
# WSL
wsl.exe -d Ubuntu -- bash -c "cd ~/TopoFlow/jlcp-topoflow-panel && git checkout master && git tag -a v1.4.0 -m 'v1.4.0'"
# Windows
git -c safe.directory=* push origin v1.4.0
```

O `release.yml` (`grafana/plugin-actions/build-plugin`) compila, roda o
validador e cria uma **draft release** com:

- `jlcp-topoflow-panel-1.4.0.zip`
- `jlcp-topoflow-panel-1.4.0.zip.sha1`

Abra **Actions** → *Release* e confira o passo *Validate plugin*. Depois vá em
**Releases**, edite o draft (cole a seção da versão do `CHANGELOG.md`) e clique
em **Publish release**. Enquanto a release for draft, os links de download dão
404 para a Grafana.

> **Use o zip da release, não o de `releases/` local.** Cada build gera um zip com
> SHA-1 diferente. O SHA-1 informado tem que ser o do arquivo que está na URL.

### 5. Formulário de submissão

grafana.com → menu da esquerda → *Org Settings* → **My Plugins** → **Submit
New Plugin**. No caso de uma atualização, o botão é **Submit Update**, ao lado do plugin.

| Campo | Valor |
| --- | --- |
| OS & Architecture | **Single** (plugin só frontend, sem binário) |
| URL | `https://github.com/MathewsJLCP/jlcp-topoflow-panel/releases/download/v1.4.0/jlcp-topoflow-panel-1.4.0.zip` |
| Source code URL | `https://github.com/MathewsJLCP/jlcp-topoflow-panel/tree/v1.4.0` (sempre a **tag**, não a branch) |
| SHA1 | conteúdo do `.zip.sha1` da release (só o hash de 40 caracteres) |
| Testing guidance | texto abaixo |
| Provisioning provided | **marcar** |
| Demais perguntas | definem Community × Commercial; ver acima |

#### Testing guidance (colar no formulário)

```text
TopoFlow is a frontend-only panel plugin (no backend, no data source of its own).

Quick start with the provisioned environment:
  git clone https://github.com/MathewsJLCP/jlcp-topoflow-panel && cd jlcp-topoflow-panel
  git checkout v1.4.0
  npm ci && npm run build
  docker compose up --build
  open http://localhost:3000  (anonymous admin enabled)

Provisioned dashboards (TestData data source is provisioned too):
  - "Provisioned TopoFlow dashboard": a sample topology bound to TestData metrics.
  - "TopoFlow — mockup v1.4": a denser network map with nodes, links,
    groups, text and images.

What to try:
  1. Open a dashboard: nodes and links are colored by the TestData metrics;
     hover a node to see its metric chart.
  2. Edit the panel: right-click the canvas to add nodes, links, groups, text and
     images; drag, resize and connect elements; select several to bulk-edit.
  3. In the options pane, bind an element to a metric field and set thresholds;
     the map recolors live.
  4. Save, reload: the whole map is stored in the panel JSON.

Zabbix trigger binding is optional and needs the Zabbix data source
(alexanderzobnin-zabbix-app); everything else works with TestData only.
More example dashboards: examples/ in the repository.
Requires Grafana >= 12.3.0.

Note on the plugin validator: osv-scanner reports braces <= 3.0.3
(CVE-2026-93687). It has no patched release yet; it is a dev-only dependency
pulled by micromatch from eslint-webpack-plugin and jest 29, both part of the
create-plugin scaffold (.config). It is not part of the plugin bundle.
```

> Antes de colar, confira se os nomes dos dashboards provisionados ainda batem
> com `provisioning/dashboards/*.json`.

### 6. Depois de enviar

1. A Grafana roda a validação automática. Se falhar, a submissão volta com o motivo.
2. A submissão entra na fila. A revisão manual cobre o código e um teste num
   Grafana deles, que podem pedir ajuda para montar o ambiente.
3. As mensagens chegam por e-mail e na própria página **My Plugins**. Responda
   por lá.
4. Aprovado, o plugin vai para o catálogo **já assinado pela Grafana**. A página
   do catálogo mostra o `src/README.md`. Para mudar a página, só enviando uma
   versão nova.

## Atualizações futuras (v1.5+)

1. Suba a versão em `package.json`, escreva a entrada no `CHANGELOG.md` e faça o
   merge em `master`.
2. Dispare a release com tag `vX.Y.Z` (passo 4).
3. **A partir da segunda submissão, o zip precisa vir assinado.** Só a primeira
   submissão é isenta. Configure uma vez:
   - grafana.com → org `jlcp` → **Access Policies** → criar token com realm
     `jlcp` (all-stacks) e escopo **`plugins:write`**.
   - GitHub → *Settings* → *Secrets and variables* → *Actions* → novo secret
     `GRAFANA_ACCESS_POLICY_TOKEN`.
   - No `.github/workflows/release.yml`, descomentar
     `policy_token: ${{ secrets.GRAFANA_ACCESS_POLICY_TOKEN }}`.
4. Em **My Plugins**, clique em **Submit Update** e preencha com a URL, a tag e o
   SHA-1 da release nova.

## Armadilhas

- **SHA-1 de outro zip.** Rebuild local ≠ zip da release. Copie o hash do
  `.zip.sha1` publicado.
- **Release ainda em draft.** O link do zip dá 404 para o validador da Grafana.
- **Source code URL na branch.** Use a tag. A branch anda, e o revisor vê código
  que não é o do zip.
- **Editar `dist/`.** `dist/plugin.json` e `dist/LICENSE` são gerados pelo build.
  A fonte é `src/plugin.json` e o `LICENSE` da raiz.
- **Mudar o `plugin.json`** pede reinício do Grafana para valer no ambiente local.
- **README de catálogo com jargão de dev** (`npm`, `yarn`...). O validador avisa.
  Instruções de desenvolvimento ficam no `README.md` da raiz, não no `src/README.md`.

## Diário de submissões

Uma entrada por evento, a mais recente embaixo. Registre data, o que foi feito e
a resposta da Grafana, inclusive pedidos de ajuste do revisor e como foram
resolvidos.

### v1.4.0 — primeira submissão

| Data | Evento | Resultado / observação |
| --- | --- | --- |
| 2026-10-10 | v1.4.0 fechada em `master` (`4efcea8`) | plugin-validator: 0 erros |
| 2026-10-10 | Checagem de pré-requisitos | Repo **privado** (GitHub 404 sem login); org **`jlcp` não existe** no grafana.com (`Org not found`); sem segredos no repo nem no histórico; provisioning OK |
| 2026-10-10 | Repositório tornado público | GitHub 200, issues habilitadas |
| 2026-10-10 | `src/plugin.json`: autor corrigido (`Matheus Domingos - Jlcp`) e com URL do LinkedIn; `links` com Issues e LinkedIn | validador: aviso "999" do LinkedIn (anti-robô), ignorável |
| 2026-10-10 | Validador passou a reprovar por CVEs novos no lockfile | `npm audit fix` + override do `basic-ftp`; resta só `braces` (sem correção, ver acima). typecheck, 893 testes e build OK |
| | Org `jlcp` criada no grafana.com | |
| | Tag `v1.4.0` publicada; release publicada | SHA-1: |
| | Submissão enviada em My Plugins | |
| | Resposta da revisão | |
