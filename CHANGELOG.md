# Changelog

## 1.3.0 — 2026-09-10

### O painel busca os próprios problemas

- **A seção _Zabbix_ virou um interruptor.** Ligada, o editor sugere hosts e
  triggers do catálogo **e** o painel executa a própria query de Problems para os
  hosts vinculados — o que **dispensa a query no dashboard**, que é o trabalho
  manual que esta rodada inteira existe para eliminar. Desligada, e é o padrão,
  tudo vem das queries do dashboard, como sempre veio.
- **Vale para os dois vínculos: trigger e métrica.** Uma query só de _Problems_
  para o mapa inteiro, por mais elementos que ele tenha, e uma query de métrica
  por host, com os itens daquele host. Os problemas não ficam presos à janela de
  tempo do dashboard: um alarme aberto há oito horas continua visível com o
  dashboard em "últimas 6 horas".
- Unidade, casas decimais e value mappings do painel **continuam valendo** nas
  séries que o painel busca, e passam a valer na hora em que são editados, sem
  ir buscar o dado de novo.
- Atualiza no refresh do dashboard (botão, intervalo automático) e ao mudar a
  janela de tempo.
- Com a seção ligada, os problemas que vierem de uma query do dashboard **cedem
  lugar** aos do painel: as duas fontes trazem os mesmos alarmes, e somadas
  fariam cada um contar duas vezes. As séries de métrica do dashboard continuam
  valendo.
- O aviso "nenhuma query de Problems neste painel" some com a seção ligada — ele
  mandava resolver um problema que o usuário acabou de dispensar.
- Falha ao atualizar **preserva o último estado** e avisa no topo do painel —
  num telão, apagar o mapa é pior que mostrar o estado de um minuto atrás.

### Biblioteca de ícones: pack Zabbix

- **O conjunto de ícones dos mapas do Zabbix entrou na biblioteca**, inteiro: 43
  desenhos numa pasta *Zabbix*, entre *Clássicos* e *Petrolífera*. Quem já montou
  o mesmo mapa no Zabbix reconhece cada um sem ler o rótulo.
- Mais um **AP**, que o conjunto do Zabbix não tem: é a mesma foto do UniFi AC
  Lite que já estava no pack *Petrolífera*. São 44 na pasta.
- Roteador, switch, hub, firewall, modem, nuvem, satélite, SAN, PABX, estação,
  notebook, impressora — e as versões **símbolo** do roteador, do roteador cripto
  e do PABX IP, que são o desenho esquemático em vez do equipamento.
- Vieram junto as peças de **elevação de rack** (servidores 1U a 5U, no-break de
  rack, array de discos e servidor Zabbix, cada um em 2D e 3D, mais os dois racks
  de 42U). São tiras muito largas: num nó de 20px viram um fio. O lugar delas é o
  elemento **Imagem**, que tem tamanho livre e onde dá para empilhar uma
  elevação — e por isso 2D e 3D estão os dois, já que uma pilha só fecha se todas
  as peças estiverem na mesma projeção.
- Como no pack *Petrolífera*, são figuras com cor própria: **não anunciam
  estado** (quem anuncia é a placa da cápsula, atrás delas) e o campo "Cor do
  ícone" não aparece para eles.
- **Pendência de licença.** Estes ícones são GPL-2.0 e o plugin é Apache-2.0.
  Enquanto isso não se resolver, o plugin não deveria ser assinado e publicado
  com eles. Ver [doc 09](docs/09-pendencias-e-roadmap.md).

### Correções e ajustes de ícone

- **A Torre do pack _Petrolífera_ é outra arte**: uma torre de telecom com
  refletores, no lugar do pictograma de antena que estava lá. As duas versões
  antigas saíram.

### Melhorias

- **Os seletores de métrica do editor passam a oferecer o Zabbix.** "Inserir
  métrica", "Exibir valor" e o modo _Field_ dos textos listam, junto com o que
  veio das queries, o que já está vinculado **e o catálogo de itens numéricos dos
  hosts que o mapa usa** — carregado ao abrir o combo, em lotes, e reaproveitado
  por 30 segundos. Antes, nada disso existia ali: o campo prometia o que não
  entregava.
- **O painel busca também a métrica que só um texto menciona.** Todo
  `${host: item}` escrito num rótulo, legenda ou texto entra na query, assim como
  o field escolhido em "Exibir valor". Nome que não corresponda a um host do
  Zabbix é descartado sem custo.
- **Fim dos dois avisos que mandavam resolver o que a seção já resolveu**: nem
  "essa métrica não está nas queries do painel" no vínculo por métrica, nem
  "sem correspondência nas séries" para uma métrica que o painel busca e exibe.

- **"Exibir valor" sem métrica escolhida passa a mostrar a do estado** — a mesma
  que pinta o elemento —, em vez de um travessão. É o que o toggle promete, e é
  a única saída quando a métrica foi escolhida por host + item: nesse caso a
  série só existe quando o painel busca sozinho, e o seletor de field lista
  apenas o que veio das queries do dashboard.

### Correções

- **A lista de hosts do combo não é mais espaçada.** Todas as linhas vinham com
  altura de duas, a segunda em branco: o `Combobox` decide a altura por presença
  da _chave_ `description`, e nós a mandávamos sempre, mesmo vazia.

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
