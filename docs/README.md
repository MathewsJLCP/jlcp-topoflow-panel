# Documentação do TopoFlow

Registro do que o plugin faz, por que faz assim, e o que custou caro descobrir.
Escrito para dois leitores: quem for manter o TopoFlow, e quem for começar
**outro** plugin de painel do Grafana e não quiser repetir os mesmos erros.

## Índice

| Documento | Do que trata |
| --- | --- |
| [01 — Visão geral](01-visao-geral.md) | O que é o plugin, arquitetura, fluxo de dados, mapa dos diretórios |
| [02 — Modelo e persistência](02-modelo-e-persistencia.md) | Zod como fonte da verdade, `panel.options`, evoluir schema sem migrador |
| [03 — Estado e cor](03-estado-e-cor.md) | A cadeia de cor, thresholds próprios, integração com triggers do Zabbix |
| [04 — Canvas e editor](04-canvas-e-editor.md) | React Flow, o Layer, edição em massa, ícones, hover, screenshot, drill-down |
| [05 — Armadilhas do Grafana](05-armadilhas-grafana.md) | **O documento mais importante.** Cada bug de plataforma que custou tempo |
| [06 — Testes](06-testes.md) | Jest + jsdom (e onde ele mente), Playwright, dashboard provisionado como fixture |
| [07 — Build e instalação](07-build-e-instalacao.md) | Gerar o pacote, instalar em ambiente real, assinatura, atualização |
| [08 — Histórico de decisões](08-historico-de-decisoes.md) | Cronologia da v1.0: o que foi decidido, quando, e por quê |
| [09 — Pendências e roadmap](09-pendencias-e-roadmap.md) | O que ficou de fora da v1.0 e com que decisão pendente |
| [10 — Submissão ao Grafana](10-submissao-grafana.md) | Publicar e atualizar no catálogo: pré-requisitos, formulário, assinatura, e o diário de cada submissão |
| [PRD — Vínculo direto com o Zabbix](prd-zabbix-direto.md) | Rodada em curso: autocomplete de host/item/trigger pela API do Zabbix, e o painel executando a própria query |
| [Estilo dos elementos](estilo-elementos-canvas.md) | Contrato visual de cada elemento do canvas (tokens, superfícies, contraste) |
| [Especificação funcional](especificacao-funcional.md) | Inventário de tudo o que o produto faz — elementos, campos, interações, estados e mensagens —, sem referência visual. Base para o redesenho da v2.0 |
| [Exemplos](../examples/README.md) | Dashboards prontos para importar, e como adaptá-los ao seu Zabbix |

## Se você tem 10 minutos

Leia [05 — Armadilhas do Grafana](05-armadilhas-grafana.md). É o único documento
aqui cujo conteúdo não está em lugar nenhum da documentação oficial, e é o que
consumiu a maior parte do tempo de desenvolvimento da v1.0.

## Se você vai começar um plugin novo

Além do 05, leia [02 — Modelo e persistência](02-modelo-e-persistencia.md) —
as decisões de schema são as únicas que ficam caras de mudar depois, porque
existem dashboards salvos em produção com o formato antigo.

Há também uma skill destilada desses aprendizados em
`.claude/skills/grafana-panel-plugin/SKILL.md`.
