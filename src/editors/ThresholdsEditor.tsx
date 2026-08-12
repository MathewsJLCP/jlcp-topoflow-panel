import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, FieldType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, ColorPicker, Combobox, Dropdown, Field, IconButton, Input, Menu, useStyles2 } from '@grafana/ui';

import { sortRules } from '../data/thresholds';
import {
  ColorDimension,
  ElementRule,
  ElementRuleType,
  ElementThresholds,
  SpecialMatch,
} from '../model/types';
import { TopoFieldPicker } from './TopoFieldPicker';

/**
 * Bloco de estado por metrica: o field observado e as regras que mudam a cor do
 * elemento.
 *
 * Junta numa lista so o que o Grafana mantem em dois lugares — **Thresholds**
 * (faixa aberta) e **Value mappings** (valor exato, faixa, regex, especiais) —,
 * mais a cor de repouso, que aparece como a linha **Base** ao pe da lista,
 * exatamente onde o editor de thresholds do Grafana a coloca.
 *
 * A ordem da lista **e** a ordem de avaliacao: mapeamentos primeiro, na ordem
 * em que foram criados, depois os thresholds do maior para o menor. E a mesma
 * precedencia do core, com a diferenca de que aqui ela esta visivel na tela em
 * vez de escrita na documentacao.
 *
 * A linha Base grava em `color.fixed` — o mesmo campo de sempre. Nada foi
 * migrado; so mudou onde ele aparece.
 */

/** Metricas so fazem sentido sobre numeros. */
const numericOnly = (field: { type?: FieldType }) => field.type === FieldType.number;

/** Escala usada ao adicionar thresholds em sequencia, do mais leve ao mais grave. */
const THRESHOLD_COLORS = ['yellow', 'orange', 'red', 'dark-red'];

/** Mapeamentos nao tem gravidade implicita; azul e o neutro informativo. */
const MAPPING_COLOR = 'blue';

const RULE_TYPES: Array<{ type: ElementRuleType; label: string; description: string }> = [
  { type: 'threshold', label: 'Threshold', description: 'A partir de um valor' },
  { type: 'value', label: 'Valor', description: 'Valor exato' },
  { type: 'range', label: 'Faixa', description: 'Entre dois valores' },
  { type: 'regex', label: 'Regex', description: 'Expressão regular' },
  { type: 'special', label: 'Especial', description: 'Nulo, NaN, booleanos' },
];

const SPECIAL_OPTIONS: Array<SelectableValue<SpecialMatch>> = [
  { value: 'null', label: 'Nulo' },
  { value: 'nan', label: 'NaN' },
  { value: 'null+nan', label: 'Nulo + NaN' },
  { value: 'true', label: 'Verdadeiro' },
  { value: 'false', label: 'Falso' },
  { value: 'empty', label: 'Vazio' },
];

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
  const rules = thresholds?.steps ?? [];

  const writeRules = (next: ElementRule[]) =>
    // Lista vazia volta a ser "sem regra propria", e o elemento retoma os
    // thresholds do field — a coexistencia da decisao D8 depende disso.
    onThresholdsChange(next.length > 0 ? { steps: sortRules(next) } : undefined);

  const addRule = (type: ElementRuleType) => writeRules([...rules, newRule(type, rules)]);

  const patchRule = (index: number, changes: Partial<ElementRule>) =>
    writeRules(rules.map((rule, i) => (i === index ? ({ ...rule, ...changes } as ElementRule) : rule)));

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

      <Field
        label="Thresholds"
        description={color.field ? undefined : 'Escolha um campo de estado acima para as regras terem efeito.'}
      >
        <div className={styles.rules}>
          <Dropdown
            overlay={
              <Menu>
                {RULE_TYPES.map(({ type, label, description }) => (
                  <Menu.Item key={type} label={label} description={description} onClick={() => addRule(type)} />
                ))}
              </Menu>
            }
          >
            <Button variant="secondary" size="sm" icon="plus" fullWidth>
              Adicionar regra
            </Button>
          </Dropdown>

          {rules.map((rule, index) => (
            // O indice como chave e seguro aqui: a lista e reordenada a cada
            // escrita, entao qualquer id estavel divergiria da ordem exibida no
            // mesmo instante.
            <div key={index} className={styles.rule}>
              <div className={styles.ruleTop}>
                <ColorPicker color={rule.color} onChange={(next) => patchRule(index, { color: next })} />
                <RuleCondition rule={rule} index={index} onChange={(changes) => patchRule(index, changes)} />
                <IconButton
                  name="trash-alt"
                  tooltip="Remover regra"
                  onClick={() => writeRules(rules.filter((_, i) => i !== index))}
                />
              </div>

              <Input
                value={rule.label ?? ''}
                placeholder="Texto exibido (opcional)"
                aria-label={`Texto exibido da regra ${index + 1}`}
                onChange={(event) => patchRule(index, { label: event.currentTarget.value || undefined })}
              />
            </div>
          ))}

          {/*
            Base: nao e uma regra, e o que sobra quando nenhuma casa. Fica ao pe
            da lista, sem lixeira, como no editor de thresholds do Grafana.
          */}
          <div className={styles.base}>
            <ColorPicker color={color.fixed ?? 'green'} onChange={(fixed) => onColorChange({ ...color, fixed })} />
            <span className={styles.baseLabel}>Base</span>
          </div>

          {rules.length === 0 && (
            <div className={styles.empty}>
              Sem regra própria — o elemento segue os thresholds configurados no field.
            </div>
          )}
        </div>
      </Field>
    </>
  );
}

interface RuleConditionProps {
  rule: ElementRule;
  index: number;
  onChange: (changes: Partial<ElementRule>) => void;
}

/** A condicao muda com o tipo; cor e texto exibido sao iguais para todos. */
function RuleCondition({ rule, index, onChange }: RuleConditionProps) {
  const styles = useStyles2(getStyles);
  const position = index + 1;

  switch (rule.type) {
    case 'threshold':
      return (
        <Input
          type="number"
          value={rule.value}
          aria-label={`Valor da regra ${position}`}
          onChange={(event) => onChange({ value: toNumber(event.currentTarget.value, rule.value) })}
        />
      );

    case 'value':
      return (
        <Input
          value={rule.match}
          placeholder="Valor exato"
          aria-label={`Valor exato da regra ${position}`}
          onChange={(event) => onChange({ match: event.currentTarget.value })}
        />
      );

    case 'range':
      return (
        <>
          <Input
            type="number"
            value={rule.from}
            placeholder="De"
            aria-label={`Início da faixa da regra ${position}`}
            onChange={(event) => onChange({ from: toNumber(event.currentTarget.value, rule.from) })}
          />
          <Input
            type="number"
            value={rule.to}
            placeholder="Até"
            aria-label={`Fim da faixa da regra ${position}`}
            onChange={(event) => onChange({ to: toNumber(event.currentTarget.value, rule.to) })}
          />
        </>
      );

    case 'regex':
      return (
        <Input
          value={rule.pattern}
          placeholder="Expressão regular"
          aria-label={`Expressão da regra ${position}`}
          onChange={(event) => onChange({ pattern: event.currentTarget.value })}
        />
      );

    case 'special':
      return (
        <div className={styles.grow}>
          <Combobox
            options={SPECIAL_OPTIONS as Array<{ value: SpecialMatch; label: string }>}
            value={rule.match}
            aria-labelledby={`Condição da regra ${position}`}
            onChange={(option) => onChange({ match: option.value })}
          />
        </div>
      );
  }
}

/**
 * Regra nova ja nasce util: cada threshold entra 10 acima do mais alto e um
 * degrau de cor adiante, entao clicar tres vezes produz uma escala usavel sem
 * tocar nas cores.
 */
function newRule(type: ElementRuleType, rules: ElementRule[]): ElementRule {
  const thresholds = rules.filter((rule) => rule.type === 'threshold');
  const highest = thresholds.reduce((max, rule) => Math.max(max, rule.value), Number.NEGATIVE_INFINITY);

  switch (type) {
    case 'threshold':
      return {
        type,
        value: Number.isFinite(highest) ? highest + 10 : 80,
        color: THRESHOLD_COLORS[Math.min(thresholds.length, THRESHOLD_COLORS.length - 1)],
      };
    case 'value':
      return { type, match: '', color: MAPPING_COLOR };
    case 'range':
      return { type, from: 0, to: 10, color: MAPPING_COLOR };
    case 'regex':
      return { type, pattern: '', color: MAPPING_COLOR };
    case 'special':
      return { type, match: 'null', color: MAPPING_COLOR };
  }
}

/** Campo numerico vazio ou invalido nao pode quebrar a validacao Zod. */
function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const getStyles = (theme: GrafanaTheme2) => ({
  rules: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  rule: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  ruleTop: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  grow: css({
    flex: 1,
    minWidth: 0,
  }),
  base: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75),
    // Sem borda: a Base nao e um item da lista, e o que resta quando a lista
    // nao decide nada.
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  baseLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
