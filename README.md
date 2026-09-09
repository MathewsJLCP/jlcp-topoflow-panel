# TopoFlow — painel de topologia para Grafana

`jlcp-topoflow-panel` · plugin de **painel**, frontend puro, sem backend.

Mapas de topologia editáveis dentro do dashboard: nós, conexões, âncoras,
agrupamentos, textos e imagens, cada um podendo se vincular a uma métrica ou a
uma trigger do Zabbix. Feito para telão de NOC.

A descrição voltada ao usuário final — a que o Grafana exibe na página do plugin
— está em [`src/README.md`](src/README.md).

## Documentação

Toda em [`docs/`](docs/README.md). Se você tem pouco tempo, comece por
[armadilhas do Grafana](docs/05-armadilhas-grafana.md): é o único conteúdo ali
que não existe na documentação oficial, e o que consumiu a maior parte do tempo
de desenvolvimento da v1.0.

| | |
| --- | --- |
| [01 — Visão geral](docs/01-visao-geral.md) | arquitetura, fluxo de dados, mapa dos diretórios |
| [02 — Modelo e persistência](docs/02-modelo-e-persistencia.md) | Zod como fonte da verdade, evoluir schema sem migrador |
| [03 — Estado e cor](docs/03-estado-e-cor.md) | a cadeia de cor, regras, integração com o Zabbix |
| [04 — Canvas e editor](docs/04-canvas-e-editor.md) | React Flow, Layer, edição em massa, ícones, hover |
| [05 — Armadilhas do Grafana](docs/05-armadilhas-grafana.md) | cada bug de plataforma que custou tempo |
| [06 — Testes](docs/06-testes.md) | Jest, Playwright, o que o jsdom não vê |
| [07 — Build e instalação](docs/07-build-e-instalacao.md) | empacotar e instalar em ambiente real |
| [08 — Histórico de decisões](docs/08-historico-de-decisoes.md) | cronologia da v1.0 |
| [09 — Pendências e roadmap](docs/09-pendencias-e-roadmap.md) | o que ficou de fora, e com que decisão pendente |
| [Estilo dos elementos](docs/estilo-elementos-canvas.md) | contrato visual de cada elemento |

Dashboards prontos para importar em [`examples/`](examples/README.md), todos
estáticos: um **exemplo** denso, que exercita os seis tipos de elemento, e dois
**modelos** para copiar — um datacenter com os ícones da biblioteca Padrão e uma
malha WAN feita só de nós.

## Desenvolvimento

Requer Node **>= 22** (ver `.nvmrc`) e Docker para o ambiente de testes.

```bash
npm install

npm run dev        # build em watch
npm run server     # Grafana 13.1.0 em localhost:3000 com o plugin montado
npm run build      # build de produção -> dist/

npm run test:ci    # 741 testes de unidade (Jest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (--fix disponível em lint:fix)
npm run e2e        # Playwright (exige `npm run server` rodando)
```

O `docker-compose` monta `dist/` como plugin e `provisioning/` como provisioning,
já com `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`. Rode `npm run dev` em
paralelo para ter hot-reload do bundle.

> Nesta máquina (WSL, sem sudo) o Chromium do Playwright precisa de um
> `LD_LIBRARY_PATH` montado à mão — receita no
> [doc 05](docs/05-armadilhas-grafana.md#chromium-do-playwright-não-sobe-sem-libs-do-sistema-wslubuntu-sem-sudo).

## Regras do repositório

- **Não modifique `.config/`.** É gerenciado pelo `@grafana/create-plugin` e
  sobrescrito a cada update. Estenda pelos arquivos da raiz (`jest.config.js`,
  `eslint.config.mjs`, `docker-compose.yaml`), que já herdam de lá.
- **Não mude o `id` nem o `type`** em `src/plugin.json` — dashboards salvos
  referenciam o id. Qualquer outra alteração nesse arquivo **exige reiniciar o
  Grafana**.
- Toda a documentação do plugin em português; comentários de código também.

## Instalação em ambiente real

Ver [07 — Build e instalação](docs/07-build-e-instalacao.md). Resumo:

```bash
npm ci && npm run build
cd dist && zip -r ../jlcp-topoflow-panel-1.1.0.zip . && cd ..
```

Descompacte numa pasta `jlcp-topoflow-panel/` dentro do diretório de plugins do
Grafana, libere o carregamento sem assinatura para esse id e reinicie o serviço.

## Licença

Apache-2.0.
