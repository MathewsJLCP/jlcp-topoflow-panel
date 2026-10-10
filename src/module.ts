import { PanelPlugin } from '@grafana/data';

import { TopoFlowOptions } from './model/types';
import { TopoFlowPanel } from './panel/TopoFlowPanel';
import { addTopoFlowOptions } from './panel/options';
import { injectTopoFlowFonts } from './theme/fonts';

injectTopoFlowFonts();

export const plugin = new PanelPlugin<TopoFlowOptions>(TopoFlowPanel)
  // OBRIGATORIO (ADR-P03). Habilita unit, decimals, min/max, thresholds, value
  // mappings e overrides na aba padrao de opcoes, e — o que importa de verdade —
  // faz o Grafana rodar `applyFieldOverrides` antes de entregar `data.series`,
  // que e o que popula `field.display`. Sem isso o vinculo de dados nao existe.
  .useFieldConfig()
  .setPanelOptions(addTopoFlowOptions);
