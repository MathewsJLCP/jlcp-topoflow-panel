# 01 — Visão geral

## O que é

**TopoFlow** (`jlcp-topoflow-panel`) é um plugin de **painel** do Grafana que
desenha mapas de topologia editáveis dentro do dashboard: nós de equipamento,
conexões, âncoras de roteamento, retângulos de agrupamento, textos e imagens.
Cada elemento pode se vincular a um dado do painel — uma **métrica** ou uma
**trigger do Zabbix** — e mudar de cor, animar e listar o que está alarmando.

O caso de uso que moldou o produto é o **telão de NOC**: uma tela que ninguém
toca, aberta o dia inteiro, onde a informação tem que estar visível sem hover e
sem clique. Quase toda decisão de UI documentada aqui se explica por isso.

### O que ele não é

- **Não é um cliente do Zabbix — para os dados.** O que pinta o elemento entra
  pelo Query Editor nativo do painel (datasource `grafana-zabbix`, Query Mode
  *Problems*), e o plugin só lê o `DataFrame` resultante.

  O **editor**, esse sim, consulta o Zabbix: com um datasource Zabbix escolhido
  nas opções do painel, os combos de host e trigger sugerem o catálogo inteiro em
  vez de apenas o que a query já trouxe. A conversa é pelo resource endpoint do
  próprio datasource (`data/zabbixApi.ts`), sem credencial nenhuma do lado do
  plugin — ver [o PRD da rodada](prd-zabbix-direto.md).
- **Não tem backend.** É um plugin frontend puro: sem Go, sem mage, sem
  `backend: true` no `plugin.json`. Tudo o que o usuário configura vive em
  `panel.options`, dentro do JSON do dashboard.
- **Não é o Canvas nativo.** Diverge dele deliberadamente na cadeia de cor —
  ver [03 — Estado e cor](03-estado-e-cor.md).

## Stack

| Peça | Escolha | Nota |
| --- | --- | --- |
| Grafana | `>=12.3.0` (desenvolvido em 13.1.0) | `grafanaDependency` em `src/plugin.json` |
| SDK | `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/schema` 13.1.0 | externals do webpack: não entram no bundle |
| Canvas | `@xyflow/react` (React Flow) 12.x | nós, arestas, viewport, hit-testing |
| Validação | `zod` 4.x | fonte da verdade do modelo |
| Gráfico | `TimeSeries` do `@grafana/ui` | o hover reusa o pipeline nativo |
| Screenshot | `html-to-image` | serializa o DOM em `<foreignObject>` |
| Estilo | `@emotion/css` + `useStyles2` | zero cor literal, só tokens do tema |
| Build | webpack via `.config/` do `@grafana/create-plugin` | **não modificar `.config/`** |
| Testes | Jest + Testing Library, Playwright + `@grafana/plugin-e2e` | |

## Arquitetura em uma frase

`panel.options` (JSON do dashboard) → **Zod** → `Topology` → **React Flow**;
e `data.series` (DataFrames das queries) → **resolução de estado** → cor,
texto e animação de cada elemento.

```
                       ┌───────────────────────────────────┐
  Query Editor  ──────▶│ data.series : DataFrame[]         │
  (métricas +          │  (já com applyFieldOverrides,     │
   Problems do Zabbix) │   por causa de .useFieldConfig()) │
                       └────────────────┬──────────────────┘
                                        │
  Panel JSON ──▶ parseTopoFlowOptions ──┼──▶ resolveElementColor ──▶ ElementColor
  (panel.options)   (Zod + fallback)    │      ├─ resolveTriggerState (Zabbix)
        │                               │      ├─ resolveOwnThreshold (regras)
        ▼                               │      └─ color.fixed / neutro
    Topology ──────▶ useFlowElements ───┴──▶ <ReactFlow> ──▶ nós e arestas
        ▲                                          │
        └──────────── onChange (debounce 80ms) ◀───┘
```

Os dois eixos se cruzam só no componente de cada elemento: o modelo diz **o que
desenhar e onde**, a resolução de estado diz **de que cor**.

## Mapa dos diretórios

```
src/
├── module.ts            Ponto de entrada: PanelPlugin, .useFieldConfig(), opções
├── plugin.json          Metadados. Mexer aqui exige reiniciar o Grafana
├── panel/
│   ├── TopoFlowPanel.tsx   O componente de painel. Decide `editable` e trava a escrita
│   ├── options.ts          Aba de opções (Layer + Canvas)
│   └── instanceState.ts    Canal de seleção canvas ↔ painel de Layers
├── model/                Camada de dados pura (sem React)
│   ├── schema.ts           Zod: A FONTE DA VERDADE do formato salvo
│   ├── types.ts            Tipos derivados por z.infer — nunca escritos à mão
│   ├── parse.ts            Leitura de panel.options com fallback por seção
│   ├── mutations.ts        Operações puras sobre Topology (add, move, connect…)
│   ├── defaults.ts         O default de um painel novo: topologia VAZIA
│   ├── sampleTopology.ts   Exemplo com todos os tipos — fixture de teste
│   └── sizes.ts            Geometria canônica (lida pelo canvas e pelas mutações)
├── data/                 Resolução de estado (sem React)
│   ├── dimensions.ts       Fixo vs field, templates ${field}, formatação
│   ├── elementColor.ts     A CADEIA DE COR — helper único, ver doc 03
│   ├── thresholds.ts       Regras próprias do elemento (métrica e severidade)
│   ├── triggerState.ts     Estado a partir de um vínculo de trigger
│   └── problems.ts         Leitura do frame de Problems do grafana-zabbix
├── canvas/               Tudo o que desenha
│   ├── TopologyCanvas.tsx  O ReactFlow, seleção, arraste, menu, commit debounced
│   ├── nodes/ edges/       Um componente por tipo de elemento
│   ├── ElementHover.tsx    Painel de hover: lista de triggers OU gráfico
│   ├── ActiveTriggers.tsx  Lista de alarmes fixa embaixo do elemento
│   ├── MetricChart.tsx     TimeSeries nativo dentro do hover
│   ├── ScreenshotButton.tsx / screenshot.ts   PNG da topologia
│   ├── DrilldownSurface.tsx / drilldown.ts    Clique que navega
│   ├── alertAnimation.ts   Pulsar, piscar, radar (só transform/opacity)
│   ├── stateFill.ts        Fundo de estado + cor de texto com contraste AA
│   └── iconTone.ts         Cor resolvida → variante do ícone, por matiz
├── editors/              Formulários do painel de opções
│   ├── ElementsEditor.tsx  O "Layer": lista de elementos + acordeão
│   ├── ElementForms.tsx    Um formulário por tipo
│   ├── StateSection.tsx    Bloco de Estado (fonte, campo, regras) — compartilhado
│   ├── ThresholdsEditor.tsx  Regras: threshold, valor, faixa, regex, especial, severidade
│   ├── BulkForms.tsx       Edição em massa da seleção
│   └── IconPicker.tsx      Navegador de ícones com pastas
└── icons/                Biblioteca de ícones
    ├── registry.ts         Catálogo, chave `pack/nome`, fallback
    └── packs/              classic (glifos), topoflow (variantes), petrolifera (fotos)
```

Fora de `src/`:

| Caminho | Papel |
| --- | --- |
| `.config/` | Build, jest e docker do `@grafana/create-plugin`. **Não modificar** |
| `provisioning/` | Dashboard e datasource provisionados no Grafana de desenvolvimento |
| `tests/` | Testes e2e (Playwright) |
| `docs/` | Esta documentação |
| `temp/` | Material bruto do cliente (ícones antes de entrarem nos packs) |
| `dist/` | Saída do build. É o que vira o pacote instalável |

## Os seis tipos de elemento

| Tipo | Conecta? | Tem estado? | Redimensiona? | Papel |
| --- | --- | --- | --- | --- |
| **Nó** | sim | sim | largura/altura mínima | Equipamento: ícone, nome, IP, métrica |
| **Point** | sim | sim | não (14px fixo) | Âncora de roteamento de um caminho |
| **Conexão** | — | sim | espessura | Enlace entre dois elementos conectáveis |
| **Imagem** | sim | só com fundo em modo Estado | sim | Logo, foto de ativo, ícone da biblioteca |
| **Postit** | não | não | sim | Retângulo de agrupamento, sempre atrás |
| **Texto** | não | não | não (deriva do `fontSize`) | Rótulo solto, decorativo |

O contrato visual de cada um está em
[estilo-elementos-canvas.md](estilo-elementos-canvas.md).

## Funcionalidades da v1.0

**Edição**
- Criar por menu de contexto no canvas ou pelo botão no painel de Layers
- Arrastar, redimensionar, duplicar, deletar, reordenar (frente/trás)
- Conectar por handle ou pelo modo "Linkar" do menu de contexto; inverter aresta
- Seleção múltipla (Ctrl+clique, seleção por área) com **edição em massa**
- Snap ao grid configurável; grid ligável
- Seleção sincronizada entre canvas e painel de Layers
- Edição inline opcional direto no dashboard (fora do editor de painel)

**Vínculo com dados**
- Modo **Métrica**: campo escolhido por display name, com regras próprias
- Modo **Trigger**: host + trigger do Zabbix lidos de uma query de Problems
- Templates `${nome do field}` em textos, rótulos de conexão e legendas
- Regras de estado num bloco só: threshold, valor exato, faixa, regex,
  especiais (null/NaN/true/false/vazio) e severidade de trigger
- Animação de alerta por regra: pulsar, piscar (suave) e radar

**Leitura**
- Lista de triggers em PROBLEM fixa junto ao elemento, com posição escolhível
- Painel de hover: tabela de incidentes (modo Trigger) ou gráfico da métrica
  (modo Métrica), na janela de tempo do dashboard
- Drill-down: o elemento vira um `<a>` de verdade, com variáveis interpoladas
  no instante do clique
- Screenshot da topologia em PNG

**Robustez**
- Topologia corrompida **não é sobrescrita**: o painel avisa e tranca a edição
- Aresta pendurada e id duplicado são descartados, não derrubam a topologia
- Todo campo novo entrou sem migrador (ver [doc 02](02-modelo-e-persistencia.md))
