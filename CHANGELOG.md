# Changelog

## 1.2.0 — 2026-09-09

### Vínculo direto com o Zabbix

- **Datasource do Zabbix nas opções do painel** (seção _Zabbix_). Serve ao
  editor: com ele configurado, os combos passam a sugerir o catálogo do Zabbix
  em vez de apenas o que as queries já trouxeram. Havendo exatamente um
  datasource Zabbix na instância, ele é adotado sozinho e o campo pode ficar
  vazio. Os dados que pintam o mapa continuam vindo das queries do painel.
- **Host e trigger com busca**, no vínculo por trigger. Um host sem problema
  ativo — que antes não aparecia em lista nenhuma — passa a ser escolhível. O
  que veio dos frames e não voltou da API continua na lista: nenhuma escolha já
  possível deixou de ser possível.
- **Modo Métrica por host + item.** O seletor de campo dá lugar a dois combos
  alimentados pelo Zabbix, e o elemento passa a guardar host e item em vez do
  nome da série (`color.metric`). É o que permite vincular **antes** de existir
  query. O caminho antigo continua a um clique de distância, em "Usar um campo
  da query", e tudo o que está salvo com `color.field` segue valendo sem
  migração.
- Falha ao consultar o Zabbix (sem permissão, fora do ar, plugin ausente) volta
  ao comportamento anterior com um aviso no formulário — nunca com erro dentro
  do combo. Digitar host, trigger e item à mão continua valendo em qualquer
  cenário.

### Vínculo de trigger

- **Mais de uma trigger por elemento.** O campo único virou uma lista: um host, e
  abaixo dele quantas triggers o elemento precisar, com `+ Adicionar trigger` e
  um `x` por linha. A relação é **OU** — basta uma alarmar para o elemento
  acender, e as que alarmarem juntas aparecem todas na lista sob o elemento e no
  contador; a cor segue a maior severidade entre elas.
- **Deixar a lista com uma linha só é o comportamento de sempre**, inclusive a
  opção "Qualquer trigger do host", que fica escondida a partir da segunda linha
  (ali ela revogaria as outras em vez de escolher entre elas).
- Topologias salvas antes disto carregam sem migração: a trigger que estava no
  campo `name` vira a primeira linha da lista.

### Lista de triggers ativas

- **Formato da lista: Lista ou Total.** Em **Total**, as até três linhas com os
  nomes viram uma só — "4 incidentes ativos" —, de altura fixa para qualquer
  número de alarmes, para a topologia densa em que importa _quanto_ está caindo.
  A linha veste a maior severidade em curso, e os nomes continuam no tooltip e
  no painel de hover. O campo fica junto de "Posição da lista", e some com a
  lista desligada. **Lista** segue sendo o padrão: nenhuma topologia salva muda
  de aparência.

## 1.1.0 — 2026-09-04

### Identidade

- **Logo próprio**, no lugar do placeholder do `create-plugin`. Dois arquivos:
  `img/logo.svg` (marca cheia, com as cápsulas de ícone vazadas por máscara) e
  `img/logo-small.svg` (traços engordados, para 16–24 px no seletor de
  visualização). As cores são literais de propósito — o Grafana carrega o logo
  via `<img>`, então o SVG não enxerga o tema, e o desenho precisa funcionar
  sobre `#111217` e `#F4F5F5`.

### Dashboards de exemplo

- **Dois modelos novos**, estáticos e prontos para copiar:
  `topoflow-modelo-datacenter.json` (quatro faixas, com os ícones da biblioteca
  Padrão) e `topoflow-modelo-wan.json` (núcleo e seis filiais, só com nós).
  Ambos desenhados na proporção de um painel de largura cheia, com dois
  problemas simulados cada um.
- **Nomes e endereços fictícios** no exemplo estático: hosts genéricos e faixas
  reservadas para documentação (RFC 5737 e RFC 1918).
- **`topoflow-exemplo-com-dados.json` removido.**

## 1.0.0 — 2026-09-02

Primeira versão.

### Canvas e edição

- Seis tipos de elemento: nó, point, conexão, imagem, postit e texto.
- Criar, arrastar, redimensionar, duplicar, deletar, reordenar e conectar, por
  menu de contexto ou pelo painel de Layers.
- Seleção múltipla com **edição em massa** de conexões e points.
- Seleção sincronizada entre o canvas e o painel de Layers.
- Grid com snap configurável; edição inline opcional fora do editor de painel.

### Vínculo com dados

- Modo **Métrica**: campo escolhido por display name, com bloco de regras
  próprio — threshold, valor exato, faixa, regex e casos especiais.
- Modo **Trigger**: host e trigger do Zabbix lidos de uma query em Query Mode
  _Problems_, com cores por severidade e severidades desligáveis.
- Templates `${nome do field}` em textos, rótulos de conexão e legendas.
- Animação de alerta por regra: pulsar, piscar e radar, sob
  `prefers-reduced-motion`.

### Leitura

- Lista de triggers em PROBLEM fixa junto ao elemento, com posição escolhível.
- Painel de hover: tabela de incidentes (modo Trigger) ou gráfico da métrica na
  janela de tempo do dashboard (modo Métrica).
- Drill-down por elemento, com variáveis interpoladas no clique.
- Screenshot da topologia em PNG.
- Biblioteca de ícones com pastas: `topoflow` (variantes por estado), `classic`
  (glifos) e `petrolifera` (ativos de campo).

### Notas de atualização

- **A topologia de exemplo saiu do default.** Um painel novo nasce com o canvas
  vazio. Painéis já salvos não são afetados.
- **Os thresholds e value mappings nativos do Grafana não pintam mais o
  elemento** — quem pinta é o bloco de regras do próprio elemento. Um elemento
  que dependia do threshold do _field_ para acender passa a exibir a cor Base até
  ganhar a regra equivalente no bloco dele. Eles continuam formatando o valor
  exibido e colorindo o gráfico do hover.
