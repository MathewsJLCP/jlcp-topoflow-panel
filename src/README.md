# TopoFlow

Mapas de topologia editáveis dentro do Grafana. Desenhe a rede no próprio
dashboard, vincule cada elemento a uma métrica ou a uma trigger do Zabbix, e
deixe o mapa contar o que está acontecendo — feito para telão de NOC.

## O que dá para fazer

**Desenhar.** Nós de equipamento, conexões, âncoras de roteamento (points),
retângulos de agrupamento, textos e imagens. Tudo por menu de contexto no canvas
ou pelo painel de opções: arrastar, redimensionar, duplicar, reordenar, conectar,
inverter conexão. Seleção múltipla com edição em massa — configure os quatro
segmentos de um caminho de uma vez só.

**Vincular a dados.** Cada elemento escolhe entre duas fontes de estado:

- **Métrica** — um field de qualquer datasource, com regras próprias de cor:
  threshold, valor exato, faixa, regex e casos especiais (null, NaN, vazio).
- **Trigger** — host e trigger do Zabbix, lidos de uma query em Query Mode
  *Problems*. Cores por severidade, com o mapa padrão do Zabbix ou o seu.

Textos, rótulos de conexão e legendas aceitam `${nome do field}`, interpolado com
unidade, casas decimais e value mappings já aplicados.

**Ler de longe.** O elemento acende, anima (pulsar, piscar, radar) e lista as
triggers em PROBLEM logo ao lado — sem precisar de mouse. Aproximando, o hover
mostra a tabela de incidentes com tempo de cada alarme, ou o gráfico da métrica
na janela de tempo do dashboard.

**Navegar.** Drill-down por elemento, com as variáveis do dashboard resolvidas no
instante do clique. O elemento é um link de verdade: ctrl+clique abre em outra
aba.

**Documentar.** Botão de screenshot: a topologia inteira em PNG, enquadrada e em
2x.

## Requisitos

- Grafana **12.3.0** ou superior.
- Para vínculo com triggers: o datasource
  [Zabbix](https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-datasource/),
  com pelo menos uma query em Query Mode *Problems* no painel.

Nenhum backend, nenhuma configuração de servidor: tudo vive no JSON do dashboard.

## Começando

1. Adicione o painel ao dashboard e escolha a visualização **TopoFlow**. O canvas
   nasce vazio.
2. Clique com o botão direito no canvas para adicionar o primeiro elemento (ou
   use **Adicionar elemento**, no painel de opções à direita).
3. Arraste de um handle a outro para conectar dois elementos.
4. Selecione um elemento e abra o bloco **Estado** para vinculá-lo a um dado:
   escolha **Métrica** ou **Trigger**, aponte o campo (ou o host) e adicione as
   regras de cor.
5. A linha **Base**, ao pé das regras, é a cor de repouso do elemento — a que
   vale quando nenhuma regra casa.

Dica: um elemento sem nenhuma regra fica na Base, e não verde. Aqui verde
significa "verificado OK", nunca "não configurado".

## Notas de comportamento

- **Edição.** No editor de painel ela está sempre ligada. No dashboard depende do
  toggle *Edição inline*, em **Canvas** — assim quem só visualiza não arrasta a
  topologia sem querer.
- **Thresholds e Value mappings nativos** continuam formatando o valor exibido e
  colorindo o gráfico do hover, mas **não pintam o elemento**: quem pinta é o
  bloco de regras do próprio elemento. É o que garante que a cor que você
  escolheu no elemento seja a cor que aparece.
- **Topologia corrompida não é sobrescrita.** Se o JSON salvo não validar, o
  painel avisa e desliga a edição em vez de gravar por cima do seu desenho.

## Licença

Apache-2.0.
