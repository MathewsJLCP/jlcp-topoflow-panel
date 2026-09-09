import { DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { addElement } from '../model/mutations';
import { sampleTopology } from '../model/sampleTopology';
import { Topology } from '../model/types';
import { keepSelection, withNodeData } from './TopologyCanvas';
import { toFlowNodes } from './useFlowElements';

/**
 * O canvas guarda os nos do React Flow em estado local e so os reconstroi quando
 * a **topologia** muda — e o que mantem posicao e selecao intactas durante um
 * arraste. A consequencia e que tudo o que nao e topologia (as series, o modo de
 * edicao, o papel no modo Linkar) precisa ser reinjetado a cada render, e quem
 * faz isso e `withNodeData`.
 *
 * Um tipo de no esquecido nessa funcao nao quebra nada visivelmente: ele apenas
 * **congela** no estado da ultima vez que a topologia mudou. Foi o que aconteceu
 * com a Imagem — a legenda com `${metrica}` parava no tempo e so voltava a andar
 * ao recarregar a pagina, que e como um bug de dados se disfarca de cache.
 *
 * Por isso o teste e sobre a funcao inteira, tipo a tipo, e nao sobre a Imagem:
 * o proximo tipo de elemento tem de entrar nesta lista ou reprovar aqui.
 */

const frames = (nome: string): DataFrame[] => [
  toDataFrame({ fields: [{ name: nome, type: FieldType.number, values: [1] }] }),
];

const ANTIGO = frames('antes');
const NOVO = frames('depois');

/** Um de cada tipo, na mesma topologia. */
function todosOsTipos(): Topology {
  return ['node', 'point', 'postit', 'text', 'image'].reduce<Topology>(
    (topology, kind) => addElement(topology, kind as never, { x: 0, y: 0 }),
    { ...sampleTopology, nodes: [], edges: [], points: [], postits: [], texts: [], images: [] }
  );
}

describe('withNodeData', () => {
  const topology = todosOsTipos();
  const montados = toFlowNodes(topology, ANTIGO, false);
  const atualizados = withNodeData(montados, NOVO, true, undefined, topology);

  const byType = (type: string) => atualizados.find((node) => node.type === type)!;

  it.each(['deviceNode', 'pointNode', 'textNode', 'imageNode'])(
    '%s recebe as séries novas — sem isso ele congela o que exibe',
    (type) => {
      const node = byType(type);
      expect('frames' in node.data && node.data.frames).toBe(NOVO);
    }
  );

  // O texto entrou nesta lista com o drill-down: `editable` e o que decide se o
  // clique nele navega ou seleciona.
  it.each(['deviceNode', 'pointNode', 'postitNode', 'imageNode', 'textNode'])(
    '%s acompanha o modo de edição, que muda sem tocar na topologia',
    (type) => {
      const node = byType(type);
      expect('editable' in node.data && node.data.editable).toBe(true);
    }
  );

  /**
   * Postit e texto nao conectam; os outros tres sim, e o realce tem de sair da
   * mesma regra que valida o clique (`canConnect`), nunca de uma copia.
   */
  it('marca origem e alvos válidos enquanto o modo Linkar está ativo', () => {
    const origem = topology.nodes[0].id;
    const linking = withNodeData(montados, NOVO, true, origem, topology);
    const linkOf = (type: string) => {
      const node = linking.find((item) => item.type === type)!;
      return 'link' in node.data ? node.data.link : undefined;
    };

    expect(linkOf('deviceNode')).toBe('source');
    expect(linkOf('pointNode')).toBe('valid');
    expect(linkOf('imageNode')).toBe('valid');
  });

  it('não fabrica objeto novo para quem não tem nada a atualizar', () => {
    // O postit e estatico por decisao do PRD: recebe `editable` e mais nada.
    expect(byType('postitNode').data).not.toHaveProperty('frames');
  });
});

/**
 * A cena e reconstruida a cada escrita na topologia, e `toFlowNodes` /
 * `toFlowEdges` nao conhecem selecao — ela e estado de UI e nunca foi para
 * `options`. Sem preservar, **toda escrita apagaria a selecao**: na edicao em
 * massa, mudar o estilo de quatro conexoes desfazia a selecao e obrigava a
 * refaze-la para o campo seguinte.
 */
describe('keepSelection', () => {
  const item = (id: string, selected?: boolean) => ({ id, selected });

  it('devolve os selecionados de novo selecionados', () => {
    const antes = [item('a', true), item('b'), item('c', true)];
    const depois = [item('a'), item('b'), item('c')];

    expect(keepSelection(depois, antes)).toEqual([item('a', true), item('b'), item('c', true)]);
  });

  it('casa por id, não por posição — a lista pode ter mudado de tamanho', () => {
    const antes = [item('a'), item('b', true)];
    const depois = [item('b'), item('c')];

    expect(keepSelection(depois, antes)).toEqual([item('b', true), item('c')]);
  });

  it('id que sumiu da cena não reaparece', () => {
    expect(keepSelection([item('b')], [item('a', true)])).toEqual([item('b')]);
  });

  /** Sem seleção anterior, a lista nova passa intacta — nem uma cópia a mais. */
  it('sem seleção, devolve a mesma lista', () => {
    const depois = [item('a'), item('b')];

    expect(keepSelection(depois, [item('a'), item('b')])).toBe(depois);
  });
});
