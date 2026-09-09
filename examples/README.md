# Dashboards de exemplo

Três dashboards prontos para importar, em dois grupos. O **exemplo** existe para
demonstrar os seis tipos de elemento num desenho denso. Os **modelos** existem
para serem copiados e adaptados: usam nomes e endereços fictícios e ocupam a
largura inteira de um painel de tela cheia.

Todos são **estáticos** — nenhum precisa de datasource.

| Arquivo | Para que serve |
| --- | --- |
| `topoflow-exemplo-estatico.json` | testar a importação e ver os seis tipos de elemento num desenho denso |
| `topoflow-modelo-datacenter.json` | modelo de datacenter, com os ícones da biblioteca **Padrão** |
| `topoflow-modelo-wan.json` | modelo de malha WAN, **só com nós** — nenhum elemento Imagem |

Todos importam e renderizam em qualquer Grafana ≥ 12.3.0, sem configurar nada.

## Como importar

**Pela interface:** *Dashboards → New → Import → Upload dashboard JSON file*,
escolha o arquivo e clique em *Load*.

**Pela API:**

```bash
jq '{dashboard: ., overwrite: true}' topoflow-exemplo-estatico.json \
  | curl -u admin:senha -H 'Content-Type: application/json' -d @- \
         http://SEU-GRAFANA:3000/api/dashboards/db
```

## O que o exemplo demonstra

- os seis tipos de elemento — nó, point, conexão, imagem, postit e texto;
- **conexões paralelas** entre o mesmo par de equipamentos (3 enlaces WAN, 4
  fibras do Stackwise). O truque é um *point* de cada lado por enlace: é o que
  permite mais de uma conexão entre os mesmos dois dispositivos e deixa o trecho
  do meio horizontal, com o rótulo no centro;
- **rótulo multi-linha** nas conexões — a fonte é monoespaçada e o espaço é
  preservado, então dá para alinhar os valores em coluna;
- a **biblioteca de ícones** em elementos Imagem (`src` aceita a chave do
  catálogo, como `topoflow/router`), com `iconTone` fixo em azul nos ativos e
  cinza no gateway de voz;
- postits como moldura das áreas e uma legenda montada com points, conexões e
  textos.

> **Estado ao vivo não está aqui.** Badge vindo de *value mapping*, banda
> interpolada com `${nome do field}` e modo **Trigger** exigem DataFrame, e
> nenhum destes arquivos traz query. Como ligar cada um está em *Adaptando para o
> seu ambiente*, abaixo.

## Os dois modelos

São pontos de partida, não demonstrações: importe, renomeie e substitua os dados.

**`topoflow-modelo-datacenter.json`** — quatro faixas verticais lado a lado
(*Borda*, *Perímetro*, *Núcleo*, *Acesso*), com o tráfego correndo da esquerda
para a direita. Cada equipamento é um **nó** com um elemento **Imagem** acima
dele, carregando a chave da biblioteca **Padrão** (`topoflow/router`,
`topoflow/firewall`, `topoflow/layer-switch`, `topoflow/server`,
`topoflow/database`, `topoflow/wifi`, `topoflow/world`).

**`topoflow-modelo-wan.json`** — núcleo ao centro e seis filiais nas laterais,
três de cada lado. Cada filial é um bloco de três cards: roteador voltado para o
núcleo, switch na borda externa e um equipamento de ponta abaixo dele. Não usa
**nenhum** elemento Imagem: só nós, conexões, faixas e textos. Os nós estão com
`showIcon: false`, então são cards puros; ligar o ícone próprio da cápsula é um
campo (`presentation.icon`, com uma chave do pack `classic`, que é glifo e
acompanha a cor do estado).

### Decisões que valem conhecer

- **Nomes e endereços são fictícios de propósito.** Os hosts são genéricos
  (`EDGE-RTR-01`, `FIL-NOR-02-SW`) e os endereços saem das faixas reservadas para
  documentação: `198.51.100.0/24` (RFC 5737) no lado público e `192.168.0.0/16`
  (RFC 1918) no interno. O ASN `64500` é da faixa privada. Nada aqui aponta para
  um ambiente real.
- **O problema é simulado com `color.fixed`, e não com threshold.** Num modelo
  100% estático não existe DataFrame, então a cadeia de cor não passa do nível 2
  — sem field não há regra que case, e `trigger` precisa de uma query em *Query
  Mode: Problems*. Um `color.fixed: "red"` preenche o card exatamente como um
  alarme real preencheria, porque `stateFill` trata `fixed` e `threshold` na
  mesma superfície. O que **não** dá para simular assim é a animação de alerta e
  o badge de estado: os dois nascem de uma regra que casou.
- **Cada modelo tem dois problemas**, um crítico e um degradado, para o código de
  cores aparecer inteiro: no datacenter, o `EDGE-RTR-02` perdeu o circuito
  (vermelho, conexão tracejada) e o `AP-WIFI-01` está degradado (laranja); na WAN,
  a `FIL-NOR-03` está offline e a `FIL-SUL-02` com latência alta.
- **Rótulo de conexão é uma linha curta** (`Po1 · 10 Gbps`, `Gi1/0/8 · 60%`). As
  conexões verticais — HA do par de firewalls, stack do par de core — ficam **sem
  rótulo**: o traço já diz (tracejado é contingência, grosso é agregado), e o
  rótulo pousaria em cima do ícone do equipamento de baixo.
- **A proporção é ~2,15:1.** O canvas dá `fitView` ao abrir, então o que decide
  se sobra tarja é a **proporção do desenho**, não a posição absoluta dos
  elementos — um desenho alto e estreito fica reduzido no meio, com as laterais
  vazias. Um painel `w: 24, h: 24` ocupando a largura inteira mede **1870 × 846**
  num monitor 1080p (medido, não estimado), ou seja 2,21:1. Se você mudar o
  `gridPos.h`, recalcule: a altura do painel é `h × 30 + (h − 1) × 8`.
- **As faixas foram apertadas até sobrar no máximo 80 px** acima e abaixo do
  conteúdo. Faixa alta e vazia no miolo foi o que tirou o terceiro card de cada
  filial do modelo WAN do papel: com dois, o retângulo parecia inacabado.
- **As colunas do datacenter ficam a um passo de 328 px**, o que deixa 152 px
  livres entre cards — mais que a placa de um rótulo, que é o que pousa no meio
  da conexão. Foi a medida que resolveu a colisão entre rótulo e ícone.

## Adaptando para o seu ambiente

1. **Nomes e IPs.** Tudo é texto fixo em `presentation.primaryText` /
   `secondaryText` (nós) e em `label` (conexões). Edite pela interface, no painel
   de opções, ou direto no *Panel JSON*.
2. **Ligue o datasource.** Aponte o painel para o seu Zabbix e, em cada
   elemento, no bloco **Estado**:
   - modo **Métrica** → escolha o campo do item (o "Campo") e monte as regras;
   - modo **Trigger** → informe o host e, opcionalmente, a trigger. Exige pelo
     menos uma query com **Query Mode: Problems** no painel.
3. **Rótulos com banda.** Escreva `${display name do field}` dentro do rótulo da
   conexão ou da legenda da imagem — é o mesmo nome que aparece no seletor de
   campo do editor, e unidade, casas decimais e mapeamentos já vêm aplicados.
4. **Substitua os problemas simulados.** Onde há `color.fixed: "red"`, troque por
   uma regra no bloco **Thresholds** do elemento (ou pelo modo Trigger): só então
   o badge de estado e a animação de alerta passam a funcionar.

## Duas coisas que talvez você queira mudar

- **Os rótulos das conexões saem preenchidos com a cor da conexão.** É de
  propósito: o rótulo se pinta como o card do nó, para que um enlace em alarme
  fique óbvio. Se preferir a caixa escura com borda colorida, remova a cor fixa
  da conexão — ela passa a usar o cinza neutro do tema, e a linha vai junto.
- **Texto do painel não interpola variável do dashboard.** `${...}` dentro de um
  texto do TopoFlow é a gramática do próprio plugin e busca um **field**, não uma
  variável do Grafana. Datas e rótulos globais precisam ser texto fixo.

---

Os três arquivos são validados contra o schema Zod em
`src/model/exemplos.test.ts` — se uma mudança de schema quebrar
um deles, o teste falha antes de a importação falhar.
