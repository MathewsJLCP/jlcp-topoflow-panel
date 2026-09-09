# 06 — Testes

## Panorama

| Camada | Ferramenta | O que cobre | Onde |
| --- | --- | --- | --- |
| Unidade / componente | Jest + Testing Library (jsdom) | modelo, resolução de estado, formulários, componentes de nó | `src/**/*.test.ts(x)` |
| Integração no Grafana real | Playwright + `@grafana/plugin-e2e` | listagem do plugin, opções, seleção, arraste, menu de contexto, cor de estado | `tests/` |

Estado na v1.0: **38 suítes, 729 testes** de unidade, todos verdes.

```bash
npm run test:ci      # roda tudo uma vez
npm run test         # watch, só o que mudou
npm run typecheck    # tsc --noEmit
npm run lint         # eslint com cache
```

## O que o jsdom **não** cobre

Esta é a informação mais útil deste documento. O jsdom não faz hit-testing e não
tem layout de verdade, então **nada** que dependa de posição, arraste ou
sobreposição pode ser testado ali:

- seleção por clique e por área;
- arrastar elemento;
- menu de contexto;
- qualquer coisa que dependa de `editable` chegar ao `<ReactFlow>`.

Um bug de `editable` atravessou 5 commits exatamente por isso. A regra que ficou:
**validar no browser antes de entregar** qualquer mudança que toque interação.

Outras duas falhas que só apareceram no browser real: o campo de tempo do Zabbix
(o datasource entrega `timestamp`, não `lastchange`) e o `Esc`, que o Grafana
consome antes de chegar a um listener de bubbling.

## Stubs de ambiente (`jest-setup.js`)

Três coisas do `@grafana/ui` e do uPlot não existem no jsdom. Nenhuma tem a ver
com o código em teste — são falhas de ambiente:

**1. `HTMLCanvasElement.getContext`.** O jsdom define o método, mas ele devolve
`null` sem o pacote `canvas`. O `Combobox` mede texto para se auto-dimensionar e
quebra nesse `null`. A substituição é **incondicional**: um guard por existência
não pega o caso, já que a função existe.

O contexto é um `Proxy`, e não um objeto com dois métodos, porque o uPlot (o
gráfico do `MetricChart`) chama dezenas deles — `clearRect`, `beginPath`,
`stroke`, `save`… — e enumerá-los seria uma lista para manter em dia a cada
versão do Grafana. Propriedade escrita volta como foi escrita; qualquer outra
vira função vazia.

**2. `IntersectionObserver`.** O `ScrollContainer` (onde vive o menu aberto do
`Combobox`) usa a API para decidir quando mostrar sombras de rolagem.

**3. Imports de imagem.** O webpack os trata como `asset/resource`; o jest
tentaria parsear o PNG como JavaScript. O transformer (`jest-file-transform.js`)
devolve o **nome do arquivo** — e não um stub genérico — porque é o nome que os
testes precisam distinguir: um pack de variantes escolhe entre
`router-gray-96.png` e `router-red-96.png`, e com um stub único os dois casos
passariam idênticos, inclusive o errado.

Registrado estendendo o transform da base, sem tocar em `.config/`:

```js
const base = require('./.config/jest.config');
module.exports = {
  ...base,
  transform: { ...base.transform, '^.+\\.(png|jpe?g|gif|webp)$': require.resolve('./jest-file-transform.js') },
};
```

## O fixture

`src/model/sampleTopology.ts` é a topologia de exemplo — três nós, duas arestas,
um postit, um texto. Ela **era** o default do painel e virou fixture na v1.0 (ver
[doc 02](02-modelo-e-persistencia.md)).

Vale a pena mantê-la assim: os testes de modelo, editor e canvas precisam de uma
topologia com um exemplar de cada tipo e com arestas de verdade entre nós de
verdade, e reescrever isso em cada arquivo produziria variações que divergem.

Cuidado ao editá-la: um teste que conta elementos (`toHaveLength(3)`) depende
dela.

Nenhum módulo de produção a importa, então ela não entra no bundle.

## O que os testes de unidade cobrem bem

- **Modelo** (`parse`, `mutations`, `schema`): retrocompatibilidade campo a
  campo. Cada `.default()` e cada `.optional()` do schema tem um teste que carrega
  um objeto **sem** aquele campo e verifica que nada quebra. É o que sustenta a
  disciplina de "sem migrador".
- **Resolução de estado** (`elementColor`, `thresholds`, `triggerState`,
  `problems`): a cadeia inteira, incluindo os estados de ausência.
- **Contraste** (`stateFill.test.ts`): prova que toda a paleta alcançável passa
  de 4.5:1 nos dois temas. Este teste vale por uma revisão manual de design.
- **Formulários**: que só o campo mexido é escrito (a regra da edição em massa),
  e que alternar modos não descarta configuração.

## E2E com `@grafana/plugin-e2e`

```bash
npm run server    # sobe o Grafana com o plugin montado (docker compose)
npm run e2e       # roda os specs de tests/
```

O `docker-compose` monta `dist/` como plugin e `provisioning/` como provisioning,
com `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` já configurado. Rode `npm run dev`
em paralelo para ter watch.

Três specs:

| Arquivo | Cobre |
| --- | --- |
| `panel.spec.ts` | o plugin aparece no viz picker; `.useFieldConfig()` expõe Thresholds e Value mappings; a cor de estado chega ao card |
| `canvas-interaction.spec.ts` | seleção, arraste e menu de contexto — as três coisas que fazem o canvas ser um editor |
| `probe.spec.ts` | sonda de ambiente |

Armadilhas específicas (detalhe no [doc 05](05-armadilhas-grafana.md)):

- `waitUntil: 'domcontentloaded'` é obrigatório — o default `'load'` não resolve;
- `getVisualizationName()` não existe no Grafana 13.1.0; use `setVisualization('TopoFlow')`;
- ancore em `.topo-card`, não em `> div`: a cor de estado pousa no fundo do card,
  e o wrapper de hover tem borda neutra em todos os nós;
- dê espaço ao canvas — no viewport padrão ele fica estreito demais para arrastar.

### O dashboard provisionado é um contrato

`provisioning/dashboards/dashboard.json` não é um exemplo qualquer: ele **fixa a
cadeia de cor** no e2e.

| Elemento | Configuração | O que prova |
| --- | --- | --- |
| `srv-app-01` | regra própria, sem rótulo | a regra do elemento pinta — e sem rótulo, porque rotular troca o valor pelo rótulo no badge |
| `srv-db-01` | field vinculado, **nenhuma** regra | fica roxo (a Base): prova que o pipeline nativo não pinta mais |
| `trigger-01` | regra própria verde + value mapping nativo | a cor vem da regra, o texto "UP" vem do value mapping |

Ao mexer nele, mexa sabendo disso.

### Rodar o Playwright nesta máquina (WSL sem sudo)

O Chromium não sobe: faltam libs do sistema. O contorno está no
[doc 05](05-armadilhas-grafana.md#chromium-do-playwright-não-sobe-sem-libs-do-sistema-wslubuntu-sem-sudo)
— baixar os `.deb` sem root, extrair e exportar `LD_LIBRARY_PATH`. Monte o
diretório uma vez por sessão.

## Ao adicionar uma feature, escreva estes testes

1. **Um teste de carga sem o campo novo** (o objeto salvo antigo). É o que prova
   que não há migrador necessário.
2. **Um teste do estado de ausência** — o que acontece quando o field não existe,
   ou existe sem valor. São dois casos diferentes com resultados diferentes.
3. **Se mexeu em cor**: um teste de contraste ou um caso novo em
   `stateFill.test.ts`.
4. **Se mexeu em interação**: um spec de Playwright. O jsdom não vai te avisar.
