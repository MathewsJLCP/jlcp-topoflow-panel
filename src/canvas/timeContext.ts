import { createContext, useContext } from 'react';
import { TimeRange, dateTime } from '@grafana/data';
import { TimeZone } from '@grafana/schema';

/**
 * A janela de tempo do dashboard, disponivel para quem desenha dentro do canvas.
 *
 * ## Por que contexto, e nao o `data` do no
 *
 * Todo o resto que vem de fora — `frames`, `editable`, `link` — viaja no `data`
 * de cada no, porque o React Flow guarda os nos em estado local e so os
 * reconstroi quando a topologia muda. Isso obriga `withNodeData` a reinjetar
 * cada um desses campos a cada render, e **um tipo de no esquecido naquela
 * funcao congela em silencio** — foi exatamente o que aconteceu com a Imagem e
 * os `frames`, que so voltavam a andar ao recarregar a pagina.
 *
 * O contexto nao tem esse modo de falha: quem consome re-renderiza quando o
 * valor muda, sem lista nenhuma para manter em dia. Como a janela de tempo e a
 * mesma para o canvas inteiro — nao ha "o time range daquele no" —, ela nao
 * ganha nada por viajar elemento a elemento.
 *
 * O `frames` nao migra para ca junto porque ele **e** por no na pratica: cada
 * elemento le um field diferente, e a injecao no `data` e o que permite ao React
 * Flow pular o render dos nos cujo dado nao mudou.
 */

export interface TopoTime {
  timeRange: TimeRange;
  timeZone: TimeZone;
}

/**
 * Fallback so para quem renderizar fora do painel (testes de no isolado). Num
 * dashboard o provider sempre existe, e um intervalo vazio e melhor do que
 * `undefined` espalhando `?.` por todo consumidor.
 */
const FALLBACK: TopoTime = {
  timeRange: { from: dateTime(0), to: dateTime(0), raw: { from: 'now-6h', to: 'now' } },
  timeZone: 'browser',
};

export const TopoTimeContext = createContext<TopoTime>(FALLBACK);

export function useTopoTime(): TopoTime {
  return useContext(TopoTimeContext);
}
