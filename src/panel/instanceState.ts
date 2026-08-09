/**
 * Canal de selecao entre o canvas e o painel de Layers.
 *
 * Os dois vivem em arvores React separadas — o canvas dentro do painel, o Layer
 * dentro do editor de opcoes — e nao ha props entre eles. O unico caminho que o
 * Grafana oferece e o `instanceState` do `PanelContext`: o canvas publica com
 * `onInstanceStateChange`, o editor le em `context.instanceState`.
 *
 * **A API e `@alpha`** e documentada como suportada apenas em contexto de
 * dashboard. Por isso todo acesso a ela e opcional dos dois lados: sem o canal,
 * cada lado continua funcionando isolado, exatamente como antes — o que se
 * perde e a sincronia, nunca a edicao.
 *
 * O objeto carrega uma funcao, e nao so o id selecionado, porque a direcao
 * Layer -> canvas precisa de um efeito imperativo: alem de marcar a selecao, o
 * canvas tem de trazer o elemento para a area visivel, e so ele conhece a
 * viewport.
 */
export interface TopoInstanceState {
  /** Id do elemento selecionado no canvas. `undefined` quando nada esta. */
  selected?: string;
  /** Seleciona no canvas e traz o elemento para a area visivel. */
  select: (id: string) => void;
}
