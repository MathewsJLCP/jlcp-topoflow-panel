# 09 — Pendências e roadmap

O que ficou de fora da v1.0, e o estado real de cada coisa: o que é decisão
pendente (precisa do usuário/cliente), o que é trabalho pendente (decisão já
tomada) e o que foi **descartado por decisão** — para não voltar à mesa sozinho.

---

## Precisa de decisão antes de codar

### Ver as triggers configuradas que estão OK

Metade do item 2 da rodada de 2026-08-29. A outra metade — configurar mais de
uma trigger — **está feita**: um host, uma lista de triggers, relação OU (ver
[04](04-canvas-e-editor.md#mais-de-uma-trigger-no-mesmo-vínculo)). Ficou
decidido em 2026-09-09 que os vínculos são triggers de **um mesmo host**, e não
pares host+trigger independentes: cobre o caso real ("este equipamento, estas 3
triggers") num formulário que cabe nos 300px do painel de opções.

O que continua pendente é o "há 3 triggers configuradas, a que alarma é a X": o
painel de hover listaria também as **configuradas que estão OK**. Hoje
`resolveTriggerState` só conhece o que está em PROBLEM; saber o que está OK exige
uma query que devolva as triggers saudáveis, e o Query Mode _Problems_ por
definição não devolve. Com a lista de nomes salva no vínculo, o "quais deveriam
estar lá" agora existe no modelo — falta a fonte de dados do lado OK.

### Licença dos ícones de terceiros

Bloqueia a assinatura do plugin. Duas frentes:

- **Pack `zabbix`** — os ícones são GPL-2.0. Redistribuí-los num plugin assinado
  é questão de licença a resolver. **Foi por isso que o pack ficou para depois**,
  por decisão do usuário.
- **Pack `petrolifera`** — fotos e ilustrações de produto de terceiros (Ubiquiti,
  Cambium). Mesma questão.

Enquanto não resolvido, o plugin não deveria ser assinado e publicado com esses
assets.

### Animação por métrica

O Bloco B decidiu animação **só para trigger**. Estender para métrica esbarra num
"quando animar" que ainda não tem decisão — hoje a animação é coluna da regra, e
para métrica isso significa "toda regra pode animar", o que pode virar um mapa
inteiro se mexendo.

---

## Decisão tomada, trabalho pendente

### Upload de imagem vira biblioteca do painel

Último bloco da biblioteca de ícones, **não implementado**. O desenho já está
aprovado: `options.icons` como `id → { name, src, tint }`, no nível do painel e
não por elemento.

O motivo é concreto: o mesmo logo em 20 nós entraria 20 vezes no JSON do
dashboard, que viaja inteiro em toda leitura.

### Contraste do pack `petrolifera`

O religador é traço preto (invisível no tema escuro) e os UniFi são brancos
(invisíveis no claro), porque a placa da cápsula é `background.primary`. Precisa
de uma placa própria por ícone, ou de variantes por tema.

---

## Limitações conhecidas (não são bugs)

| Limitação                                              | Por quê                                            | Contorno                                                                |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Host saudável não aparece na lista do editor           | o Query Mode _Problems_ só devolve problemas       | os combos aceitam valor digitado, e host desconhecido é aviso, não erro |
| Host digitado errado é indistinguível de host saudável | os dois produzem o mesmo frame vazio               | o aviso vive no editor, onde dá para corrigir                           |
| Imagem enviada por upload vive no JSON do dashboard    | não há backend para onde subir arquivo             | teto de tamanho no editor; use URL para imagem grande                   |
| Rótulos de conexão podem se sobrepor                   | colisão de rótulos nunca foi tratada               | fora de escopo, já sinalizado                                           |
| Sem copiar/colar no canvas                             | não há clipboard implementado                      | duplicar (menu de contexto)                                             |
| `refId` do vínculo de trigger não é exposto            | esta versão varre todos os frames de Problems      | o campo já existe no schema, para expor depois sem migração             |
| O modo percentual de threshold não existe              | depende de min/max do field, que nem sempre existe | `mode` pode entrar depois como campo opcional, sem migração             |

---

## Descartado por decisão (não reabrir sem motivo novo)

- **Trigger no elemento Texto** (D5). O Texto tem só o glifo como superfície; um
  texto que muda de cor sozinho se lê como erro de renderização.
- **Modo "Simple / Customized"** nas cores de severidade. Nenhuma regra = mapa
  padrão, uma = cor única, várias = mapa customizado. Mesma lógica da métrica.
- **Marca de "reconhecido"** (`acknowledged`) e **link para o problema no
  Zabbix**. Fora de escopo do item 1.
- **`ActiveTriggers` na conexão.** É um traço, não tem "embaixo" — por isso ela é
  o único elemento em que o chip ainda carrega severidade e contador.
- **Radar na conexão.** Sem superfície de onde emitir onda, cairia na mesma
  respiração do pulse. Melhor não oferecer do que oferecer e entregar outra coisa.
- **Segundo seletor de métrica para o gráfico de hover.** Ele existe para
  responder "de onde veio essa cor"; plotar outra série daria dois números sem
  nada dizendo qual é qual.
- **Campo `tint` separado no ícone.** Derivável de `kind` nos dois sentidos.
- **O pipeline nativo de thresholds pintando o elemento.** Ver
  [doc 03](03-estado-e-cor.md) — foi removido de propósito, não é regressão.

---

## Dívida técnica

| Item                                 | Nota                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `module.js` com 436 KB               | acima do limite recomendado do webpack (244 KB). Candidatos a code-splitting: `html-to-image` (só o screenshot usa) e os packs de ícone       |
| `TopologyCanvas.tsx` com ~830 linhas | o arquivo concentra seleção, arraste, menu, linkagem e commit. Extrair hooks é seguro (tudo já é testável), mas não é urgente                 |
| Cobertura de e2e                     | três specs cobrem o essencial; drill-down, screenshot e edição em massa ainda são só unidade                                                  |
| `SCHEMA_VERSION` continua em 1       | correto hoje. Quando subir, o migrador entra em `parseTopoFlowOptions` — o lugar já está marcado com comentário                               |
| Arquivos soltos na raiz              | `shot-editor-img.png` e `shot-semlegenda.png` são capturas de desenvolvimento; `temp/` guarda o material bruto do cliente antes de virar pack |
