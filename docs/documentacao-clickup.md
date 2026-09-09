# TopoFlow

Plugin de painel do Grafana que desenha mapas de topologia editáveis dentro do
próprio dashboard.

## Resumo

O TopoFlow substitui o mapa de rede feito em ferramenta externa (Visio, Draw.io,
mapa do Zabbix) por um desenho que vive no dashboard e muda de cor sozinho
conforme o estado dos equipamentos.

Você desenha a rede no canvas, vincula cada elemento a uma métrica ou a uma
trigger do Zabbix, e o mapa passa a mostrar o que está no ar e o que caiu, sem
precisar de clique ou hover. Foi feito para telão de NOC.

| | |
| --- | --- |
| Tipo | Panel plugin (frontend, sem backend) |
| ID | `jlcp-topoflow-panel` |
| Versão atual | 1.1.0 |
| Requer | Grafana 12.3.0 ou superior |
| Assinatura | não assinado (precisa de liberação no `.ini`) |

Os dados que pintam o mapa não vêm da API do Zabbix: entram pelo Query Editor
normal do painel, usando o datasource `grafana-zabbix` em Query Mode *Problems*,
e o plugin apenas lê o resultado.

## Principais funcionalidades

**Desenho**

* Seis tipos de elemento: nó, conexão, âncora de roteamento, retângulo de
  agrupamento, texto e imagem.
* Criar, arrastar, redimensionar, duplicar e conectar por menu de contexto no
  canvas ou pelo painel de camadas.
* Seleção múltipla com edição em massa (configura vários elementos de uma vez).
* Biblioteca de ícones pronta, organizada em pastas, mais upload de imagem
  própria.

**Estado**

* Modo Métrica: regras de cor por elemento (a partir de X, valor exato, faixa,
  regex e casos especiais como nulo ou vazio).
* Modo Trigger: cor por severidade do Zabbix, com severidades que podem ser
  desligadas para não poluir o mapa com ruído conhecido.
* Lista das triggers em PROBLEM fixa ao lado do elemento, então o telão mostra o
  que caiu sem ninguém tocar na tela.
* Animação de alerta por regra: pulsar, piscar ou radar.
* "Sem dado" é visualmente diferente de "tudo certo", de propósito.

**Leitura**

* Hover mostra o gráfico da métrica ou a tabela de incidentes.
* Drill-down: clique no elemento leva a outro dashboard, com as variáveis
  resolvidas na hora do clique.
* Exportar a topologia como PNG.

## Deploy

Procedimento completo. O arquivo é o `jlcp-topoflow-panel-1.1.0.zip`.

**1. Subir o zip por SFTP**

Envie o arquivo para qualquer pasta temporária do servidor, por exemplo `/tmp`.

**2. Mover para a pasta de plugins e descompactar**

```bash
cd /var/lib/grafana/plugins
sudo mv /tmp/jlcp-topoflow-panel-1.1.0.zip /var/lib/grafana/plugins/
sudo unzip jlcp-topoflow-panel-1.1.0.zip -d /var/lib/grafana/plugins/
sudo chown -R grafana:grafana /var/lib/grafana/plugins/jlcp-topoflow-panel
```

O zip já traz a pasta `jlcp-topoflow-panel/` dentro dele, então o resultado tem
que ser `/var/lib/grafana/plugins/jlcp-topoflow-panel/module.js`. Se os arquivos
ficarem soltos direto em `plugins/`, o Grafana não acha o plugin.

**3. Ajustar o `.ini`**

Em `/etc/grafana/grafana.ini`, libere o plugin (ele não é assinado):

```ini
[plugins]
allow_loading_unsigned_plugins = jlcp-topoflow-panel
```

Se a linha já existir com outros plugins, acrescente separando por vírgula.
Nunca use curinga: isso desligaria a verificação de assinatura para tudo.

**4. Reiniciar o Grafana**

```bash
sudo systemctl restart grafana-server
```

Obrigatório. O Grafana só lê o `plugin.json` na inicialização.

**5. Conferir**

Vá em *Administration > Plugins*, filtre por *Panel* e procure "TopoFlow". Tem
que aparecer com a versão 1.1.0 e um aviso de plugin sem assinatura, que é o
esperado.

Se não aparecer:

```bash
sudo journalctl -u grafana-server -n 100 | grep -i plugin
```

| Mensagem | Causa |
| --- | --- |
| `plugin ... is unsigned` | faltou o passo 3 ou não reiniciou |
| nada no log sobre o plugin | descompactou sem a pasta, veja o passo 2 |
| `requires Grafana version >= ...` | Grafana abaixo da 12.3.0 |
| erro de permissão | o dono da pasta não é o usuário `grafana` |
