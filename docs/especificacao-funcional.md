# TopoFlow — Especificação funcional (v1.3.0)

Inventário completo do que o produto **faz** hoje: cada elemento, cada campo,
cada interação, cada estado e cada mensagem. Serve de contexto para desenhar a
versão 2.0 do zero, sem perder nenhuma função existente.

> **Sobre aparência.** Este documento descreve função, não forma. Não há aqui
> nenhuma diretriz de estilo, layout visual, tipografia, paleta ou tratamento
> gráfico da versão atual, e o redesenho não deve herdar nenhum. Onde a palavra
> **cor** aparece, ela é um **dado**: um valor que o usuário escolhe num campo,
> ou o atributo que comunica o estado de um elemento. Como esse estado aparece na
> tela é uma decisão livre do novo design.

---

## Sumário

1. [O produto](#1-o-produto)
2. [Contexto de plataforma](#2-contexto-de-plataforma)
3. [Glossário](#3-glossário)
4. [Os seis tipos de elemento](#4-os-seis-tipos-de-elemento)
5. [O bloco de Estado](#5-o-bloco-de-estado)
6. [Textos dinâmicos](#6-textos-dinâmicos-templates)
7. [Canvas: interações de edição](#7-canvas-interações-de-edição)
8. [Superfícies de leitura](#8-superfícies-de-leitura)
9. [Painel de opções](#9-painel-de-opções)
10. [Biblioteca de ícones](#10-biblioteca-de-ícones)
11. [Integração com o Zabbix](#11-integração-com-o-zabbix)
12. [Mensagens, avisos e estados vazios](#12-mensagens-avisos-e-estados-vazios)
13. [Regras de negócio a preservar](#13-regras-de-negócio-a-preservar)
14. [Lacunas conhecidas](#14-lacunas-conhecidas)
15. [Checklist de cobertura para o mockup](#15-checklist-de-cobertura-para-o-mockup)

---

## 1. O produto

**TopoFlow** é um plugin de painel do Grafana para desenhar **mapas de
topologia** (redes, datacenters, plantas de campo) dentro de um dashboard e fazer
cada elemento do desenho refletir o estado real do que ele representa.

**Para quem.** Equipes de operação (NOC). Dois perfis de uso:

- **Quem monta o mapa** — desenha, vincula cada elemento a um dado e configura as
  regras. Usa mouse e o painel de opções.
- **Quem lê o mapa** — o operador de plantão ou o **telão de NOC**: uma tela aberta
  o dia inteiro que ninguém toca. A informação precisa estar visível **sem hover e
  sem clique**, legível à distância.

**O que dá para fazer**, em cinco verbos:

| Verbo | O que significa |
| --- | --- |
| **Desenhar** | Nós de equipamento, conexões, âncoras de roteamento, retângulos de agrupamento, textos e imagens |
| **Vincular** | Cada elemento observa uma **métrica** (de qualquer datasource) ou **triggers do Zabbix** |
| **Ler** | O elemento muda de estado, anima, lista os alarmes ativos ao lado e mostra detalhes no hover |
| **Navegar** | Clique no elemento abre outro dashboard ou outro sistema (drill-down) |
| **Documentar** | Exportar a topologia inteira como imagem PNG |

**Princípios de produto** (são requisitos, não estilo):

1. **Elemento sem regra não parece saudável.** "Sem configuração" e "verificado
   OK" nunca podem se confundir.
2. **"Sem dados" é um estado próprio**, distinto de saudável, de alarme e da cor
   de repouso.
3. **A informação crítica está na tela, não atrás de um gesto.** O hover
   detalha; ele nunca é a única forma de saber o que alarmou.
4. **Nunca sobrescrever o trabalho do usuário.** Topologia corrompida tranca a
   edição em vez de ser substituída.
5. **Alternar não custa nada.** Trocar Métrica ↔ Trigger, Biblioteca ↔ Arquivo,
   Sólido ↔ Estado preserva a configuração do outro lado.
6. **Movimento com moderação.** Animações respeitam a preferência do sistema por
   movimento reduzido, e nenhuma pisca de forma brusca.

---

## 2. Contexto de plataforma

Restrições que a v2 herda, porque vêm do Grafana e não do design atual.

### Duas superfícies separadas

| Superfície | Onde vive | O que contém |
| --- | --- | --- |
| **Canvas** | A área do painel, dentro do dashboard | O desenho. Edição direta (arrastar, conectar, menu de contexto) e leitura |
| **Painel de opções** | Barra lateral do editor de painel do Grafana, estreita (~300 px) | Formulários de cada elemento, configurações do mapa e as seções nativas do Grafana |

As duas superfícies são árvores independentes. A única ponte entre elas é a
**seleção**: selecionar no canvas abre o formulário no painel de opções, e abrir
um formulário seleciona e centraliza o elemento no canvas. O painel de opções
**não conhece** a viewport do canvas (zoom, posição visível).

O painel de opções é organizado pelo Grafana em **categorias recolhíveis**. O
plugin ocupa três (Layer, Zabbix, Canvas) e convive com as categorias nativas
(unidade, decimais, thresholds, value mappings, overrides).

### Três modos de uso

| Modo | Canvas | Painel de opções |
| --- | --- | --- |
| **Editor de painel** | Sempre editável | Disponível |
| **Dashboard (visualização)** | Só leitura: sem arrastar, sem selecionar, sem menu de contexto | Não existe |
| **Dashboard com "Edição inline" ligada** | Editável por gestos (criar, mover, conectar, duplicar, excluir) | Não existe — sem formulários |

### Persistência

- Tudo o que o usuário configura vive no JSON do dashboard. **Não há backend**.
- Não há desfazer/refazer próprio: vale o do dashboard do Grafana.
- Upload de imagem vira dado embutido no JSON (daí o limite de tamanho).

### Origem dos dados

Duas fontes, escolhidas por um interruptor no nível do painel (ver
[§11](#11-integração-com-o-zabbix)):

- **Padrão:** as queries do dashboard (qualquer datasource; triggers via
  datasource Zabbix em modo *Problems*).
- **Zabbix direto:** o próprio painel consulta o Zabbix e dispensa a query.

---

## 3. Glossário

| Termo | Significado |
| --- | --- |
| **Elemento** | Qualquer peça do desenho. Seis tipos: Nó, Point, Conexão, Imagem, Postit, Texto |
| **Handle** | Ponto de ancoragem de onde se arrasta para criar uma conexão |
| **Vínculo** | A ligação de um elemento a um dado (métrica ou trigger) |
| **Estado** | O que o elemento comunica num instante: alarme, regra atingida, sem dados, repouso |
| **Regra** | Condição sobre o valor da métrica que define cor (e animação) do estado |
| **Base** | A cor de repouso do elemento — vale quando nenhuma regra casa |
| **Host** | Equipamento monitorado no Zabbix |
| **Item** | Uma métrica de um host no Zabbix (ex.: uso de CPU) |
| **Trigger** | Condição de alarme do Zabbix sobre um host |
| **Problema / incidente** | Uma trigger em estado de alarme (PROBLEM) |
| **Severidade** | Gravidade do problema no Zabbix, 6 níveis: *Not classified*, *Information*, *Warning*, *Average*, *High*, *Disaster* |
| **Field / série** | Uma coluna de dados vinda de uma query, identificada pelo nome de exibição |
| **Template** | Texto com `${nome do field}` que é substituído pelo valor atual |
| **Drill-down** | Link que o clique no elemento abre |
| **Layer** | A lista de todos os elementos no painel de opções |

---

## 4. Os seis tipos de elemento

### Matriz de capacidades

| Capacidade | Nó | Point | Conexão | Imagem | Postit | Texto |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Pode ser conectado | ✓ | ✓ | — | ✓ | — | — |
| Tem estado (métrica/trigger) | ✓ | ✓ | ✓ | só com fundo em modo Estado | — | — |
| Lista de triggers ativas ao lado | ✓ | ✓ | — (usa chip) | ✓ | — | — |
| Gráfico da métrica no hover | ✓ | ✓ | — | ✓ | — | — |
| Animação de alerta "radar" | ✓ | ✓ | — | ✓ | — | — |
| Drill-down | ✓ | — | — | ✓ | — | ✓ |
| Redimensiona arrastando no canvas | — | — | — | ✓ | ✓ | — |
| Tamanho editável no formulário | ✓ | — | espessura | — | — | tamanho da fonte |
| Reordenar camada (frente/trás) | — | — | — | — | ✓ | — |
| Duplicar | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Edição em massa | — | ✓ | ✓ | — | — | — |

### Ao criar

Cada elemento novo nasce **sem vínculo e sem cor** — não pode parecer nem
saudável nem em alarme antes de ser configurado. Identificadores são curtos e
sequenciais por tipo (`node-1`, `point-2`, `text-3`).

| Tipo | Conteúdo inicial |
| --- | --- |
| Nó | Ícone ligado; texto primário igual ao identificador (`node-1`) |
| Point | Nada além da posição |
| Postit | Título "Grupo" |
| Texto | Conteúdo "Texto" |
| Imagem | Sem figura (mostra o aviso "Sem imagem") |
| Conexão | Estilo contínuo, forma reta, sem animação |

---

### 4.1 Nó

**O que é.** O equipamento: roteador, switch, servidor, câmera. O elemento
principal do mapa.

**O que mostra no canvas:**

- ícone (opcional);
- **texto primário** (nome do equipamento) e **texto secundário** opcional
  (ex.: IP), ambos podendo ser fixos ou vir de um dado;
- **indicador de valor** — o último valor de uma métrica, ou "no data", ou só um
  indicador de estado (regras em [§8.2](#82-indicador-de-valor-do-nó));
- o **estado** do elemento (alarme, regra atingida, sem dados, base);
- a **lista de triggers ativas** num dos quatro lados (se em modo Trigger);
- quatro **handles** de conexão (um por lado), visíveis ao passar o mouse em modo
  de edição.

A altura do nó é um **mínimo**: ele cresce se o nome quebrar em várias linhas —
nome nunca é truncado.

**Formulário** (nesta ordem hoje):

| Campo | Tipo de controle | Opções / limites | Observação |
| --- | --- | --- | --- |
| Texto primário | Escolha *Fixo / Field* + texto de uma linha ou seletor de field | — | Field lista campos exibíveis (número, texto, booleano, enum) |
| Texto secundário | Interruptor que revela o mesmo controle acima | — | Desligar apaga o conteúdo |
| **Bloco de Estado** | ver [§5](#5-o-bloco-de-estado) | — | Inclui o interruptor "Gráfico" |
| Exibir valor | Interruptor + seletor de métrica numérica | placeholder "Sem métrica" | Sem métrica escolhida, exibe a métrica do estado |
| Exibir ícone | Interruptor + seletor de ícone ([§10](#10-biblioteca-de-ícones)) | — | Inclui "Cor do ícone" quando o ícone tem variantes |
| Largura / Altura | Dois campos numéricos lado a lado | mínimo 1 | Altura é piso |
| Drill-down | Interruptor + link ([§8.6](#86-drill-down)) | — | — |

---

### 4.2 Point

**O que é.** Âncora de roteamento: um ponto pequeno, sem texto, usado para
dobrar o caminho de uma conexão ou para ter **mais de uma conexão entre os mesmos
dois equipamentos** (duas conexões diretas entre o mesmo par não são permitidas;
passar por points contorna isso).

**Também tem estado.** Um caminho A → point → point → B são três conexões e dois
points que representam **um** enlace; todos costumam receber o mesmo vínculo (daí
a edição em massa).

**O que mostra:** o próprio ponto com o estado; lista de triggers ativas; um
handle de conexão. Sem nome próprio: o título do hover é o **host** vinculado.

**Formulário:** apenas o **Bloco de Estado** completo (incluindo "Gráfico").

---

### 4.3 Conexão

**O que é.** O enlace entre dois elementos conectáveis (Nó, Point, Imagem). Tem
**direção** (origem → destino), que importa para a animação de fluxo e pode ser
invertida.

**O que mostra:** a linha entre os dois elementos (ancorada no centro de cada um
e cortada na borda); um **rótulo** opcional no meio, que aceita várias linhas e
preserva espaços (dá para alinhar valores em coluna); o estado; e, quando há
alarme de trigger, um **chip de alarme** no meio da linha com o nome da maior
severidade e a contagem (ex.: `High ·3`). Passar o mouse no chip abre a lista de
incidentes.

**Formulário:**

| Campo | Tipo de controle | Opções / limites |
| --- | --- | --- |
| Estilo | Escolha única | Sólida · Tracejada · Pontilhada |
| Forma | Escolha única | Curva · Reta |
| Espessura | Controle deslizante | 1 a 10, passo 0,5 (padrão 2) |
| Rótulo | Editor de template ([§6](#6-textos-dinâmicos-templates)) | placeholder "Sem rótulo. Ex.: IN: ${traffic in}" |
| Animação | Seleção | Nenhuma · Dash-flow (tracejado correndo) · Flow (partículas percorrendo) · Pulse (respiração) |
| **Bloco de Estado** | [§5](#5-o-bloco-de-estado) | Sem animação "Radar" e sem "Gráfico" |

Enquanto a conexão está em alerta, a animação de alerta substitui a animação de
fluxo configurada.

**Menu de contexto da conexão:** Inverter direção · Excluir.

---

### 4.4 Imagem

**O que é.** Uma figura de tamanho livre: logo, foto de equipamento, ícone da
biblioteca em tamanho grande, peças de elevação de rack. **É conectável** como o
nó.

**O que mostra:** a figura (ou "Sem imagem"); uma **legenda** abaixo, com
template; um **fundo** opcional atrás da figura; o estado (só com fundo em modo
Estado); lista de triggers ativas; quatro handles; alças de redimensionamento
quando selecionada em modo de edição (mínimo 24 × 24).

**Formulário:**

| Campo | Tipo de controle | Opções / limites | Observação |
| --- | --- | --- | --- |
| Figura | Escolha única | Biblioteca · Arquivo ou URL | Trocar de modo aplica na hora e **guarda** o valor do outro modo na sessão |
| Ícone *(Biblioteca)* | Seletor de ícone + "Cor do ícone" | — | Ao entrar na Biblioteca sem escolha prévia, começa no primeiro ícone do pack Padrão |
| Imagem *(Arquivo ou URL)* | Upload de arquivo + campo de URL + miniatura + "Remover" | arquivo até **256 KB** | Ver mensagens em [§12](#12-mensagens-avisos-e-estados-vazios) |
| Ajuste | Escolha única | Conter · Cobrir · Esticar | Como a figura ocupa a caixa (Conter preserva proporção) |
| Texto | Editor de template | placeholder "Sem texto. Ex.: ${traffic in}" | Legenda abaixo da figura |
| Tamanho da fonte | Numérico | 8 a 72 px (padrão 12) | Da legenda |
| Background | Interruptor que revela: | | Ausente = sem fundo |
| ↳ Modo | Escolha única | Sólido · Estado | **Sólido** = identidade visual; **Estado** = o fundo passa a comunicar o estado |
| ↳ Cor | Seletor de cor | — | Só no modo Sólido |
| ↳ Opacidade | Controle deslizante | 0 a 1, passo 0,05 | Nos dois modos |
| ↳ Bloco de Estado | [§5](#5-o-bloco-de-estado) | — | Só no modo Estado. Inclui "Gráfico" |
| Drill-down | [§8.6](#86-drill-down) | — | — |

**Regra de produto:** sem fundo em modo Estado, a imagem não tem estado — a
figura em si nunca é alterada para comunicar alarme.

---

### 4.5 Postit

**O que é.** Retângulo de agrupamento ("Área Núcleo", "Filial Norte"). Sempre
**atrás** dos demais elementos. Estático: **não tem vínculo de dados** e não se
conecta.

**O que mostra:** a área retangular e um título opcional posicionado sobre um
dos quatro cantos da borda. Alças de redimensionamento quando selecionado em
modo de edição (mínimo 160 × 100).

**Formulário:**

| Campo | Tipo de controle | Opções / limites |
| --- | --- | --- |
| Título | Texto | — |
| Posição do título | Escolha única entre 4 cantos | Superior esquerdo · Superior direito · Inferior esquerdo · Inferior direito — só aparece com título preenchido |
| Cor | Seletor de cor | — |
| Opacidade | Controle deslizante | 0 a 1, passo 0,05 |
| Borda | Escolha única | Sólida · Tracejada · Pontilhada |
| Espessura da borda | Numérico | 0 a 10 px |

**Menu de contexto do postit:** Trazer para frente · Enviar para trás ·
Duplicar · Excluir (é o único com reordenação, porque é o único que se sobrepõe
aos outros).

---

### 4.6 Texto

**O que é.** Rótulo solto no canvas: títulos de área, legendas, notas.
Decorativo: **sem estado**, não se conecta (decisão de produto — um texto que
muda de cor sozinho parece erro de renderização).

**Formulário:**

| Campo | Tipo de controle | Opções / limites | Observação |
| --- | --- | --- | --- |
| Conteúdo | Escolha *Fixo / Field*; Fixo usa o editor de template de várias linhas | — | Aceita `${field}` |
| Cor | Seletor de cor | — | Cor fixa; nunca vem de dado |
| Background | Interruptor que revela cor + opacidade (0 a 1) | — | Fundo atrás do texto para separá-lo de um canvas carregado |
| Tamanho da fonte | Numérico | 8 a 72 px (padrão 14) | O tamanho do elemento deriva dele |
| Drill-down | [§8.6](#86-drill-down) | — | O próprio texto vira o link |

---

## 5. O bloco de Estado

Um bloco único, idêntico em Nó, Point, Conexão e Imagem (no modo de fundo
Estado). Responde a uma pergunta: **como este elemento decide o próprio estado?**

### 5.1 Fonte do estado

Primeiro campo, **Estado**: escolha única **Métrica | Trigger**.

- **Métrica** — observa o valor de uma série e aplica regras sobre ele.
- **Trigger** — observa os alarmes do Zabbix de um host.

Só uma fonte vale por vez. **Alternar preserva tudo**: a configuração do modo
inativo fica guardada e volta a valer ao alternar de novo, inclusive depois de
salvar e recarregar.

### 5.2 Modo Métrica — qual série observar

Duas formas de apontar a métrica; o formulário mostra uma de cada vez:

| Forma | Quando aparece | Campos |
| --- | --- | --- |
| **Campo** | Sem Zabbix direto, ou quando o usuário escolhe "Usar um campo da query" | Seletor de field numérico (placeholder "Sem vínculo") |
| **Host + Item** | Com Zabbix direto ligado (padrão nesse caso) | **Host**: busca no Zabbix, aceita valor digitado, limpável. **Item**: itens numéricos do host, aceita valor digitado; desabilitado até escolher host |

- Link de alternância: "Usar um campo da query" ↔ "Escolher host e item no
  Zabbix".
- **Trocar o host limpa o item.**
- Gravar uma forma **apaga** a outra (são dois nomes para a mesma série).
- Nas listas do Zabbix, cada host mostra também o nome técnico como descrição, e
  cada item mostra a chave.

### 5.3 Regras de métrica ("Thresholds")

Uma lista única que substitui, para este elemento, os mecanismos nativos de
thresholds e value mappings do Grafana. **É a única coisa que define o estado por
métrica.**

**"Adicionar regra"** abre um menu com cinco tipos:

| Tipo | Rótulo no menu | Descrição no menu | Condição | Campos |
| --- | --- | --- | --- | --- |
| threshold | Threshold | A partir de um valor | `valor ≥ X` | número |
| value | Valor | Valor exato | `valor = texto` | texto |
| range | Faixa | Entre dois valores | `De ≤ valor ≤ Até` | dois números |
| regex | Regex | Expressão regular | expressão casa com o valor | texto |
| special | Especial | Nulo, NaN, booleanos | caso especial | escolha: Nulo · NaN · Nulo + NaN · Verdadeiro · Falso · Vazio |

**Cada linha de regra tem:** cor (obrigatória) · condição · animação · remover.

**Ordem de avaliação = ordem exibida, reordenada automaticamente:** primeiro os
mapeamentos (valor, faixa, regex, especial) na ordem de criação; depois os
thresholds do maior para o menor. A primeira regra que casa vence.

**Defaults inteligentes:** o primeiro threshold nasce em 80; cada threshold
seguinte nasce 10 acima do maior existente e com o próximo degrau de uma escala
de gravidade; os demais tipos nascem com uma cor neutra informativa.

**Linha "Base"** ao pé da lista, sem remover: a cor de repouso, que vale quando
nenhuma regra casa (ou quando não há regra). Sem cor escolhida, o elemento fica
neutro.

**Lista vazia = sem estado por métrica = Base.** Não existe "passo base" dentro
da lista, nem modo percentual.

Ajuda contextual do bloco: "As regras daqui são as únicas que pintam o elemento —
o Thresholds do painel formata o valor, não a cor. Sem regra, vale a Base."
Aviso quando não há métrica escolhida: "Escolha uma métrica acima para as regras
terem efeito."

### 5.4 Modo Trigger — o vínculo

| Campo | Tipo de controle | Comportamento |
| --- | --- | --- |
| Host | Seleção com busca, aceita valor digitado, limpável | Lista hosts do catálogo do Zabbix (modo direto) ou dos dados atuais (modo padrão) |
| Trigger(s) | Lista de seleções com busca, uma por linha, aceita valor digitado | Relação **OU**: basta uma alarmar. Ver regras abaixo |
| + Adicionar trigger | Ação | Acrescenta uma linha |
| Remover (por linha) | Ação | Só aparece com 2+ linhas |
| Exibir triggers ativas | Interruptor (padrão **ligado**) | Mostra a lista de alarmes junto ao elemento |
| Formato da lista | Escolha única: **Lista · Total** | Só com a lista ligada. Ver [§8.3](#83-lista-de-triggers-ativas) |
| Posição da lista | Escolha única: **Acima · Abaixo · Esquerda · Direita** (padrão Abaixo) | Só com a lista ligada |

**Regras da lista de triggers:**

- **Lista vazia ou uma linha "Qualquer trigger do host"** = o elemento acende com
  qualquer problema do host. É o default de quem só escolhe o host.
- A opção "Qualquer trigger do host" **só existe com uma linha**; a partir da
  segunda ela sumiria com as outras escolhas.
- Linha em branco é rascunho e é ignorada.
- O rótulo do campo muda para o plural ("Triggers") com 2+ linhas.

Avisos do vínculo em [§12](#12-mensagens-avisos-e-estados-vazios).

### 5.5 Modo Trigger — a escada de severidades

Em vez do botão "Adicionar regra", o modo Trigger mostra **as seis severidades
fixas**, da mais grave à menos grave: Disaster, High, Average, Warning,
Information, Not classified. Cada linha:

- **caixa de seleção "atender"** — desmarcada, o elemento **ignora** alarmes
  daquele nível: não acende, não conta, não aparece na lista. A linha continua
  editável, só sinalizada como desligada. (Para silenciar ruído conhecido, como um
  parque cheio de *Information*.)
- **cor** — começa com a cor padrão do Zabbix para aquele nível;
- nome da severidade;
- **animação**.

Enquanto o usuário não mexe em nada, valem as cores padrão do Zabbix. A primeira
edição grava a escada inteira; a ação **"Restaurar padrão do Zabbix"** aparece a
partir daí e desfaz tudo de uma vez.

A linha **Base** também aparece no modo Trigger, com o mesmo significado (cor
quando não há alarme).

Regras de métrica e de severidade convivem guardadas: o modo inativo não as
apaga.

### 5.6 Animação por regra

Cada regra (de métrica ou de severidade) escolhe a própria animação de alerta:

| Opção | Significado |
| --- | --- |
| Parado | Sem movimento (padrão) |
| Pulsar | Pulsação de escala |
| Piscar | Respiração lenta de opacidade — **nunca** um pisca-pisca brusco |
| Radar | Ondas concêntricas saindo do elemento — indisponível na Conexão |

Exemplo de uso: `≥ 75` pulsa, `> 90` faz radar; *High* pulsa, *Disaster* faz
radar. Toda animação respeita a preferência de movimento reduzido do sistema e
congela durante o screenshot.

### 5.7 Gráfico no hover

Interruptor **"Gráfico"**, no fim do bloco, **só no modo Métrica** e só em Nó,
Point e Imagem. Ligado, o hover do elemento mostra a série da **mesma** métrica
que define o estado, na janela de tempo do dashboard. Não existe seletor de outra
métrica para o gráfico, de propósito. Aviso se não há métrica: "Sem métrica
escolhida, não há série para desenhar." Padrão: **desligado**.

### 5.8 Como o estado é resolvido

Cadeia de precedência, do mais forte ao mais fraco:

```
1. Trigger em alarme (modo Trigger)  → estado de ALARME, com severidade
       a cor vem da escada de severidades (customizada ou padrão)
2. Regra de métrica que casou (modo Métrica) → estado de REGRA
       se a métrica vinculada não tem dado → estado SEM DADOS
3. Cor Base escolhida                 → estado BASE
4. Nada configurado                   → estado NEUTRO
```

No modo Trigger, as regras de métrica são ignoradas por inteiro — um elemento
nunca mostra duas fontes ao mesmo tempo.

**Estados que o design precisa representar**, em cada elemento com estado:

| Estado | Quando | Carrega |
| --- | --- | --- |
| **Alarme** | Trigger em PROBLEM | cor da severidade, nome da severidade, lista de problemas, animação opcional |
| **Regra atingida** | Uma regra de métrica casou | cor da regra, rótulo opcional da regra, animação opcional |
| **Sem dados** | Há métrica vinculada, mas a série não existe ou o último valor é nulo (salvo se uma regra *Especial* tratar o nulo) | — (precisa ser distinguível de saudável e da Base) |
| **Base** | Nada acontecendo, cor de repouso escolhida | a cor da Base |
| **Neutro** | Sem vínculo e sem Base | — |

Além disso, ortogonais ao estado: **selecionado**, **origem de conexão em
andamento**, **alvo válido / inválido** durante uma conexão, **com drill-down**
(é um link), e **em captura** (screenshot).

**Severidade nos problemas:** quando vários problemas estão ativos, o estado
assume a **maior** severidade. A lista mostra todos.

**Casamento de host:** exato e sem diferenciar maiúsculas, contra o nome visível
**ou** o nome técnico do host. Nunca "contém" (`FW-01` não casa com `FW-011`).

---

## 6. Textos dinâmicos (templates)

Qualquer texto que aceita template pode misturar palavras e valores ao vivo:

```
IN:  ${ROUTER-01: traffic in}
OUT: ${ROUTER-01: traffic out}
Status: ${ROUTER-01: oper status}
```

**Onde há o editor de template completo:** conteúdo do Texto, rótulo da Conexão,
legenda da Imagem. (Os textos primário/secundário do Nó usam campo de uma linha
ou o modo *Field*, mas também resolvem `${...}` se digitado.)

**O editor de template tem:**

- área de texto de várias linhas (3 linhas por padrão);
- seletor **"Inserir métrica"**: escolher um field insere `${nome}` **na posição
  do cursor** (ou no fim, se o usuário ainda não clicou no texto); inserções em
  sequência ficam na ordem;
- aviso não bloqueante: "Sem correspondência nas séries: X, Y" quando um nome não
  existe nos dados.

**Resolução:**

- valor existente → formatado com unidade, casas decimais e value mappings do
  Grafana (o "200" pode virar "UP");
- field existe mas sem valor → "—";
- nome desconhecido → o `${...}` aparece cru, como foi escrito.

**Modo *Field*** (Texto, textos do Nó): em vez de template, exibe apenas o valor
formatado de um field escolhido.

---

## 7. Canvas: interações de edição

Tudo nesta seção vale no editor de painel e no dashboard com edição inline. Em
visualização pura nada disso responde (e nem o menu de contexto do navegador
aparece sobre o mapa).

### 7.1 Navegação

- Arrastar o fundo: mover a vista. Roda do mouse: zoom.
- Controles do canvas: **aproximar**, **afastar**, **enquadrar tudo**, e
  **baixar imagem** (screenshot, [§8.7](#87-screenshot)). Disponíveis também em
  visualização.
- Ao abrir, a vista enquadra a topologia inteira.

### 7.2 Criar elementos

Duas entradas:

1. **Menu de contexto no fundo do canvas** — o elemento nasce **sob o ponteiro**:
   Adicionar nó aqui · Adicionar point aqui · Adicionar postit aqui · Adicionar
   texto aqui · Adicionar imagem aqui.
2. **"Adicionar elemento"** no painel de opções — menu com Nó · Point · Postit ·
   Texto · Imagem. Nasce numa posição fixa (o painel de opções não sabe onde o
   usuário está olhando) e já **abre o formulário** do novo elemento.

Conexões não são criadas por esses menus: ver [§7.6](#76-conectar).

**Canvas vazio** (só em modo de edição) mostra uma dica que não intercepta
cliques: "Clique com o botão direito no canvas para adicionar elementos." / "Ou
use o botão "Adicionar elemento" no painel de opções, à direita."

### 7.3 Selecionar

- Clique seleciona um elemento ou uma conexão.
- **Ctrl/Cmd + clique** adiciona à seleção.
- **Shift + arrastar** no fundo: seleção por área.
- Clique no fundo limpa a seleção.
- A seleção **sobrevive** a edições (alterar um campo não desmarca nada).
- Sincronia com o painel de opções: ver [§9.1](#91-seção-layer).

### 7.4 Mover

- Arrastar move o elemento (ou todos os selecionados).
- Com "Alinhar ao grid" ligado, a posição prende no grid.
- A gravação acontece quando o gesto termina (sem gravar a cada pixel).

### 7.5 Redimensionar

- **Postit e Imagem**: alças no canvas, visíveis só com o elemento selecionado.
- **Nó**: pelos campos Largura/Altura do formulário.
- **Texto**: pelo tamanho da fonte. **Conexão**: pela espessura.

### 7.6 Conectar

Duas formas:

1. **Arrastar de um handle** de um elemento até outro elemento. Qualquer handle
   liga a qualquer handle.
2. **Modo "Linkar"** pelo menu de contexto de um elemento:
   - a origem fica destacada como em foco;
   - uma **linha fantasma** segue o ponteiro;
   - cada elemento indica se é **alvo válido** ou **inválido**;
   - o cursor muda para indicar o modo;
   - clicar num alvo válido cria a conexão, que já nasce **selecionada** (o
     formulário dela abre);
   - **Esc**, clique no fundo ou botão direito cancelam;
   - durante o modo, arrastar e selecionar por área ficam desligados.

**Regras de conexão:**

- só Nó, Point e Imagem se conectam;
- nunca a si mesmo;
- **no máximo uma conexão entre o mesmo par**, em qualquer direção (para enlaces
  paralelos, usar points intermediários).

### 7.7 Menu de contexto

O cabeçalho do menu mostra o identificador do alvo.

| Alvo | Itens |
| --- | --- |
| Fundo do canvas | Adicionar nó / point / postit / texto / imagem aqui |
| Nó, Point, Imagem | Linkar · Duplicar · — · Excluir |
| Postit | Trazer para frente · Enviar para trás · Duplicar · — · Excluir |
| Texto | Duplicar · — · Excluir |
| Conexão | Inverter direção · — · Excluir |

Não existe "Copiar/Colar" (ver [§14](#14-lacunas-conhecidas)).

### 7.8 Duplicar, excluir, reordenar, inverter

- **Duplicar**: cópia completa (vínculos, regras, tudo), deslocada levemente na
  diagonal, por cima dos demais, com novo identificador.
- **Excluir**: remove o elemento **e todas as conexões dele**.
- **Reordenar**: só postits (frente/trás entre si). Os demais tipos têm camadas
  fixas: postits sempre atrás, conexões numa faixa própria, os outros por cima.
- **Inverter direção**: troca origem e destino de uma conexão.

### 7.9 Teclado

| Tecla | Ação |
| --- | --- |
| Delete / Backspace | Exclui o que está selecionado (modo de edição) |
| Esc | Cancela o modo Linkar; solta o painel de hover fixado |
| Ctrl/Cmd + clique | Seleção múltipla |
| Shift + arrastar | Seleção por área |
| Tab | Alcança elementos com drill-down (são links) |

---

## 8. Superfícies de leitura

O que o operador vê e usa, inclusive no telão.

### 8.1 Estado do elemento

Cada elemento com estado comunica os estados de [§5.8](#58-como-o-estado-é-resolvido),
mais a animação da regra/severidade que casou. Requisito: legível à distância,
sem interação.

**Ícones e estado.** O ícone do nó acompanha o estado conforme a natureza dele
([§10](#10-biblioteca-de-ícones)): alguns mudam junto com o estado, outros são
figuras fixas e o estado é comunicado pela superfície do elemento.

### 8.2 Indicador de valor do Nó

Precedência do que aparece:

1. Métrica vinculada sem dado → **"no data"** (sempre, mesmo com "Exibir valor"
   desligado — é um aviso sobre o vínculo).
2. Regra casou + "Exibir valor" ligado → o **rótulo da regra**, se houver; senão
   o valor formatado.
3. Regra casou + "Exibir valor" desligado → nenhum texto; só a indicação de
   estado.
4. Sem estado + "Exibir valor" ligado → o valor formatado ("—" sem valor).

No modo Trigger o indicador **não** mostra a severidade (isso é papel da lista de
triggers ativas).

### 8.3 Lista de triggers ativas

Fica **fixa junto ao elemento** (Nó, Point, Imagem), do lado escolhido. Não
captura o mouse: arrastar e conectar continuam pertencendo ao elemento.

| Formato | Conteúdo |
| --- | --- |
| **Lista** (padrão) | Até **3 linhas**, uma por trigger em alarme, cada uma marcada com a sua severidade; o excedente vira "+N outras". Nome cortado no fim, uma linha por trigger |
| **Total** | Uma linha só: "N incidentes ativos", marcada com a maior severidade. Os nomes ficam no tooltip nativo e no hover |

Ordem: severidade decrescente, depois nome (estável entre atualizações — a lista
não se reordena sob o olho de quem lê).

Na Imagem, quando a lista fica abaixo, ela empilha sob a legenda.

### 8.4 Chip de alarme da Conexão

A conexão não tem lista lateral. Em alarme de trigger mostra um chip no meio da
linha (abaixo do rótulo, se houver) com a maior severidade e, havendo mais de
um, a contagem (`High ·3`). O chip é o gatilho do hover da conexão.

### 8.5 Painel de hover

Um painel por elemento. O conteúdo depende da situação:

| Situação | Conteúdo |
| --- | --- |
| Trigger em alarme | **Lista de incidentes** |
| Modo Métrica com "Gráfico" ligado | **Gráfico da métrica** |
| Nenhum dos dois | Sem painel |

**Lista de incidentes:** cabeçalho com o título (nome do nó; para Point, Imagem
e Conexão, o host) e a contagem ("1 problema ativo" / "N problemas ativos"). Uma
linha por problema: severidade · nome da trigger · idade ("agora", "há 4m",
"há 2h", "há 3d").

**Gráfico:** cabeçalho com o nome da métrica e o valor atual formatado; série
temporal na janela de tempo do dashboard, sem legenda. Mensagens quando não dá
para desenhar: "Nenhuma métrica vinculada a este elemento." · "A métrica não está
nas séries deste painel." · "A série não tem coluna de tempo — o gráfico precisa
de uma." Os thresholds/value mappings nativos do Grafana valem dentro do gráfico.

**Gatilho:**

| Gesto | Visualização | Edição |
| --- | --- | --- |
| Passar o mouse | Abre | Abre |
| Clicar | **Fixa** o painel (só a lista de incidentes, e só se o elemento não tem drill-down) | Seleciona o elemento (não fixa) |
| Esc / clique fora | Solta | — |
| Arrastar | — | Painel some durante o arraste |

### 8.6 Drill-down

Disponível em **Nó, Imagem e Texto**. O elemento inteiro vira um link real:
Ctrl+clique e clique do meio abrem em outra aba, o endereço aparece antes do
clique, é alcançável por teclado e anunciado como link.

**Formulário (interruptor "Drill-down"):**

| Campo | Comportamento |
| --- | --- |
| Link | Caminho deste Grafana (`/d/uid/...`) ou endereço externo. Aceita variáveis do dashboard (`?var-host=$host`), resolvidas **no instante do clique**. Placeholder: "https://zabbix.corp/tr_events.php  ou  /d/uid/detalhe" |
| Pré-visualização | Linha mostrando o destino já resolvido: "Abre neste Grafana: …" ou "Sai do Grafana para: …". Endereço sem esquema ganha `https://` automaticamente, e a linha mostra isso |
| Abrir em nova aba | Interruptor (padrão desligado = mesma aba; ligado é o recomendado para telão) |
| Nota permanente | "No editor de painel o clique seleciona o elemento; o link só abre no dashboard." |

Caminho interno navega dentro do Grafana sem recarregar a página.

### 8.7 Screenshot

Botão nos controles do canvas ("Baixar imagem da topologia").

- Exporta **a topologia inteira** (não só o que está visível), com margem para
  que legendas e listas laterais não sejam cortadas.
- Densidade 2×; o lado maior é limitado a 4096 px (a densidade cai em vez de
  cortar).
- Animações **congelam** durante a captura.
- Nome do arquivo: `<titulo-do-painel>-AAAA-MM-DD-HHMM.png` (título sem acentos;
  "topoflow" se o painel não tem título).
- Desabilitado com canvas vazio ("Nada para capturar"); indicador de progresso
  durante a captura.
- Falha gera notificação: "Não foi possível gerar a imagem da topologia" + causa
  provável (imagens hospedadas em outro domínio).

---

## 9. Painel de opções

### 9.1 Seção Layer

A lista de todos os elementos e o formulário de cada um.

**Estrutura atual:**

1. *(quando há seleção múltipla)* bloco de **edição em massa** no topo
   ([§9.2](#92-edição-em-massa));
2. botão **"Adicionar elemento"** (menu: Nó, Point, Postit, Texto, Imagem);
3. **lista de elementos**, agrupada por tipo, na ordem Nó → Point → Postit →
   Texto → Imagem; vazia: "Nenhum elemento ainda.";
4. **Conexões**, seção própria; vazia: "Arraste de um handle a outro no canvas
   para conectar.".

**Cada linha da lista** tem: expandir/recolher · ícone do tipo · nome · Duplicar
(exceto conexões) · Excluir. Expandida, mostra o formulário do elemento. Só uma
linha aberta por vez.

**Nome exibido na linha:**

| Tipo | Nome |
| --- | --- |
| Nó | Texto primário fixo, ou o identificador |
| Point | "Point 1", "Point 2"… |
| Postit | Título, ou o identificador |
| Texto | Conteúdo fixo, ou o identificador |
| Imagem | Legenda (template cru), ou o identificador |
| Conexão | "Nome da origem → Nome do destino" |

**Sincronia com o canvas:**

- selecionar **um** elemento no canvas abre o formulário dele e destaca a linha,
  rolando a lista até ela;
- selecionar **vários** fecha o formulário individual e destaca todas as linhas;
- clicar no fundo do canvas **não** fecha o formulário aberto;
- abrir uma linha seleciona o elemento no canvas e **centraliza** a vista nele,
  com transição;
- sem o canal de sincronia (fora de contexto de dashboard), cada lado funciona
  isolado.

### 9.2 Edição em massa

Aparece quando há **2+ conexões** e/ou **2+ points** selecionados. Selecionando
os dois tipos, aparecem dois blocos. Outros tipos na seleção ficam de fora, e o
cabeçalho diz quantos estão sendo editados.

**Cabeçalho:** "N conexões selecionadas" / "N points selecionados" + "Cada campo
alterado vale para todos."

**Regra central:** só o campo que o usuário mexe é gravado, em todos os
selecionados. Mudar a espessura de quatro conexões não apaga os rótulos
diferentes de cada uma.

**Valores divergentes:** o campo fica vazio e o rótulo mostra "valores
diferentes" (nunca exibe o valor do primeiro como se fosse de todos). O controle
deslizante de espessura parte do **menor** valor.

| Bloco | Campos |
| --- | --- |
| Conexões | Estilo · Forma · Espessura · Rótulo (substitui o de todas; placeholder "Rótulos diferentes" quando divergem) · Animação (placeholder "Animações diferentes") · Bloco de Estado (sem radar, sem gráfico) |
| Points | Bloco de Estado (com gráfico) |

**Bloco de Estado em massa:** parte da configuração do **primeiro** selecionado
e, ao ser alterado, é aplicado por inteiro a todos. Nota exibida:

- selecionados divergentes: "Os selecionados não têm a mesma configuração de
  estado. O bloco abaixo parte do primeiro e é aplicado por inteiro aos N.";
- selecionados iguais: "O bloco abaixo é aplicado por inteiro aos N."

Ao surgir ou crescer, o bloco em massa é trazido para a área visível.

### 9.3 Seção Zabbix

| Campo | Tipo | Comportamento |
| --- | --- | --- |
| Consultar o Zabbix diretamente | Interruptor (padrão desligado) | Descrição: "Desligado, o painel usa apenas as queries do dashboard — o comportamento padrão. Ligado, o editor sugere hosts e triggers do Zabbix e o painel busca os próprios dados." |
| Datasource do Zabbix | Seletor de datasource filtrado a Zabbix, limpável | Só com o interruptor ligado. Vazio + exatamente um Zabbix na instância = adotado automaticamente (o nome dele aparece como sugestão). Aceita variável de datasource |

Nota exibida quando há Zabbix: "O painel executa a própria query de Problems
para os hosts vinculados, sem depender das queries do dashboard." Alertas para
"nenhum Zabbix" e "mais de um Zabbix sem escolha" em [§12](#12-mensagens-avisos-e-estados-vazios).

### 9.4 Seção Canvas

| Campo | Tipo | Padrão | Observação |
| --- | --- | --- | --- |
| Mostrar grid | Interruptor | ligado | — |
| Alinhar ao grid | Interruptor | ligado | "Prende os elementos ao grid ao arrastar." |
| Tamanho do grid | Controle deslizante 4–64, passo 2 | 16 | Só se grid ou alinhamento estiver ligado |
| Edição inline | Interruptor | desligado | "Permite editar a topologia direto no dashboard. No editor de painel a edição está sempre ligada." |

### 9.5 Seções nativas do Grafana

Unidade, casas decimais, mín/máx, thresholds, value mappings e overrides do
Grafana **continuam disponíveis** e servem para:

- **formatar** valores exibidos (indicador do nó, templates, campos *Field*,
  cabeçalho do gráfico) — ex.: um value mapping troca "200" por "UP";
- **colorir o gráfico** do hover.

Eles **não** definem o estado do elemento — isso é só do bloco de regras do
próprio elemento. Isso precisa ficar claro na interface (hoje é dito na ajuda do
bloco de regras).

---

## 10. Biblioteca de ícones

Usada no ícone do Nó e na figura da Imagem (modo Biblioteca).

### Packs

| Pack | Nome exibido | Quantidade | Comportamento com o estado |
| --- | --- | --- | --- |
| `topoflow` | **Padrão** | 11 | **Variantes**: cada ícone existe em várias versões de tom; troca de versão conforme o estado |
| `classic` | **Clássicos** | 10 | **Glifo**: desenho monocromático que assume a cor do estado |
| `zabbix` | **Zabbix** | 44 | **Figura**: cores próprias, não muda com o estado |
| `petrolifera` | **Petrolífera** | 11 | **Figura** |

Conteúdo de cada pack:

- **Padrão:** Roteador, Servidor, Firewall, Switch, Hub, Wi-Fi, Internet, Banco
  de dados, Impressora, Câmera, Círculo.
- **Clássicos:** Servidor, Switch, Roteador, Firewall, Load balancer, Access
  point, Banco de dados, Storage, Nuvem, Genérico (o fallback).
- **Zabbix:** o conjunto completo dos mapas do Zabbix — roteador, roteador
  (símbolo), roteador cripto (e símbolo), switch, hub, firewall, modem, AP, placa
  de rede, rede, nuvem, satélite, antena de satélite, servidor, servidor Zabbix
  (2D/3D), SAN, array de discos (2D/3D), rack 42U (com e sem porta), servidores
  de rack 1U a 5U (2D/3D), no-break, no-break de rack (2D/3D), estação de
  trabalho, notebook, terminal de vídeo, impressora, telefone, PABX IP (e
  símbolo), PABX, casa. As peças de rack são tiras largas pensadas para a
  Imagem (empilhar uma elevação de rack), não para o ícone do nó.
- **Petrolífera:** Sonda, Sonda de fraturamento, Estação, Religador, Sensor de
  temperatura, Torre, Rádio Cambium, UniFi AC Lite, UniFi AC Pro, UniFi AC Mesh,
  UniFi AC Mesh Pro.

### Seletor de ícone

- No formulário: um campo que mostra o ícone atual e o nome; clicar abre o
  **navegador de ícones**.
- **Navegador** ("Escolher ícone"):
  - busca no topo (placeholder "Buscar por nome — servidor, switch, wifi…"),
    sem diferenciar acentos nem maiúsculas, procurando em nome, chave e
    sinônimos (inclusive em inglês);
  - **coluna de pastas**: "Todos os ícones" + cada pack, cada uma com a contagem;
    sempre visível;
  - **grade** de ícones com nome; o escolhido fica marcado;
  - escolha **imediata** no clique (fecha o navegador; sem botão de confirmar);
  - abre na pasta do ícone atual, ou no pack Padrão se não há escolha;
  - busca sem resultado: "Nenhum ícone para "X" nesta pasta." + atalho "Há N em
    outras pastas" que leva a "Todos os ícones".
- **Cor do ícone** (só para ícones com variantes): escolha única entre **"Pelo
  estado"** (padrão — acompanha o estado) e cada variante fixa que o ícone
  oferece, apresentadas como miniaturas do próprio ícone.
- Chave desconhecida (ícone removido) cai no **Genérico**; o nó nunca some.

---

## 11. Integração com o Zabbix

### 11.1 Modo padrão (interruptor desligado)

- Métricas vêm das queries do dashboard, de qualquer datasource.
- Triggers vêm de uma query do datasource Zabbix em modo **Problems**, criada
  pelo usuário no editor de queries do painel.
- Os combos de host e trigger listam **só o que está nos dados agora**: um host
  sem problema ativo não aparece (por isso os combos aceitam valor digitado e
  "host desconhecido" é aviso, não erro).

### 11.2 Modo direto (interruptor ligado)

Um interruptor faz duas coisas ao mesmo tempo:

1. **O editor passa a sugerir o catálogo do Zabbix**: todos os hosts, triggers e
   itens numéricos, com busca. O que veio dos dados e não voltou da API continua
   escolhível.
2. **O painel busca os próprios dados**, sem query no dashboard:
   - uma única consulta de Problems para o mapa inteiro;
   - uma consulta de métrica por host, com os itens daquele host — incluindo
     qualquer `${host: item}` mencionado em textos, rótulos, legendas e em
     "Exibir valor";
   - os problemas **não** ficam presos à janela de tempo do dashboard (um alarme
     de 8 horas atrás continua visível com o dashboard em "últimas 6 horas");
   - unidade, decimais e value mappings do painel continuam valendo.

**Seletores de field do editor com o modo ligado** ("Inserir métrica", "Exibir
valor", modo *Field*) oferecem, nesta ordem: o que já está vinculado no mapa → o
que veio das queries do dashboard → o catálogo de itens numéricos dos hosts do
mapa (carregado ao abrir o seletor).

**Convivência:** com o modo ligado, problemas vindos de uma query do dashboard
**cedem lugar** aos do painel (senão cada alarme contaria duas vezes). Séries de
métrica do dashboard continuam valendo.

### 11.3 Atualização e falhas

- Atualiza no refresh do dashboard (botão ou intervalo automático), ao mudar a
  janela de tempo e ao mudar os vínculos.
- Falha ao atualizar **preserva o último estado** e mostra um aviso no topo do
  painel.
- Falha no catálogo do editor: os combos voltam a listar o que está nos dados,
  com aviso no formulário; digitar à mão continua valendo.
- Respostas do catálogo são reaproveitadas por 30 segundos; a busca espera a
  digitação parar.

### 11.4 O que o modo direto não cobre

Transformações e alerting do Grafana não se aplicam aos dados buscados pelo
painel; o Query Inspector não mostra essas consultas; snapshots do dashboard não
congelam esses dados.

---

## 12. Mensagens, avisos e estados vazios

Inventário de toda a comunicação com o usuário. Tipos: **erro**, **aviso**
(não bloqueia), **info**, **nota** (texto auxiliar), **vazio**.

### Painel (sobre o canvas)

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| Opções salvas inválidas | aviso | "Opções inválidas, usando defaults" + lista dos problemas encontrados |
| … e a topologia é a parte inválida | aviso | "A topologia salva continua no JSON do painel e não será sobrescrita: a edição fica desligada até o problema abaixo ser corrigido em Panel JSON." |
| Modo direto falhou ao atualizar | aviso | "Não foi possível atualizar os problemas do Zabbix" + "{erro} O mapa continua mostrando o último estado recebido." |
| Canvas vazio em edição | vazio | "Clique com o botão direito no canvas para adicionar elementos." / "Ou use o botão "Adicionar elemento" no painel de opções, à direita." |
| Imagem sem figura | vazio | "Sem imagem" |
| Nó com métrica sem dado | estado | "no data" |
| Trigger sem descrição | dado | "Trigger sem descricao" |

### Layer

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| Topologia salva inválida | erro | Explica que a topologia não é válida, que deve ser corrigida em Panel JSON e que a edição fica desligada para não sobrescrever o que está salvo |
| Sem elementos | vazio | "Nenhum elemento ainda." |
| Sem conexões | vazio | "Arraste de um handle a outro no canvas para conectar." |

### Vínculo de trigger

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| Sem query de Problems e sem modo direto | info | "Nenhuma query de Problems neste painel" + "Adicione uma query com Query Mode Problems no editor de queries do painel para vincular triggers — ou ligue Consultar o Zabbix diretamente nas opções do painel." |
| Falha ao consultar o catálogo | aviso | "Não foi possível consultar o Zabbix" + "{erro} As sugestões abaixo vêm apenas das queries do painel." |
| Host digitado não aparece nos dados | aviso | "Host sem correspondência nos dados. Confira o nome, ou ele simplesmente não tem problema ativo agora." |
| Combos | textos | "Selecione ou digite o host" · "Qualquer trigger do host" · "Selecione ou digite a trigger" · "Usar este nome de host" · "Usar esta descrição de trigger" · "Nenhum host encontrado" / "Nenhum host nos dados" · "Nenhuma trigger encontrada" / "Nenhuma trigger nos dados" |

### Vínculo de métrica

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| Falha ao consultar o catálogo | aviso | "Não foi possível consultar o Zabbix" + "{erro} Você ainda pode digitar o host e o item à mão." |
| Combos | textos | "Selecione ou digite o host" · "Selecione ou digite o item" · "Escolha o host primeiro" · "Nenhum item numérico neste host" · "Usar este nome de item" · "Sem vínculo" |
| Regras sem métrica | nota | "Escolha uma métrica acima para as regras terem efeito." |
| Gráfico sem métrica | nota | "Sem métrica escolhida, não há série para desenhar." |

### Seção Zabbix

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| Nenhum Zabbix instalado | info | "Nenhum datasource Zabbix nesta instância" + explicação de que os combos continuam listando o que estiver nas queries |
| Vários Zabbix, nenhum escolhido | info | "Há mais de um Zabbix nesta instância" + "Escolha um para o editor sugerir hosts e triggers…" |

### Templates, upload, screenshot

| Quando | Tipo | Mensagem |
| --- | --- | --- |
| `${nome}` sem correspondência | aviso | "Sem correspondência nas séries: {nomes}" |
| Arquivo acima de 256 KB | erro | "A imagem tem {X} KB e o limite é 256 KB. Use uma imagem menor ou cole a URL de uma imagem hospedada." |
| Arquivo ilegível | erro | "Não foi possível ler o arquivo." |
| Campo de URL após upload | placeholder | "Arquivo enviado — cole uma URL para substituir" (o dado embutido não é exibido no campo) |
| Screenshot falhou | erro | "Não foi possível gerar a imagem da topologia" + causa provável |

### Ajudas contextuais (atrás de um ícone de informação)

Os rótulos de vários campos têm uma explicação curta acessível por um ícone de
informação, nunca no corpo do formulário. Exemplos: Estado, Host, Trigger(s),
Exibir triggers ativas, Formato da lista, Posição da lista, Campo, Item,
Thresholds, Gráfico, Exibir valor, Drill-down, Link, Abrir em nova aba, Figura,
Ajuste, Texto da imagem, Imagem, Background, Rótulo da conexão.

---

## 13. Regras de negócio a preservar

Comportamentos que não aparecem como botão mas fazem o produto funcionar.

1. **Topologia corrompida nunca é sobrescrita.** O painel avisa e tranca a edição
   até a correção manual.
2. **Seções independentes.** Configuração inválida do canvas (grid) não derruba o
   desenho, e vice-versa.
3. **Conexão órfã ou duplicada é descartada**, não derruba a topologia.
4. **Elemento novo nasce sem cor e sem vínculo.**
5. **Sem regra = Base**, nunca "saudável" por omissão.
6. **Sem dados ≠ saudável ≠ Base.**
7. **Uma fonte de estado por vez**; a outra fica guardada.
8. **Interruptor opcional apaga ao desligar** (texto secundário, exibir valor,
   fundo, drill-down): ausente significa desligado.
9. **Edição em massa só escreve o campo tocado.**
10. **Ordem estável nas listas de alarme** (severidade, depois nome).
11. **Casamento de host exato** (nome visível ou técnico, sem diferenciar
    maiúsculas), nunca parcial.
12. **Severidade desligada some de tudo**: cor, contagem e lista.
13. **Variáveis do drill-down resolvem no clique**, não ao salvar.
14. **Campos numéricos deixam digitar** valores intermediários fora da faixa e só
    gravam valores válidos; ao sair do campo, voltam ao último valor válido.
15. **Seleção sobrevive às edições.**
16. **Degradação graciosa do Zabbix**: sem permissão, fora do ar ou ausente, tudo
    volta ao modo padrão com um aviso, nunca com erro dentro do controle.

---

## 14. Lacunas conhecidas

O que **não existe** hoje (útil para decidir se a v2 deve prever espaço para
isso). Nada aqui é funcionalidade atual.

| Lacuna | Situação |
| --- | --- |
| Copiar / colar no canvas | Não existe; usa-se Duplicar |
| Desfazer / refazer próprio | Depende do dashboard do Grafana |
| Ver as triggers configuradas que estão **OK** | Pendente; hoje só se vê o que está em alarme |
| Vínculo de trigger por ID (sobreviver a renomeação da trigger no Zabbix) | Planejado |
| Escolher qual query de Problems um elemento usa | O dado existe no modelo, sem campo na interface |
| **Rótulo da regra** (texto exibido no lugar do valor quando a regra casa) | Existe no modelo e é exibido no indicador do nó, mas **não há campo para editá-lo** hoje |
| Threshold em modo percentual | Não existe |
| Biblioteca de imagens enviadas no nível do painel (reusar o mesmo upload em vários elementos) | Aprovado, não implementado |
| Colisão de rótulos de conexão | Rótulos podem se sobrepor |
| Animação de alerta por métrica com critério próprio | Hoje a animação é escolhida regra a regra |
| Marcar problema como reconhecido / link direto para o problema no Zabbix | Fora de escopo |
| Lista de triggers ativas na Conexão | Descartado (usa o chip) |

---

## 15. Checklist de cobertura para o mockup

Para a v2 ter paridade funcional com a v1.3, o mockup deve contemplar:

**Canvas**
- [ ] Canvas vazio em modo de edição, com orientação de como começar
- [ ] Os seis tipos de elemento, cada um nos estados: Alarme (por severidade), Regra atingida, Sem dados, Base, Neutro
- [ ] Animações de alerta: pulsar, piscar, radar (e ausência)
- [ ] Nó com: ícone ligado/desligado, texto secundário, indicador de valor (valor, "no data", só estado), nome longo quebrando linha
- [ ] Lista de triggers ativas nos quatro lados, nos formatos Lista (com "+N outras") e Total
- [ ] Conexão: estilos, formas, rótulo de várias linhas, animações de fluxo, chip de alarme
- [ ] Imagem: biblioteca, upload, URL, sem figura, legenda, fundo sólido e fundo de estado
- [ ] Postit com título nos quatro cantos; texto com e sem fundo
- [ ] Seleção simples, múltipla e por área; alças de redimensionamento
- [ ] Handles de conexão; arraste de conexão
- [ ] Modo Linkar: origem, linha fantasma, alvos válidos e inválidos
- [ ] Menus de contexto: fundo, nó/point/imagem, postit, texto, conexão
- [ ] Controles: aproximar, afastar, enquadrar, baixar imagem (normal, desabilitado, capturando)
- [ ] Painel de hover: lista de incidentes (aberto e fixado) e gráfico (com dado e com cada mensagem de vazio)
- [ ] Elemento com drill-down (é um link)
- [ ] Avisos no topo do painel: opções inválidas, falha do Zabbix

**Painel de opções**
- [ ] Layer: botão de adicionar, lista agrupada, linha destacada pela seleção, linha expandida, conexões, estados vazios
- [ ] Formulário de cada tipo: Nó, Point, Conexão, Imagem, Postit, Texto
- [ ] Bloco de Estado em modo Métrica: Campo; Host + Item; alternância entre os dois
- [ ] Regras de métrica: menu de tipos, as cinco formas de condição, animação, remover, linha Base
- [ ] Bloco de Estado em modo Trigger: host, várias triggers, "Qualquer trigger do host", opções da lista ativa
- [ ] Escada de severidades com nível desligado e "Restaurar padrão do Zabbix"
- [ ] Interruptor Gráfico; Exibir valor
- [ ] Editor de template com "Inserir métrica" e aviso de correspondência
- [ ] Drill-down com pré-visualização do destino
- [ ] Upload de imagem: miniatura, remover, URL, erro de tamanho
- [ ] Navegador de ícones: pastas, busca, grade, vazio com atalho; "Cor do ícone"
- [ ] Edição em massa: conexões, points, os dois juntos, "valores diferentes", nota de semente
- [ ] Seção Zabbix: ligado/desligado, datasource automático, nenhum Zabbix, vários Zabbix
- [ ] Seção Canvas: grid, alinhamento, tamanho do grid, edição inline
- [ ] Todos os avisos de vínculo listados em [§12](#12-mensagens-avisos-e-estados-vazios)

**Modos**
- [ ] O mesmo mapa em editor de painel, em visualização (telão) e com edição inline
