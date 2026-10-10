import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { ColorPicker, Combobox, ComboboxOption, IconButton, Input, useStyles2, useTheme2 } from '@grafana/ui';

import { hasStateBinding } from '../data/dimensions';
import { SEVERITY_LABEL } from '../data/problems';
import {
  MetricRule,
  SeverityLadderRow,
  metricRules,
  severityLadder,
  severityRules,
  sortRules,
  writeSeverityLadder,
} from '../data/thresholds';
import {
  AlertAnimation,
  ColorDimension,
  ElementAlert,
  ElementRule,
  ElementRuleType,
  ElementThresholds,
  Severity,
  SpecialMatch,
} from '../model/types';
import { FONT_SANS, TfPalette, resolveTfColor, tfPalette } from '../theme/palette';
import { FieldLabel } from './FieldLabel';
import { DashedButton } from './ui/Section';
import { TfSelect } from './ui/TfSelect';

/**
 * As regras de estado de uma metrica (eixo Metrica) ou a escada de severidades
 * (eixo Trigger), no desenho do mockup.
 *
 *   - Metrica: uma linha por regra — cor, condicao, animacao, lixeira — e
 *     "+ Adicionar regra" com os cinco tipos. A linha da regra continua a de
 *     antes da v1.4 (seletor de cor do Grafana, com as cores nomeadas; `Input`;
 *     `Combobox`), a pedido: o resto do bloco segue o mockup.
 *   - Trigger: as seis severidades do Zabbix, cada uma com "atender", cor e
 *     animacao; "Restaurar padrao" desfaz a customizacao.
 *   - Base: a cor quando nada casa (ou nao ha alarme). Com varias metricas ela
 *     sai daqui e vai para o fim do bloco de estado (`showBase={false}`).
 */

const THRESHOLD_COLORS = ['#F59E0B', '#F97316', '#EF4444'];
const MAPPING_COLOR = '#3B82F6';

type MetricRuleType = Exclude<ElementRuleType, 'severity'>;

const METRIC_RULE_TYPES: Array<{ type: MetricRuleType; label: string; description: string }> = [
  { type: 'threshold', label: 'Threshold', description: 'A partir de um valor' },
  { type: 'value', label: 'Valor', description: 'Valor exato' },
  { type: 'range', label: 'Faixa', description: 'Entre dois valores' },
  { type: 'regex', label: 'Regex', description: 'Expressão regular' },
  { type: 'special', label: 'Especial', description: 'Nulo, NaN, booleanos' },
];

const NO_ANIMATION = 'none';
type AnimationValue = AlertAnimation | typeof NO_ANIMATION;

const ANIMATION_OPTIONS: Array<{ value: AnimationValue; label: string }> = [
  { value: NO_ANIMATION, label: 'Parado' },
  { value: 'pulse', label: 'Pulsar' },
  { value: 'blink', label: 'Piscar' },
  { value: 'radar', label: 'Radar' },
];

const SPECIAL_OPTIONS: Array<{ value: SpecialMatch; label: string }> = [
  { value: 'null', label: 'Nulo' },
  { value: 'nan', label: 'NaN' },
  { value: 'null+nan', label: 'Nulo + NaN' },
  { value: 'true', label: 'Verdadeiro' },
  { value: 'false', label: 'Falso' },
  { value: 'empty', label: 'Vazio' },
];

interface ThresholdsEditorProps {
  axis: 'metric' | 'trigger';
  color: ColorDimension;
  thresholds: ElementThresholds | undefined;
  alert?: ElementAlert;
  allowRadar?: boolean;
  /** Falso quando a Base e desenhada pelo bloco de estado (varias metricas). */
  showBase?: boolean;
  /** Presente quando ha mais de uma metrica: o link "Remover metrica". */
  onRemoveMetric?: () => void;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
  onAlertChange?: (next: ElementAlert | undefined) => void;
}

export function ThresholdsEditor({
  axis,
  color,
  thresholds,
  alert,
  allowRadar = true,
  showBase = true,
  onRemoveMetric,
  onColorChange,
  onThresholdsChange,
  onAlertChange,
}: ThresholdsEditorProps) {
  const styles = useStyles2(getStyles);
  const ids = React.useId();
  const [menu, setMenu] = useState(false);

  const hidden = axis === 'trigger' ? metricRules(thresholds) : severityRules(thresholds);
  const rules = metricRules(thresholds);

  const writeRules = (next: ElementRule[]) => {
    const all = [...hidden, ...next];
    onThresholdsChange(all.length > 0 ? { steps: sortRules(all) } : undefined);
  };

  const addRule = (type: MetricRuleType) => {
    setMenu(false);
    writeRules([...rules, newRule(type, rules)]);
  };

  const patchRule = (index: number, changes: Partial<ElementRule>) =>
    writeRules(rules.map((rule, i) => (i === index ? ({ ...rule, ...changes } as ElementRule) : rule)));

  const info =
    axis === 'trigger'
      ? 'Desmarcada, o elemento ignora alarmes daquele nível: não acende, não conta, não aparece na lista.'
      : 'Regras desta métrica. Sem regra, vale a Base. O Thresholds do painel formata o valor, não a cor.';

  const animations = allowRadar ? ANIMATION_OPTIONS : ANIMATION_OPTIONS.filter((o) => o.value !== 'radar');

  return (
    <>
      {axis === 'trigger' ? (
        <SeverityLadder
          info={info}
          thresholds={thresholds}
          alert={alert}
          animations={animations}
          onChange={(next) => {
            writeRules(next);
            if (alert) {
              onAlertChange?.(undefined);
            }
          }}
        />
      ) : (
        <div className={styles.block}>
          <div className={styles.label}>
            <FieldLabel info={info}>Thresholds</FieldLabel>
          </div>

          {!hasStateBinding(color) && (
            <span className={styles.warn}>Escolha uma métrica acima para as regras terem efeito.</span>
          )}

          {rules.map((rule, index) => (
            // O indice como chave e seguro aqui: a lista e reordenada a cada
            // escrita, entao qualquer id estavel divergiria da ordem exibida.
            <div key={index} className={styles.rule}>
              <ColorPicker
                enableNamedColors
                color={rule.color}
                onChange={(next) => patchRule(index, { color: next })}
              />
              <div className={styles.condition}>
                <RuleCondition rule={rule} index={index} onChange={(changes) => patchRule(index, changes)} />
              </div>
              <AnimationPicker
                id={`${ids}-animation-${index}`}
                label={`Animação da regra ${index + 1}`}
                value={rule.animation}
                options={animations}
                onChange={(animation) => patchRule(index, { animation })}
              />
              <IconButton
                name="trash-alt"
                tooltip="Remover regra"
                onClick={() => writeRules(rules.filter((_, i) => i !== index))}
              />
            </div>
          ))}

          <div className={styles.addRow}>
            <AddRuleMenu
              open={menu}
              onToggle={() => setMenu((m) => !m)}
              onClose={() => setMenu(false)}
              onAdd={addRule}
            />
            {onRemoveMetric && (
              <button type="button" className={styles.removeMetric} onClick={onRemoveMetric}>
                Remover métrica
              </button>
            )}
          </div>
        </div>
      )}

      {showBase && (
        <BaseRow
          color={color}
          description={axis === 'trigger' ? 'Cor quando não há alarme.' : 'Cor quando nenhuma regra casa.'}
          onChange={onColorChange}
        />
      )}
    </>
  );
}

/**
 * A animacao da regra. O rotulo e um `<label>` fora da tela: o `Combobox` so
 * aceita `id`, e sem ele o controle fica sem nome acessivel.
 */
function AnimationPicker({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: AlertAnimation | undefined;
  options: Array<ComboboxOption<AnimationValue>>;
  onChange: (next: AlertAnimation | undefined) => void;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.ruleAnimation}>
      <label className={styles.srOnly} htmlFor={id}>
        {label}
      </label>
      <Combobox
        id={id}
        options={options}
        value={value ?? NO_ANIMATION}
        onChange={(option) => onChange(option.value === NO_ANIMATION ? undefined : option.value)}
      />
    </div>
  );
}

function AddRuleMenu({
  open,
  onToggle,
  onClose,
  onAdd,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAdd: (type: MetricRuleType) => void;
}) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', down, true);
    return () => window.removeEventListener('mousedown', down, true);
  }, [open, onClose]);

  return (
    <div ref={ref} className={styles.menuWrap}>
      <DashedButton onClick={onToggle}>+ Adicionar regra</DashedButton>
      {open && (
        <div className={styles.menu} role="menu">
          {METRIC_RULE_TYPES.map(({ type, label, description }) => (
            <button key={type} type="button" role="menuitem" className={styles.menuItem} onClick={() => onAdd(type)}>
              <span className={styles.menuLabel}>{label}</span>
              <span className={styles.menuDesc}>{description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A linha Base: a cor de repouso, ou o circulo tracejado de "sem cor". A cor e
 * a mesma bolinha do Grafana das regras, alinhada com elas.
 */
export function BaseRow({
  color,
  description,
  onChange,
}: {
  color: ColorDimension;
  description: string;
  onChange: (next: ColorDimension) => void;
}) {
  const styles = useStyles2(getStyles);
  const has = Boolean(color.fixed);

  return (
    <div className={styles.base}>
      {has ? (
        <span className={styles.baseSwatch}>
          <ColorPicker enableNamedColors color={color.fixed!} onChange={(fixed) => onChange({ ...color, fixed })} />
        </span>
      ) : (
        <span className={styles.noBase} />
      )}
      <div className={styles.baseText}>
        <span className={styles.baseTitle}>Base</span>
        <span className={styles.baseDesc}>{has ? description : 'Sem cor: o elemento fica neutro.'}</span>
      </div>
      {has ? (
        <button type="button" className={styles.baseAction} onClick={() => onChange({ ...color, fixed: undefined })}>
          Limpar
        </button>
      ) : (
        <button type="button" className={styles.baseDefine} onClick={() => onChange({ ...color, fixed: '#3B82F6' })}>
          Definir cor
        </button>
      )}
    </div>
  );
}

interface SeverityLadderProps {
  info: string;
  thresholds: ElementThresholds | undefined;
  alert: ElementAlert | undefined;
  animations: Array<{ value: AnimationValue; label: string }>;
  onChange: (next: ElementRule[]) => void;
}

function SeverityLadder({ info, thresholds, alert, animations, onChange }: SeverityLadderProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const rows = severityLadder(thresholds, alert);
  const custom = severityRules(thresholds).length > 0 || alert !== undefined;

  const patch = (severity: Severity, changes: Partial<SeverityLadderRow>) =>
    onChange(writeSeverityLadder(thresholds, severity, changes, tfPalette(theme).apa, alert));

  return (
    <div className={styles.block}>
      <div className={styles.ladderHead}>
        <span className={styles.label}>
          <FieldLabel info={info}>Severidades</FieldLabel>
        </span>
        {custom && (
          <button type="button" className={styles.restore} onClick={() => onChange([])}>
            Restaurar padrão
          </button>
        )}
      </div>
      {rows.map(({ severity, color, animation, enabled }) => (
        <div key={severity} className={styles.sev} data-off={!enabled || undefined}>
          <input
            type="checkbox"
            checked={enabled}
            aria-label={`Atender ${SEVERITY_LABEL[severity]}`}
            onChange={(event) => patch(severity, { enabled: event.currentTarget.checked })}
          />
          <ColorSwatch
            label={`Cor de ${SEVERITY_LABEL[severity]}`}
            color={color ?? tfPalette(theme).apa}
            small
            onChange={(next) => patch(severity, { color: next })}
          />
          <div className={styles.sevName}>
            <span>{SEVERITY_LABEL[severity]}</span>
            {!enabled && <span className={styles.ignored}>ignorada</span>}
          </div>
          <TfSelect
            compact
            aria-label={`Animação de ${SEVERITY_LABEL[severity]}`}
            value={animation ?? NO_ANIMATION}
            options={animations}
            onChange={(next) => patch(severity, { animation: next === NO_ANIMATION ? undefined : next })}
          />
        </div>
      ))}
    </div>
  );
}

/** O quadrado de cor do mockup: um `input type=color`, com o valor salvo resolvido para hex. */
function ColorSwatch({
  label,
  color,
  small,
  onChange,
}: {
  label: string;
  color: string;
  small?: boolean;
  onChange: (next: string) => void;
}) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const hex = toHex(resolveTfColor(color, theme));
  return (
    <input
      type="color"
      aria-label={label}
      className={small ? styles.swatchSmall : styles.swatch}
      value={hex}
      onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
    />
  );
}

function toHex(color: string): string {
  try {
    return colorManipulator.asHexString(color).slice(0, 7);
  } catch {
    return '#000000';
  }
}

interface RuleConditionProps {
  rule: MetricRule;
  index: number;
  onChange: (changes: Partial<ElementRule>) => void;
}

function RuleCondition({ rule, index, onChange }: RuleConditionProps) {
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
        <TfSelect
          aria-label={`Condição da regra ${position}`}
          value={rule.match}
          options={SPECIAL_OPTIONS}
          onChange={(match) => onChange({ match })}
        />
      );
  }
}

function newRule(type: MetricRuleType, rules: ElementRule[]): MetricRule {
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
      return { type, from: 0, to: 100, color: MAPPING_COLOR };
    case 'regex':
      return { type, pattern: '', color: MAPPING_COLOR };
    case 'special':
      return { type, match: 'null', color: MAPPING_COLOR };
  }
}

function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const swatch = {
    padding: 0,
    border: `1px solid ${p.borda}`,
    background: 'none',
    cursor: 'pointer',
  };
  return {
    block: css({ display: 'flex', flexDirection: 'column', gap: 8 }),
    label: css({ font: `500 11.5px/1.35 ${FONT_SANS}`, color: p.rot }),
    warn: css({ font: `11.5px ${FONT_SANS}`, color: p['at-t'] }),
    // A linha da regra de antes da v1.4: moldura propria, e `flexWrap` para a
    // faixa (dois campos) empurrar animacao e lixeira para a linha de baixo
    // num painel estreito.
    rule: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    swatch: css({ ...swatch, width: 26, height: 26, borderRadius: 6 }),
    swatchSmall: css({ ...swatch, width: 26, height: 22, borderRadius: 5 }),
    condition: css({
      flex: '1 1 88px',
      minWidth: 0,
      display: 'flex',
      gap: theme.spacing(0.5),
      '> *': { flex: '1 1 0', minWidth: 0 },
    }),
    ruleAnimation: css({ flex: '1 1 72px', minWidth: 0 }),
    srOnly: css({
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }),
    addRow: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }),
    menuWrap: css({ position: 'relative' }),
    menu: css({
      position: 'absolute',
      left: 0,
      top: 'calc(100% + 4px)',
      width: 230,
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 8,
      boxShadow: `0 10px 28px ${p.shadow}`,
      padding: 4,
      zIndex: 10,
    }),
    menuItem: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 1,
      width: '100%',
      border: 0,
      background: 'transparent',
      padding: '6px 9px',
      borderRadius: 6,
      cursor: 'pointer',
      textAlign: 'left',
      '&:hover': { background: p.elev },
    }),
    menuLabel: css({ font: `500 13px ${FONT_SANS}`, color: p.tx }),
    menuDesc: css({ font: `11.5px ${FONT_SANS}`, color: p.apa }),
    removeMetric: css({
      border: 0,
      background: 'transparent',
      padding: 0,
      font: `500 12px ${FONT_SANS}`,
      color: p.tx2,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }),
    base: css({
      display: 'grid',
      gridTemplateColumns: '26px minmax(0,1fr) auto',
      gap: 8,
      alignItems: 'center',
      paddingTop: 8,
      borderTop: `1px dashed ${p.linha}`,
    }),
    baseSwatch: css({ display: 'flex', justifySelf: 'center' }),
    noBase: css({
      justifySelf: 'center',
      width: 16,
      height: 16,
      border: `1px dashed ${p.apa}`,
      borderRadius: '50%',
    }),
    baseText: css({ display: 'flex', flexDirection: 'column' }),
    baseTitle: css({ font: `600 12.5px ${FONT_SANS}`, color: p.tx }),
    baseDesc: css({ font: `11.5px ${FONT_SANS}`, color: p.apa }),
    baseAction: css({
      border: 0,
      background: 'transparent',
      color: p.tx2,
      font: `12px ${FONT_SANS}`,
      cursor: 'pointer',
    }),
    baseDefine: css({
      border: 0,
      background: 'transparent',
      color: p['ac-t'],
      font: `500 12px ${FONT_SANS}`,
      cursor: 'pointer',
    }),
    ladderHead: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }),
    restore: css({
      border: 0,
      background: 'transparent',
      color: p['ac-t'],
      font: `500 12px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: 0,
    }),
    sev: css({
      display: 'grid',
      gridTemplateColumns: '18px 26px minmax(0,1fr) 76px',
      gap: 7,
      alignItems: 'center',
      '&[data-off]': { opacity: 0.45 },
      '& input[type="checkbox"]': { width: 15, height: 15, margin: 0, accentColor: p.ac },
    }),
    sevName: css({
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      minWidth: 0,
      font: `500 12.5px ${FONT_SANS}`,
      color: p.tx,
      whiteSpace: 'nowrap',
    }),
    ignored: css({ font: `italic 11px ${FONT_SANS}`, color: p.apa }),
  };
};
