import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, FieldType, GrafanaTheme2 } from '@grafana/data';
import { Button, ColorPicker, Field, IconButton, Input, useStyles2 } from '@grafana/ui';

import { sortStepsDesc } from '../data/thresholds';
import { ColorDimension, ElementThresholdStep, ElementThresholds } from '../model/types';
import { TopoFieldPicker } from './TopoFieldPicker';

/**
 * Bloco de estado por metrica: qual field observar, a cor de repouso e as
 * regras que mudam a cor do elemento.
 *
 * Substitui o antigo campo "Cor" no formulario do no. Os dois controles do
 * campo antigo continuam aqui, com nomes que dizem o papel de cada um na cadeia
 * de cor: o `field` virou **Campo de estado** (a metrica que alimenta as
 * regras) e o `fixed` virou **Cor de repouso** (o que o elemento exibe quando
 * nenhuma regra esta ativa). Nenhum dado e migrado — so a apresentacao mudou.
 *
 * O passo base do Grafana (`-Infinity`) nao existe aqui: abaixo de todas as
 * regras o elemento nao tem estado, e exibe a cor de repouso. Ver o comentario
 * de `elementThresholdsSchema`.
 */

const DEFAULT_STEP_COLOR = 'red';
const STEP_COLORS = ['yellow', 'orange', 'red', 'dark-red'];

/** Metricas so fazem sentido sobre numeros. */
const numericOnly = (field: { type?: FieldType }) => field.type === FieldType.number;

interface ThresholdsFieldProps {
  frames: DataFrame[];
  color: ColorDimension;
  thresholds: ElementThresholds | undefined;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
}

export function ThresholdsField({
  frames,
  color,
  thresholds,
  onColorChange,
  onThresholdsChange,
}: ThresholdsFieldProps) {
  const styles = useStyles2(getStyles);
  const steps = thresholds?.steps ?? [];

  const writeSteps = (next: ElementThresholdStep[]) =>
    // Lista vazia volta a ser "sem regra propria", e o elemento retoma os
    // thresholds do field — a coexistencia da decisao D8 depende disso.
    onThresholdsChange(next.length > 0 ? { steps: sortStepsDesc(next) } : undefined);

  const addStep = () => {
    // Cada regra nova entra acima da mais alta, com um degrau de cor a mais:
    // adicionar tres vezes ja produz uma escala utilizavel sem tocar nas cores.
    const highest = steps[0];
    const value = highest ? highest.value + 10 : 80;
    const color = STEP_COLORS[Math.min(steps.length, STEP_COLORS.length - 1)] ?? DEFAULT_STEP_COLOR;

    writeSteps([...steps, { value, color }]);
  };

  const patchStep = (index: number, changes: Partial<ElementThresholdStep>) =>
    writeSteps(steps.map((step, i) => (i === index ? { ...step, ...changes } : step)));

  return (
    <>
      <Field
        label="Campo de estado"
        description="Métrica que alimenta as regras abaixo. Sem ela, o elemento não exibe estado."
      >
        <TopoFieldPicker
          frames={frames}
          value={color.field || undefined}
          onChange={(field) => onColorChange({ ...color, field })}
          placeholder="Sem vínculo"
          filter={numericOnly}
        />
      </Field>

      <Field label="Cor de repouso" description="Exibida quando nenhuma regra está ativa. Vazio = neutro.">
        <div>
          <ColorPicker color={color.fixed ?? 'green'} onChange={(fixed) => onColorChange({ ...color, fixed })} />
        </div>
      </Field>

      <Field
        label="Regras"
        description={
          color.field
            ? undefined
            : 'Escolha um campo de estado acima para as regras terem efeito.'
        }
      >
        <div className={styles.steps}>
          {steps.length === 0 && (
            <div className={styles.empty}>
              Sem regra própria — o elemento segue os thresholds configurados no field.
            </div>
          )}

          {steps.map((step, index) => (
            // O indice como chave e seguro aqui: a lista e reordenada por valor
            // a cada escrita, entao qualquer id estavel divergiria da ordem
            // exibida no mesmo instante.
            <div key={index} className={styles.step}>
              <ColorPicker color={step.color} onChange={(next) => patchStep(index, { color: next })} />

              <Input
                className={styles.value}
                type="number"
                value={step.value}
                aria-label={`Valor da regra ${index + 1}`}
                onChange={(event) => patchStep(index, { value: toNumber(event.currentTarget.value, step.value) })}
              />

              <Input
                value={step.label ?? ''}
                placeholder="Rótulo"
                aria-label={`Rótulo da regra ${index + 1}`}
                onChange={(event) => patchStep(index, { label: event.currentTarget.value || undefined })}
              />

              <IconButton
                name="trash-alt"
                tooltip="Remover regra"
                onClick={() => writeSteps(steps.filter((_, i) => i !== index))}
              />
            </div>
          ))}

          <Button variant="secondary" size="sm" icon="plus" onClick={addStep} fullWidth>
            Adicionar regra
          </Button>
        </div>
      </Field>
    </>
  );
}

/** Campo numerico vazio ou invalido nao pode quebrar a validacao Zod. */
function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const getStyles = (theme: GrafanaTheme2) => ({
  steps: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  step: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  // O valor e curto e previsivel; o rotulo fica com a largura que sobra.
  value: css({
    flex: '0 0 72px',
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
