import { PanelOptionsEditorBuilder } from '@grafana/data';

import { ElementsEditor } from '../editors/ElementsEditor';
import { defaultCanvas, defaultTopology } from '../model/defaults';
import { TopoFlowOptions } from '../model/types';

/**
 * Opcoes customizadas do painel.
 *
 * Thresholds, value mappings, unit e decimals nao aparecem nesta funcao — vem
 * de `.useFieldConfig()` em `module.ts` (ADR-P03).
 */
export function addTopoFlowOptions(builder: PanelOptionsEditorBuilder<TopoFlowOptions>) {
  builder.addCustomEditor({
    id: 'topology-layer',
    path: 'topology',
    name: 'Elementos',
    category: ['Layer'],
    editor: ElementsEditor,
    defaultValue: defaultTopology,
  });

  builder
    .addBooleanSwitch({
      path: 'canvas.showGrid',
      name: 'Mostrar grid',
      defaultValue: defaultCanvas.showGrid,
      category: ['Canvas'],
    })
    .addBooleanSwitch({
      path: 'canvas.snapToGrid',
      name: 'Alinhar ao grid',
      description: 'Prende os elementos ao grid ao arrastar.',
      defaultValue: defaultCanvas.snapToGrid,
      category: ['Canvas'],
    })
    .addSliderInput({
      path: 'canvas.gridSize',
      name: 'Tamanho do grid',
      defaultValue: defaultCanvas.gridSize,
      category: ['Canvas'],
      settings: { min: 4, max: 64, step: 2 },
      showIf: (options) => options.canvas?.showGrid || options.canvas?.snapToGrid,
    })
    .addBooleanSwitch({
      path: 'canvas.inlineEditing',
      name: 'Edição inline',
      description: 'Permite editar a topologia direto no dashboard. No editor de painel a edição está sempre ligada.',
      defaultValue: defaultCanvas.inlineEditing,
      category: ['Canvas'],
    });

  return builder;
}
