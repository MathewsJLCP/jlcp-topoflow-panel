import React from 'react';
import { Field, Input, PopoverContent } from '@grafana/ui';

import { FieldLabel } from './FieldLabel';

/**
 * Campo numerico com faixa, que **deixa digitar**.
 *
 * O jeito obvio — validar a cada tecla e cair no valor anterior quando invalido
 * — trava o campo. Para trocar 16 por 24 num campo de minimo 8, o usuario digita
 * "2" antes de "24"; "2" esta fora da faixa, o valor volta a 16 na mesma tecla,
 * e o segundo digito passa a editar "16". Na pratica, nenhum numero de dois
 * digitos comecado abaixo do minimo era alcancavel. Era o bug do "Tamanho da
 * fonte" — nao um detalhe de UX, um campo que nao dava para usar.
 *
 * A saida e separar o que esta na tela do que esta salvo: o texto digitado vive
 * aqui em estado local e so vira valor quando **e** valido. Nada fora da faixa
 * chega ao modelo, que e o que importa — um `fontSize: 2` gravado reprovaria no
 * Zod e derrubaria a topologia inteira para os defaults na proxima leitura.
 *
 * Ao sair do campo, o texto volta ao ultimo valor valido: sem isso um "2"
 * abandonado ficaria na tela sugerindo um estado que nao existe no modelo.
 */

interface NumberFieldProps {
  label: string;
  info?: PopoverContent;
  value: number;
  min: number;
  max?: number;
  /** Sufixo visual, tipo `px`. Nao entra no valor. */
  suffix?: string;
  onChange: (value: number) => void;
}

export function NumberField({ label, info, value, min, max, suffix, onChange }: NumberFieldProps) {
  const [raw, setRaw] = React.useState(() => String(value));

  // Ressincroniza quando o valor muda por fora (outro elemento selecionado,
  // undo). Ajuste durante o render, e nao em efeito: e o padrao que o React
  // documenta para estado derivado de props, ja usado no `ElementsEditor`.
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setRaw(String(value));
  }

  const handleChange = (next: string) => {
    setRaw(next);

    const parsed = Number(next);
    const dentroDaFaixa = parsed >= min && (max === undefined || parsed <= max);

    if (next.trim() !== '' && Number.isFinite(parsed) && dentroDaFaixa) {
      onChange(parsed);
    }
  };

  return (
    <Field label={<FieldLabel info={info}>{label}</FieldLabel>}>
      <Input
        type="number"
        min={min}
        max={max}
        value={raw}
        suffix={suffix}
        onChange={(event) => handleChange(event.currentTarget.value)}
        onBlur={() => setRaw(String(value))}
      />
    </Field>
  );
}
