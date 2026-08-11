# Estilo dos Elementos do Canvas — TopoFlow

Briefing para reproduzir o visual dos elementos de topologia em outro projeto.
Stack de origem: React + `@xyflow/react` (React Flow v12) + `@emotion/css` + `lucide-react`.

**Identidade visual: tema dark nativo do Grafana.** Nada de paleta própria — todo componente lê
cor de `theme.colors.*` (via `useStyles2`), o que dá dark/light de graça. A tabela abaixo traz os
valores já resolvidos, caso o projeto destino não tenha o tema do Grafana.

---

## 1. Tokens

| Papel | Token | Valor (dark) |
|---|---|---|
| Fundo do canvas | `background.canvas` | `#111217` |
| Fundo do card (nó) | `background.secondary` | `#22252b` |
| Fundo da cápsula de ícone | `background.primary` | `#181b1f` |
| Borda em repouso | `border.weak` | `rgba(204,204,220,0.12)` |
| Borda em hover | `border.medium` | `rgba(204,204,220,0.20)` |
| **Acento / seleção** | `primary.main` | `#3d71d9` |
| Texto primário | `text.primary` | `rgb(204,204,220)` |
| Texto secundário | `text.secondary` | `rgba(204,204,220,0.65)` |
| Texto desabilitado | `text.disabled` | `rgba(204,204,220,0.61)` |
| Sombra repouso | `shadows.z1` | `0 1px 2px rgba(1,4,9,0.75)` |
| Sombra hover | `shadows.z2` | `0 4px 8px rgba(1,4,9,0.75)` |
| Raio padrão | `shape.radius.default` | `6px` |
| Espaçamento | `theme.spacing(n)` | `n × 8px` |
| Fonte | `typography.fontFamily` | `Inter, Helvetica, Arial, sans-serif` |
| Fonte mono | `typography.fontFamilyMonospace` | `Roboto Mono, monospace` |
| Corpo | `typography.body.fontSize` | `14px` |
| Corpo pequeno | `typography.bodySmall.fontSize` | `12px` |
| Peso médio | `typography.fontWeightMedium` | `500` |

```ts
export const transitions = { fast: '150ms ease', normal: '200ms ease', slow: '300ms ease' };
export const dims = { handleSize: 8, handleSizeSmall: 6 };

export const DEVICE_NODE_WIDTH = 180;
export const DEVICE_NODE_HEIGHT = 60;
export const POINT_NODE_SIZE = 14;
export const POSTIT_DEFAULT = { width: 250, height: 170, minWidth: 160, minHeight: 100 };
```

### Regras que valem para todos os elementos

1. **Zero cor literal no componente.** Só token de tema ou a cor resolvida pela cadeia de estado
   (`src/data/elementColor.ts`). Em **qual superfície** essa cor pousa é assunto do §8 — e a
   resposta mudou: hoje ela pinta o elemento inteiro.
2. **Handles invisíveis em repouso** (`opacity: 0`), revelados no `:hover` do elemento.
3. **Transições de 150 ms** em `border-color`, `box-shadow`, `transform`, `opacity`. Nada mais.
4. Geometria vive em `node.position` / `node.width|height`; `data` guarda só apresentação.

---

## 2. Nó (device)

Card horizontal **180×60**: cápsula de ícone à esquerda, bloco de texto à direita.

```
┌────────────────────────────────┐
│ ┌────┐  Core-SW-01             │   título: 14px / 500 / text.primary
│ │ 32²│  10.0.0.1               │   sublinha: 12px mono / text.secondary
│ └────┘                         │
└────────────────────────────────┘
  gap 10px · padding 8px 12px
```

- **Card**: fundo `background.secondary`, borda `1px solid border.weak`, raio `6px`,
  `box-shadow: z1`, `cursor: default`.
- **Hover**: `translateY(-1px)`, borda → `border.medium`, sombra → `z2`.
- **Selecionado**: borda → `primary.main` + `box-shadow: 0 0 0 1px primary.main`.
  O hover **não** sobrescreve a borda de seleção.
- **Cápsula de ícone**: `32×32`, `flex: 0 0 32px`, raio `6px`, fundo `background.primary`,
  ícone `size={20} strokeWidth={1.6}`, cor `text.secondary`. **Com estado**, os dois derivam do
  token de contraste — ver §8.
- **Texto multilinha**: `primaryText.split('\n')` → linha 1 é o título; as demais viram sublinhas
  mono. `white-space: pre-wrap`, `word-break: break-word`.
- **Handles**: 4 (Top target, Right source, Bottom target, Left source), `8×8`, círculo,
  fundo `background.canvas`, borda `1px solid primary.main`.

```tsx
const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    width: DEVICE_NODE_WIDTH,
    minHeight: DEVICE_NODE_HEIGHT,
    '&:hover .react-flow__handle': { opacity: 1 },
  }),
  handle: css({
    width: 8, height: 8,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.primary.main}`,
    borderRadius: '50%',
    opacity: 0,
    transition: `opacity ${transitions.fast}`,
  }),
  card: css({
    position: 'relative',
    width: '100%',
    minHeight: DEVICE_NODE_HEIGHT,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 1.5),
    boxShadow: theme.shadows.z1,
    cursor: 'default',
    transition: `border-color ${transitions.fast}, box-shadow ${transitions.fast}, transform ${transitions.fast}`,
    '&:hover': {
      transform: 'translateY(-1px)',
      borderColor: theme.colors.border.medium,
      boxShadow: theme.shadows.z2,
    },
  }),
  cardSelected: css({
    borderColor: theme.colors.primary.main,
    boxShadow: `0 0 0 1px ${theme.colors.primary.main}`,
    '&:hover': { borderColor: theme.colors.primary.main },
  }),
  iconWrap: css({
    flex: '0 0 32px', height: 32,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    color: theme.colors.text.secondary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  textBlock: css({ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }),
  primary: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.3,
    color: theme.colors.text.primary,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }),
  secondary: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    color: theme.colors.text.secondary,
    lineHeight: 1.3,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }),
});
```

**Ícones**: `lucide-react` mapeados por nome em string (serializável no JSON da topologia), com
fallback para `Server`. Conjunto usado: `Server, Network, Router, Database, Cloud, Shield, Box,
Monitor, Wifi, HardDrive, Cpu, Globe, Laptop, Printer, Phone, Radio, Lock, Layers, GitBranch, Zap`.

---

## 3. Point

Vértice de roteamento — só dobra uma conexão. Sem texto, sem card.

- **Bolinha** `14×14`, `border-radius: 50%`, fundo `background.canvas`,
  borda `2px solid primary.main` (ou `defaultColor`).
- **Halo** permanente `box-shadow: 0 0 0 4px alpha(primary.main, α)` com três níveis:
  **repouso `0.10` · hover `0.22` · selecionado `0.28`**. Só o halo muda — o diâmetro é fixo.
- **Handles** `6×6`, revelados pelo seletor irmão `&:hover ~ .react-flow__handle`.
- Criado centralizado no cursor: `position = { x: cursor.x - 7, y: cursor.y - 7 }`.

```tsx
dot: css({
  width: POINT_NODE_SIZE, height: POINT_NODE_SIZE,
  borderRadius: '50%',
  background: theme.colors.background.canvas,
  border: `2px solid ${theme.colors.primary.main}`,
  boxShadow: `0 0 0 4px ${alpha(theme.colors.primary.main, 0.1)}`,
  cursor: 'default',
  transition: `box-shadow ${transitions.fast}`,
  '&:hover': { boxShadow: `0 0 0 4px ${alpha(theme.colors.primary.main, 0.22)}` },
  '&:hover ~ .react-flow__handle': { opacity: 1 },
}),
dotSelected: css({ boxShadow: `0 0 0 4px ${alpha(theme.colors.primary.main, 0.28)}` }),
```

---

## 4. Postit (grupo / anotação)

Retângulo redimensionável e semitransparente, atrás dos nós.

```
 ┌─[ NOVO GRUPO ]──────────────┐   tag flutuante: top:-11, left:12
 │                             │
 │   arraste nós para cá       │   hint itálico quando vazio
 │                             │
 └────────────────────────────◪┘   resize 14×14, só se selecionado
```

- **`accent` = `data.defaultColor ?? theme.colors.primary.main`.**
- **Card**: `100% × 100%`, mínimo `160×100`, `padding: 16px`, raio `6px`, flex column.
- **Fundo**: `alpha(style.bgColor, style.bgOpacity/100)`; sem `bgColor` → `alpha(accent, 0.05)`.
- **Borda**: `1.5px {solid|dashed|dotted} {selected ? accent : alpha(accent, 0.30)}`.
- **Selecionado**: `box-shadow: 0 0 0 3px alpha(accent, 0.12)`.
- **Tag de título** flutuando sobre a borda: `absolute; top: -11px; left: 12px`, mono `12px`,
  `uppercase`, `letter-spacing: 0.08em`, `padding: 2px 8px`, raio `6px`,
  fundo `background.canvas` (corta a borda), `border: 1px solid alpha(accent, 0.35)`,
  cor `accent`, `ellipsis` com `max-width: calc(100% - 24px)`.
- **Edição inline**: duplo clique troca o texto por `<textarea>` transparente
  (`border/outline/resize: none`, `background: transparent`), com `className="nodrag nopan"` e
  `stopPropagation` em `keydown`/`mousedown`. Grava no `onBlur`.
- **Vazio**: hint centralizado, itálico, `text.secondary` — *"arraste nós para cá"*.
- **Resize**: `<NodeResizeControl position="bottom-right">` só quando selecionado; handle `14×14`,
  fundo `accent`, `border-radius: 4px 0 4px 0`, `opacity: 0.7`.
  **Pausar o undo durante o resize** (`onResizeStart → temporal.pause()`, `onResizeEnd → resume()`).

```tsx
const accent = data.defaultColor ?? theme.colors.primary.main;
const style = data.style ?? {};

const cardStyle: React.CSSProperties = {
  background: style.bgColor
    ? alpha(style.bgColor, (style.bgOpacity ?? 100) / 100)
    : alpha(accent, 0.05),
  border: `1.5px ${style.borderStyle ?? 'solid'} ${selected ? accent : alpha(accent, 0.3)}`,
  boxShadow: selected ? `0 0 0 3px ${alpha(accent, 0.12)}` : 'none',
};
```

---

## 5. Text

Rótulo livre. Sem card, sem fundo, sem borda — só texto.

- `display: block`, `fontFamily` do tema, peso `500`, `line-height: 1.4`,
  `min-width: 60px`, `min-height: 1.4em`, `white-space: pre`.
- Cor `text.primary`, sobrescrita por `defaultColor`. `fontSize` de `data.style.fontSize` (default 14).
- **Sem width/height na factory** — o nó encolhe ao conteúdo.
- **Selecionado**: `outline: 1px dashed border.medium` + raio padrão. Sem preenchimento.
- **Edição inline** por `contentEditable` no `<span>`: duplo clique entra, foca e põe o cursor no
  fim (`Range` + `collapse(false)`); `borderBottom` transparente → `1px solid primary.main` durante a
  edição; `Enter`/`Escape` dão blur, `Shift+Enter` quebra linha; grava no blur, texto vazio volta a
  `'Texto'`; placeholder via `&:empty::before`.
- **Handles** `6×6`, fundo transparente, borda `1px solid border.medium`, `opacity: 0 → 0.8` no hover
  (mais discretos que os do nó, já que não há card para segurá-los).

```tsx
const textBase = {
  display: 'block',
  fontFamily: theme.typography.fontFamily,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: 1.4,
  minWidth: 60,
  minHeight: '1.4em',
  outline: 'none',
  color: theme.colors.text.primary,
  whiteSpace: 'pre' as const,
  borderBottom: '1px solid transparent',
  transition: `border-color ${transitions.fast}`,
  '&:empty::before': { content: "'Texto'", color: theme.colors.text.disabled },
};

text:         css({ ...textBase, cursor: 'default' }),
textEditing:  css({ ...textBase, cursor: 'text', borderBottom: `1px solid ${theme.colors.primary.main}` }),
rootSelected: css({ outline: `1px dashed ${theme.colors.border.medium}`, borderRadius: theme.shape.radius.default }),
```

---

## 6. Conexões (edges)

Edge customizada ligando **centro a centro** dos nós — não handle a handle. É o detalhe que dá o
visual limpo: a linha aponta para o miolo do card e some por baixo dele.

1. **Centro a centro**: ignore `sourceX/Y`/`targetX/Y` do React Flow e recalcule com
   `node.position + measured.size / 2`.
2. **Formato**: `straight` → `getStraightPath` (default); `curved` → `getBezierPath` com as
   posições derivadas do eixo dominante (senão a curva vira ao contrário quando o alvo troca de lado).
3. **Traço**: `stroke-width` `1.5px`, `2px` selecionado. Cor `data.color ?? border.medium`;
   selecionado → `primary.main` + `filter: drop-shadow(0 0 5px alpha(primary.main, 0.6))`.
4. **Estilo**: `solid` → sem dash · `dashed` → `6 4` · `dotted` → `2 4`.
5. **Transição**: `stroke 120ms ease, stroke-width 120ms ease`.
6. **Animações** (dirigidas por threshold):

   | Tipo | Efeito |
   |---|---|
   | `none` | estática |
   | `dash-flow` | `strokeDasharray: '7 5'` + `topoDashFlow 0.9s linear infinite` |
   | `pulse` | `topoEdgePulse 1.2s ease-in-out infinite` |
   | `flow` | linha em `stroke-opacity: 0.35` + 2 partículas `<circle r={3}>` com `<animateMotion dur="1.6s" repeatCount="indefinite" path={edgePath}/>`, a 2ª com `begin="0.8s"` e `opacity: 0.6` |

   ```css
   @keyframes topoDashFlow  { to { stroke-dashoffset: -24; } }
   @keyframes topoEdgePulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
   ```

7. **Label** (`<EdgeLabelRenderer>`): pílula mono `12px`, `padding: 4px 9px`, raio `6px`,
   fundo `background.secondary`, borda `1px solid border.weak` (→ `primary.main` se selecionada),
   `box-shadow: z2`, `nowrap`, `className="nodrag nopan"`, `pointer-events: all`.
   Posição: `transform: translate(-50%,-50%) translate(${labelX}px, ${labelY}px)`.

```tsx
function autoPositions(sx, sy, tx, ty): [Position, Position] {
  const dx = tx - sx, dy = ty - sy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  }
  return dy >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

const sx = src ? src.position.x + (src.measured?.width  ?? 0) / 2 : sourceX;
const sy = src ? src.position.y + (src.measured?.height ?? 0) / 2 : sourceY;
const tx = tgt ? tgt.position.x + (tgt.measured?.width  ?? 0) / 2 : targetX;
const ty = tgt ? tgt.position.y + (tgt.measured?.height ?? 0) / 2 : targetY;

<BaseEdge
  id={id}
  path={edgePath}
  markerEnd={markerEnd}
  style={{
    stroke: selected ? theme.colors.primary.main : (data?.color ?? theme.colors.border.medium),
    strokeWidth: selected ? 2 : 1.5,
    strokeDasharray,
    strokeOpacity: animation === 'flow' ? 0.35 : undefined,
    animation: cssAnimation,
    filter: selected ? `drop-shadow(0 0 5px ${alpha(theme.colors.primary.main, 0.6)})` : undefined,
    transition: 'stroke 120ms ease, stroke-width 120ms ease',
  }}
/>
```

**Canvas**: fundo `background.canvas`, `<Background variant="dots" gap={20} size={1}/>` com a cor
dos pontos forçada para `border.weak` (`'& .react-flow__background': { color: theme.colors.border.weak }`).

---

## 7. Seleção

**Regra:** elemento selecionado exibe **2px de `primary.main`** em volta de si. O que unifica os
cinco tipos é a *leitura* — 2px de azul de seleção —, não a propriedade CSS: cada elemento usa o
mecanismo que sua forma comporta.

| Tipo | Mecanismo | Por quê |
|---|---|---|
| **Nó** | `border-color: primary.main` + `box-shadow: 0 0 0 1px primary.main` | Já tem borda para recolorir. Borda (1px) + anel (1px) somam os mesmos 2px; empilhar um anel de 2px daria 3px só nele. |
| **Point** | `box-shadow: 0 0 0 2px primary.main, 0 0 0 6px alpha(accent, 0.28)` | O anel entra por dentro do halo, que é empurrado de 4px para 6px para não ser encoberto. |
| **Postit** | `box-shadow: 0 0 0 2px primary.main` | A borda **não** muda ao selecionar. |
| **Text** | `box-shadow: 0 0 0 2px primary.main` | Anel, nunca preenchimento: o Text não tem superfície própria e um fundo o transformaria num card. `box-shadow` não ocupa espaço, então selecionar não desloca o texto. |
| **Conexão** | `stroke: primary.main` + `drop-shadow(0 0 5px alpha(primary.main, 0.6))` + `stroke-width + 0.5` | Anel em volta de uma linha não existe. |

O helper é `selectionRing(color)` em `src/canvas/tokens.ts`.

### Duas armadilhas que a regra existe para evitar

1. **Não sinalizar seleção com a cor do próprio elemento.** O Postit saturava a borda para o seu
   próprio accent ao ser selecionado — num postit azul, indistinguível do repouso. Seleção é estado
   de UI e usa a cor de seleção do tema, nunca a cor de identidade do elemento.
2. **Não sinalizar por variação de opacidade.** O Point subia o halo de `0.28` para `0.22` de
   opacidade entre hover e selecionado: diferença imperceptível, e ainda variável conforme a cor do
   elemento. O sinal precisa ser uma adição, não um ajuste.

### Sincronia com o painel de Layers

A seleção é bidirecional entre canvas e Layer, pelo `instanceState` do `PanelContext`
(`src/panel/instanceState.ts`). Clicar no canvas abre e rola até a linha correspondente; abrir uma
linha seleciona e **centraliza** o elemento no canvas, preservando o zoom atual — `fitView` sobre um
elemento só daria um salto de zoom desconcertante.

A API é `@alpha` e documentada como suportada apenas em contexto de dashboard, então todo acesso é
opcional dos dois lados: sem o canal, cada lado funciona isolado. O que se perde é a sincronia,
nunca a edição.

---

## 8. Cor de estado

> ⚠️ **Esta seção reverte a regra A.2 original**, que dizia: *"a cor de estado incide apenas em
> ícone, cápsula e badge — nunca no fill do card"*. A justificativa de então era o excesso de
> saturação: num NOC com 30 alarmes simultâneos, 30 retângulos vermelhos viram letreiro. A reversão
> vem do PRD de UX (item 6.2) e tem justificativa oposta e igualmente concreta: numa topologia de
> parede, lida a metros de distância, um ícone de 20px não carrega o sinal — a área carrega.
> O custo continua existindo; foi aceito conscientemente.

**Regra:** o elemento com estado assume a cor de estado no **fundo inteiro**, e todo conteúdo sobre
ele (texto, ícone, cápsula, badge) passa a derivar do token de contraste.

### Quais elementos preenchem

| Tipo | Superfície de estado |
|---|---|
| **Nó** | O card inteiro. É o elemento a que a regra se refere. |
| **Point** | Já preenchido: com 14px, borda de 2px mais halo, o estado ocupa o elemento inteiro por construção. |
| **Text** | Nunca. Não tem superfície própria — a cor pousa no glifo. Preenchê-lo o transformaria num card, exatamente como acontece na seleção (§7). |
| **Conexão** | Nunca. Um traço não tem fundo; o estado é o próprio `stroke`. |
| **Postit** | Fora do modelo de estado: sua cor é escolha estática do usuário, com opacidade própria. |

### Estados que **não** preenchem

`nodata` e `neutral` não são cor clara nem escura — são **ausência de estado**, e o elemento fica
com o fundo neutro do tema. É o que preserva A.4: um painel mudo tem que continuar visivelmente
distinto de um painel saudável, e preenchê-lo com qualquer cor apagaria a diferença.

`fixed` (a linha **Base** do editor de Thresholds) **preenche**. Depois que a cor de repouso passou
a ser a Base da lista de regras, ela é o estado "nenhuma regra casou" — e não mais um acento de
identidade. Consequência a conhecer: um nó com cor Base definida e nenhuma regra vira um card
inteiramente daquela cor.

### Contraste (WCAG AA)

O par fundo + texto sai junto de `stateFill()` (`src/canvas/stateFill.ts`). Sair junto é o ponto:
foi a separação dos dois — card preenchido, texto preso a `text.primary` — que tornou a regra A.2
necessária em primeiro lugar.

**`theme.colors.getContrastText(bg)` sozinho não serve.** Ele usa o `contrastThreshold` do tema,
que vale `3` — o critério AA para *texto grande* (24px, ou 18.66px em negrito). O texto do nó é
14px e 12px, então o critério aplicável é **4.5**. A diferença é real e cai justo nas duas cores
mais frequentes de um NOC:

| Fundo | `getContrastText` | Razão | Melhor candidato | Razão |
|---|---|---|---|---|
| `red` `#F2495C` | claro | **3.57** ✗ | escuro | 5.88 ✓ |
| `blue` `#5794F2` | claro | **3.03** ✗ | escuro | 6.92 ✓ |
| `yellow` `#FADE2A` | escuro | 15.54 ✓ | escuro | 15.54 ✓ |
| `dark-red` `#C4162A` | claro | 6.00 ✓ | claro | 6.00 ✓ |

Então o helper mede **os dois** candidatos e fica com o de maior contraste. Os candidatos vêm do
próprio tema, forçados por limiar (`getContrastText(bg, 1)` → claro, `getContrastText(bg, 22)` →
escuro), e não de `#fff`/`#000` literais — a regra 1 do §1 vale aqui também.

A alternativa seria escurecer o fundo até o texto claro alcançar 4.5, mas aí a cor do card deixaria
de ser a cor que o usuário escolheu e que o swatch do editor mostra. Preferir o texto escuro mantém
a cor de estado intacta. `src/canvas/stateFill.test.ts` prova AA para o mapa de severidade e a
paleta do editor, nos dois temas.

### Hierarquia sobre o fundo preenchido

- **Texto secundário**: `alpha(fill.text, 0.8)` — mesma cor de contraste, não `text.secondary`,
  que só tem contraste garantido sobre o fundo neutro.
- **Cápsula de ícone**: `alpha(fill.text, 0.15)` de fundo, `inset 0 0 0 1px alpha(fill.text, 0.25)`.
- **Badge**: sempre o token de contraste, **inclusive quando teria cor própria** — a cor própria do
  badge é justamente a do fundo nos estados de trigger e threshold.
- **Badge sem rótulo**: com o card preenchido, some. O dot existia para dizer "há estado aqui", e
  180×60 de cor já dizem isso.
- **Borda**: o fill não a toca. É dela que saem o hover e o anel de seleção (§7), e um estilo inline
  venceria as duas classes.
