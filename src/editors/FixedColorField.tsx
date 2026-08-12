import React from 'react';
import { ColorPicker, Field } from '@grafana/ui';

import { ColorDimension } from '../model/types';

/**
 * Cor de identidade: so a amostra, sem o radio Fixo|Field do
 * `ColorDimensionField`.
 *
 * Aquele radio grava em `color.field`, e o `field` deixou de ser assunto de cor
 * neste painel — no No, Conexao e Point ele pertence ao bloco de estado
 * (`StateFieldPicker`), e no Texto ele deixou de existir por decisao. Manter os
 * dois controles na mesma tela daria ao usuario dois caminhos para um dado so,
 * dizendo coisas diferentes sobre ele.
 *
 * Escreve **apenas** `fixed`, preservando o resto do objeto: um `field` que
 * tenha sobrado de uma topologia antiga continua no JSON, so nao e mais editado
 * nem lido.
 */

interface FixedColorFieldProps {
  value: ColorDimension;
  onChange: (next: ColorDimension) => void;
}

export function FixedColorField({ value, onChange }: FixedColorFieldProps) {
  return (
    <Field label="Cor">
      <div>
        {/* Mesmo fallback do `ColorDimensionField`: sem isso a amostra mudaria
            de cor em elementos ja salvos que nunca escolheram uma. */}
        <ColorPicker color={value.fixed ?? 'text'} onChange={(fixed) => onChange({ ...value, fixed })} />
      </div>
    </Field>
  );
}
