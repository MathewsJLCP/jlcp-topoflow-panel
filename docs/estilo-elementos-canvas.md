# Estilo dos Elementos do Canvas — TopoFlow (v1.4)

Desde a v1.4 o desenho do painel **é o do mockup** feito no Claude Design
(`TopoFlow v2 Figma.dc.html`, guardado fora do repositório em
`temp/topoflow_new_design/`). Este documento registra os valores que o código usa,
para que uma mudança futura seja uma decisão — e não uma divergência acidental.

Em caso de dúvida sobre um valor, o mockup manda; este documento e o código
devem segui-lo.

## 1. Tokens

**Cor literal só existe em `src/theme/palette.ts`.** A regra antiga ("zero cor
literal, só `theme.colors.*`") virou "cor literal só na paleta": os tokens do
Grafana não chegam nos valores do mockup. O que continua vindo do Grafana é
**qual** paleta vale — `theme.isDark` escolhe entre `TF_DARK` e `TF_LIGHT`.

| Token | Uso | Escuro | Claro |
| --- | --- | --- | --- |
| `fundo` | o mais fundo (anel do círculo de status, etiqueta do postit) | `#0A0A0F` | `#F6F7FB` |
| `sup` | superfície: canvas, cartões, popovers | `#14141C` | `#FFFFFF` |
| `elev` | campos, controles | `#1A1A22` | `#EEF0F8` |
| `borda` / `linha` | contorno / divisória | `#2C2C36` / `#3D3D48` | `#DCDFEE` / `#E4E6F1` |
| `tf` `tx` `tx2` `rot` `apa` | texto, do título ao apagado | `#EDEDF2` … `#6F6F7B` | `#25255A` … `#7B7DA8` |
| `ok` `at` `la` `cr` `in` | verde, âmbar, laranja, vermelho, azul | `#22C55E` `#F59E0B` `#F97316` `#EF4444` `#3B82F6` | `#00B929` `#F2A000` `#F26A12` `#FF2D2E` `#023AFF` |
| `ac` | acento violeta: seleção, foco, botão primário | `#8B7CF6` | `#6E3AD8` |

O sufixo `-t` é a versão para texto; `on-*` é o texto sobre a cor cheia.

- **Cores nomeadas salvas** (`red`, `orange`, `yellow`, `blue`, `green`,
  `purple`, `gray` e os `dark-*`) resolvem para os tokens em `resolveTfColor`; as
  demais seguem no `getColorByName` do Grafana. Toda resolução de cor passa por
  ali.
- **Severidade → token** (`theme/severity.ts`): Disaster e High `cr`, Average
  `la`, Warning `at`, Information `in`, Not classified `apa`. Siglas da pílula:
  `DIS`, `HIGH`, `AVG`, `WARN`, `INFO`, `N/C`.
- `color-mix` em **oklab** (`tfMix`), como o mockup.

**Fontes:** IBM Plex Sans (400–700) e Mono (400–600), **embutidas** via
`@fontsource` (`theme/fonts.ts`) — subconjuntos `latin` + `latin-ext`, só woff2.
NOC sem internet não carregaria Google Fonts.

**Animações** (`theme/motion.ts`, todas sob `prefers-reduced-motion`):

| Nome | Efeito | Tempo |
| --- | --- | --- |
| Pulsar (`pulse`) | `scale(1)` → `1.05` | 1.4s ease-in-out |
| Piscar (`blink`) | opacidade 1 → 0.4 | 2.6s ease-in-out |
| Radar | anel com a forma do elemento, `scale(1.35, 1.7)`, 0.75 → 0 | 2s ease-out |
| Radar do point | anel circular, `scale(3.2)` | 2s ease-out |

Na conexão, Pulsar e Piscar viram respiração do traço (1.1s / 2.6s).

## 2. Como cada estado pousa (`canvas/look.ts`)

Um helper só para todos os elementos. Estados da cadeia → mockup: `trigger` e
`threshold` → alarme, `fixed` → Base, `nodata`, `neutral`.

| Estado | Borda do nó | Fundo do nó | Círculo de status |
| --- | --- | --- | --- |
| Neutro | 1px `rot` a 55% | `sup` | vazio, `sup`, borda 1.5px `linha` |
| Sem dados | 1.5px tracejada `apa` | hachurado 135° `sup`/`elev` (7px) | `–` em `tx2`, borda tracejada |
| Base | 1.5px na cor | `sup` | `✓` sobre a cor |
| Alarme | 1.5px na cor | 12% da cor sobre `sup` | `!` sobre a cor |
| Disaster | **2.5px** na cor | **30%** da cor | `!!` |

O círculo tem 20px, borda de 2px `fundo` e glifo 800 10.5px. No formato
**Contador** ele mostra o número de problemas.

## 3. Nó

- Cartão de cantos **16px**, padding `16px 14px 14px`, coluna com `gap: 10`,
  sombra `0 4px 14px shadow`. Tamanho padrão 184×64; a altura é mínima.
- Círculo de status em `left: 24, top: 0`, centrado na quina.
- Cabeça: ícone (caixa 30×30, desenho SVG de 34px), nome **600 14px/1.3 `tf`**, secundário 12px
  `tx2`. No dashboard, com drill-down, um `↗` em `rot`.
- **Bloco de valores** (`canvas/nodeStats.ts`), depois de uma divisória de 1px
  `rot` a 22%:
  - uma métrica: rótulo 500 12px `tx`, número **700 22px** na cor da regra que
    casou (ou `tf`), unidade 600 11.5px `tx2`, barra de 6px;
  - várias: uma linha por métrica, número 700 15px, barra de 5px;
  - a barra existe quando há onde ancorá-la: unidade `%` (0–100) ou regras de
    threshold (marcas de 2px onde cada uma começa). Trilho `ac` a 16% sobre
    `elev`; preenchimento em gradiente da cor (45% → 100%);
  - o rótulo é o item, sem o host (`HOST: item` → `item`).
- Seleção: `outline` 2px `ac`, offset 4px. Linkagem: alvo válido tracejado
  (sólido no hover), inválido a 32% de opacidade.
- Alças: círculos de 10px, `sup` com borda 2px `ac`, nas quatro bordas, no hover
  em modo de edição.

## 4. Problemas junto ao elemento (`canvas/Problems.tsx`)

| Formato | Onde | Desenho |
| --- | --- | --- |
| Dentro do nó | no cartão | divisória + até 3 linhas: barra de cor 3×14, sigla mono 9.5px, nome 12px `tf`, idade 10.5px mono |
| Faixa | no cartão | barra segmentada de 5px, um segmento por problema, + contagem e o pior |
| Contador | no cartão | número no círculo de status + pílula e o pior problema, "+N no hover" |
| Total | no cartão (nó) / pendurado | pílula do pior + "N incidentes ativos" |
| Lista | pendurado | cartão de 236px, borda 1.5px na cor, conector de 2×10px, até 3 linhas com pílula, nome e idade |

Imagem e point só têm Lista e Total. O cartão pendurado fica a 8px (acima/abaixo)
ou 10px (lados) do elemento; o do point não tem conector.

## 5. Imagem

- Caixa de cantos 12px; o desenho da biblioteca ocupa **84%**, em `contain`. Arquivo/URL segue o Ajuste escolhido. Sem figura:
  "Sem imagem" num quadro tracejado.
- O estado **sempre** vale: pinta o ícone e o círculo de status.
- Fundo opcional (`background.mode: 'state'`): borda 2px na cor do estado e
  fundo na cor, na opacidade escolhida (sem estado: `rot` a 60% dela; sem dados:
  hachurado). O fundo sólido de antes da v1.4 continua valendo.
- Sem fundo, o círculo de status pousa no canto da **silhueta** do desenho
  (`icons/iconMask.ts`), e a conexão para a 4px da tinta.
- Legenda 500 no tamanho escolhido, `tx`, 6px abaixo, centralizada.

## 6. Point

Contêiner de 16px. Ponto de 14px — 16px em alarme, **20px** em Disaster. Neutro:
`sup` com borda 2px `rot`; sem dados: `elev`, borda tracejada `apa`; Base: cheio;
alarme: cheio com anel de 3px da cor a 40%. Alça única acima, a 12px.

## 7. Postit

Cantos 14px, fundo na cor a `opacity`, borda na espessura/estilo escolhidos e na
cor cheia. Título numa etiqueta (`fundo`, borda `borda`, cantos 6px, 600 12px
`tx`, quadradinho de 8px da cor) **assentada sobre a borda**, no canto escolhido,
a 12px da lateral. Selecionado: outline 2px `ac` offset 3 e quatro alças de canto
(12×12, `ac`, borda 2px `fundo`).

## 8. Texto

500 no tamanho escolhido, line-height 1.35, `white-space: pre`. Com fundo:
padding `4px 8px`, cantos 6px, cor a `opacity`. Com drill-down: sublinhado.

## 9. Conexões (`canvas/edges/path.ts`, `TopoEdge.tsx`)

- A linha sai do **centro** de cada elemento e é recortada na borda, 1.5px para
  fora (point: círculo de 9px; imagem sem fundo: silhueta).
- **Curva**: quadrática com controle a 20% do comprimento, à esquerda do sentido.
- **Paralelas** entre o mesmo par se afastam 20px (sobre a normal do sentido
  canônico, id menor → maior); o rótulo de cada uma vai para fora do par.
- **Vértices**: polilinha; seta no fim e uma no meio de cada segmento (a 80% no
  mais longo, onde fica o rótulo).
- Seta: `M-1.7z,-0.75z L0,0 L-1.7z,0.75z Z`, com `z = max(5, 2.2 × espessura)`,
  na cor do traço, contorno 1px `fundo`.
- Traço: cor do estado; `rot` em repouso sem Base; `apa` sem dados. Tracejado
  `4w 2.5w`; pontilhado `0.01 2.4w` com ponta redonda.
- Animações de fluxo: Dash-flow (`max(8,4w) max(6,3w)`, 1.4s), Flow (três
  bolinhas de `max(2.5, 0.85w)`, 2.4s, defasadas 0.8s), Pulse (respiração 3s).
  Em alerta, a animação da regra substitui a de fluxo.
- Rótulo: 500 11px/1.35 mono, `tx` sobre `sup`, borda `borda` (`ac`
  selecionada), cantos 5px, padding `3px 7px`.
- Selecionada: traço `ac` a 40% com 8px a mais por baixo. No editor, `+` a 30% de
  cada segmento com mais de 44px na tela e os vértices em quadrados de 10px.

## 10. Canvas

- Fundo `sup`, grade de pontos `grid` (1.6px) no espaçamento configurado.
- Controles: coluna de quadrados 32×32 colados (1px), cantos 2px, `elev`
  (`linha` no hover), a 22px do canto inferior esquerdo — aproximar, afastar,
  enquadrar tudo, baixar a imagem.
- Menu de contexto: cartão `sup` cantos 9px, título mono 10.5px `apa` (o id ou
  "canvas"), itens 13px sem ícone, "Excluir" em `cr-t`.
- Popover de hover: dentro do canvas, à direita do elemento (à esquerda perto da
  borda), cartão `sup` cantos 10px. Incidentes (300px): título + contagem,
  linhas com pílula da severidade, nome e idade; "Fixado · Esc ou clique fora
  para soltar". Gráfico (470px): área com gradiente `ac` 28% → 0, linha 1.6px,
  thresholds tracejados `4 3` com "≥ valor", legenda Name / Last * / Max / Mean.
- Aviso no topo: cartão com borda `at` a 60% e a pílula "AVISO".
- Dica do Linkar: chip centralizado no topo, borda `ac`.
- Seleção por área: borda `ac`, fundo `ac` a 10%.

## 11. Editor (categoria Layer)

Componentes próprios em `src/editors/ui/`: `Segmented` (trilho `elev`,
escolhido cheio em `ac`), `TfSwitch` (30×18), `SectionHead` (mono 10px
maiúsculo com linha), `Note`, `DashedButton`, `TfSelect`, `TfRange`,
`TfColorRow`. Os campos do Grafana que ficaram (inputs, `Combobox`) vestem a
paleta pela pele `ui/skin.ts`, com escopo na raiz do editor.

Estrutura: "+ Adicionar elemento" (Nó, Postit, Texto, Imagem) → cartão do
elemento aberto (borda `ac`, cabeçalho com glifo, nome, tipo + id, Duplicar,
Excluir, ×) → lista "Elementos" agrupada por tipo, com a bolinha da cor do estado.
