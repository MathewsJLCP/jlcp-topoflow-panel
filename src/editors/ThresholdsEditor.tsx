import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  ColorPicker,
  Combobox,
  ComboboxOption,
  Dropdown,
  Field,
  IconButton,
  Input,
  Menu,
  useStyles2,
} from '@grafana/ui';

import { SEVERITY_LABEL } from '../data/problems';
import { metricRules, severityRules, sortRules } from '../data/thresholds';
import {
  AlertAnimation,
  ColorDimension,
  ElementRule,
  ElementRuleType,
  ElementThresholds,
  Severity,
  SpecialMatch,
} from '../model/types';
import { FieldLabel } from './FieldLabel';

/**
 * Regras que mudam a cor do elemento conforme o valor da metrica.
 *
 * O seletor da metrica **nao** esta aqui: ele e o `StateFieldPicker`, e quem o
 * renderiza e o formulario, logo acima deste bloco. Enquanto ele morava dentro
 * daqui, so o no tinha seletor de metrica — ver o comentario la.
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

/** Escala usada ao adicionar thresholds em sequencia, do mais leve ao mais grave. */
const THRESHOLD_COLORS = ['yellow', 'orange', 'red', 'dark-red'];

/** Mapeamentos nao tem gravidade implicita; azul e o neutro informativo. */
const MAPPING_COLOR = 'blue';

/**
 * Os tipos oferecidos dependem do eixo em que o elemento esta.
 *
 * Em Metrica, os cinco que avaliam o valor de um field. Em Trigger, so a
 * severidade — as outras condicoes nao teriam contra o que casar, e oferece-las
 * seria convidar a configurar regra que nunca dispara.
 */
const METRIC_RULE_TYPES: Array<{ type: ElementRuleType; label: string; description: string }> = [
  { type: 'threshold', label: 'Threshold', description: 'A partir de um valor' },
  { type: 'value', label: 'Valor', description: 'Valor exato' },
  { type: 'range', label: 'Faixa', description: 'Entre dois valores' },
  { type: 'regex', label: 'Regex', description: 'Expressão regular' },
  { type: 'special', label: 'Especial', description: 'Nulo, NaN, booleanos' },
];

const TRIGGER_RULE_TYPES: Array<{ type: ElementRuleType; label: string; description: string }> = [
  { type: 'severity', label: 'Severidade', description: 'A partir de uma severidade' },
];

/** Nomes do Zabbix, na ordem de gravidade. */
const SEVERITY_OPTIONS: Array<SelectableValue<Severity>> = ([0, 1, 2, 3, 4, 5] as Severity[]).map((severity) => ({
  value: severity,
  label: SEVERITY_LABEL[severity],
}));

/**
 * O "sem animacao" precisa de valor proprio porque o `Combobox` nao aceita
 * `undefined` como opcao selecionavel; ele e traduzido de volta na escrita.
 */
const NO_ANIMATION = 'none';

const RULE_ANIMATION_OPTIONS: Array<ComboboxOption<AlertAnimation | typeof NO_ANIMATION>> = [
  { value: NO_ANIMATION, label: 'Parado' },
  { value: 'pulse', label: 'Pulsar' },
  { value: 'blink', label: 'Piscar' },
  { value: 'radar', label: 'Radar' },
];

const SPECIAL_OPTIONS: Array<SelectableValue<SpecialMatch>> = [
  { value: 'null', label: 'Nulo' },
  { value: 'nan', label: 'NaN' },
  { value: 'null+nan', label: 'Nulo + NaN' },
  { value: 'true', label: 'Verdadeiro' },
  { value: 'false', label: 'Falso' },
  { value: 'empty', label: 'Vazio' },
];

interface ThresholdsEditorProps {
  /**
   * Eixo em que o elemento esta. Decide quais tipos de regra sao oferecidos e
   * quais das regras salvas aparecem: as do outro eixo continuam no JSON, so nao
   * ocupam a tela de quem nao esta olhando para elas.
   */
  axis: 'metric' | 'trigger';
  /** So para a linha Base, que edita `color.fixed`. O `field` quem escreve e o `StateFieldPicker`. */
  color: ColorDimension;
  thresholds: ElementThresholds | undefined;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
}

export function ThresholdsEditor({
  axis,
  color,
  thresholds,
  onColorChange,
  onThresholdsChange,
}: ThresholdsEditorProps) {
  const styles = useStyles2(getStyles);
  const ids = React.useId();
  const ruleTypes = axis === 'trigger' ? TRIGGER_RULE_TYPES : METRIC_RULE_TYPES;

  /**
   * A lista exibida e so a do eixo atual, mas toda escrita devolve **a lista
   * inteira**: as regras do outro eixo viajam junto, intactas. Sem isso,
   * adicionar uma cor de severidade apagaria os thresholds de metrica do mesmo
   * elemento — e alternar os modos deixaria de ser gratuito, que e uma
   * propriedade que o binding de trigger tem desde que existe.
   */
  const hidden = axis === 'trigger' ? metricRules(thresholds) : severityRules(thresholds);
  const rules = axis === 'trigger' ? severityRules(thresholds) : metricRules(thresholds);

  const writeRules = (next: ElementRule[]) => {
    const all = [...hidden, ...next];
    // Lista vazia volta a ser "sem regra propria", e o elemento retoma os
    // thresholds do field — a coexistencia da decisao D8 depende disso.
    onThresholdsChange(all.length > 0 ? { steps: sortRules(all) } : undefined);
  };

  const addRule = (type: ElementRuleType) => writeRules([...rules, newRule(type, rules)]);

  const patchRule = (index: number, changes: Partial<ElementRule>) =>
    writeRules(rules.map((rule, i) => (i === index ? ({ ...rule, ...changes } as ElementRule) : rule)));

  // So o aviso acionavel fica no corpo. O "sem regra propria" explica um estado
  // normal, nao um problema, e por isso virou tooltip: ocupava uma linha
  // permanente para dizer que nada esta errado.
  /**
   * Texto depende do eixo: em Trigger nao existe field escolhido, e o aviso de
   * metrica mandaria o usuario procurar um campo que nao esta na tela.
   */
  const info =
    axis === 'trigger'
      ? 'Sem regra própria, o alarme usa as cores de severidade do Zabbix.'
      : 'Sem regra própria, o elemento segue os thresholds configurados no field.';

  const hint = axis === 'metric' && !color.field ? 'Escolha um campo acima para as regras terem efeito.' : undefined;

  return (
    <Field label={<FieldLabel info={info}>Thresholds</FieldLabel>}>
      <div className={styles.rules}>
        <Dropdown
          overlay={
            <Menu>
              {ruleTypes.map(({ type, label, description }) => (
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
            <ColorPicker color={rule.color} onChange={(next) => patchRule(index, { color: next })} />

            <div className={styles.condition}>
              <RuleCondition rule={rule} index={index} onChange={(changes) => patchRule(index, changes)} />
            </div>

            <Input
              className={styles.ruleLabel}
              value={rule.label ?? ''}
              placeholder="Rótulo"
              aria-label={`Texto exibido da regra ${index + 1}`}
              onChange={(event) => patchRule(index, { label: event.currentTarget.value || undefined })}
            />

            {/*
              A animacao e por regra, e nao do elemento: e o que permite `>= 75`
              pulsar e `> 90` fazer radar no mesmo campo. Tambem responde sozinha
              a pergunta que travava a extensao para metrica — nem toda regra e
              problema, e quem separa as que sao e o usuario.

              So no eixo de metrica: em Trigger a animacao e do elemento, para
              poder animar sem sobrescrever o mapa de cores do Zabbix.
            */}
            {axis === 'metric' && (
              <div className={styles.ruleAnimation}>
                {/*
                  Rotulo invisivel, e nao `aria-labelledby` com um texto solto: o
                  `Combobox` so aceita id, e sem um `<label>` de verdade o
                  controle fica sem nome acessivel — um leitor de tela anuncia
                  "combobox" e mais nada, numa linha com quatro controles iguais.
                */}
                <label className={styles.srOnly} htmlFor={`${ids}-animation-${index}`}>
                  {`Animação da regra ${index + 1}`}
                </label>
                <Combobox
                  id={`${ids}-animation-${index}`}
                  options={RULE_ANIMATION_OPTIONS}
                  value={('animation' in rule && rule.animation) || NO_ANIMATION}
                  onChange={(option) =>
                    patchRule(index, { animation: option.value === NO_ANIMATION ? undefined : option.value })
                  }
                />
              </div>
            )}

            <IconButton
              name="trash-alt"
              tooltip="Remover regra"
              onClick={() => writeRules(rules.filter((_, i) => i !== index))}
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

        {hint && <div className={styles.empty}>{hint}</div>}
      </div>
    </Field>
  );
}

interface RuleConditionProps {
  rule: ElementRule;
  index: number;
  onChange: (changes: Partial<ElementRule>) => void;
}

/**
 * A condicao muda com o tipo; cor e texto exibido sao iguais para todos.
 *
 * Devolve os controles crus, sem wrapper: quem dimensiona e o `.condition` do
 * pai, e e o que permite `range` distribuir dois campos no mesmo espaco que os
 * outros tipos ocupam com um.
 */
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

    case 'severity':
      return (
        <Combobox
          options={SEVERITY_OPTIONS as Array<{ value: Severity; label: string }>}
          value={rule.atLeast}
          aria-labelledby={`Severidade da regra ${position}`}
          onChange={(option) => onChange({ atLeast: option.value })}
        />
      );

    case 'special':
      return (
        <Combobox
          options={SPECIAL_OPTIONS as Array<{ value: SpecialMatch; label: string }>}
          value={rule.match}
          aria-labelledby={`Condição da regra ${position}`}
          onChange={(option) => onChange({ match: option.value })}
        />
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
    // Nasce em *High*, que e onde a maioria das topologias quer o primeiro
    // alarme visivel, e na cor que o mapa do Zabbix ja usa para esse nivel:
    // adicionar a regra nao muda nada sozinho, so abre a cor para edicao.
    case 'severity':
      return { type, atLeast: 4, color: 'red' };
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
    gap: theme.spacing(0.5),
  }),
  /**
   * Uma regra, uma linha: `[cor] [condicao] [rotulo] [lixeira]`.
   *
   * Sem card em volta. O card gastava borda e padding para agrupar dois
   * controles que agora estao lado a lado — e numa lista de cinco regras isso
   * eram cinco molduras competindo com o unico bloco que precisa de destaque, a
   * Base.
   *
   * `flexWrap` e o que resolve o caso de dois campos (`range`) sem trata-lo como
   * excecao no JSX. Numa linha de flex que quebra, os itens entram enquanto
   * couberem pelo `flex-basis`; com `range`, a condicao ocupa o dobro e empurra
   * rotulo e lixeira para a segunda linha. O layout se adapta a largura real do
   * painel, e nao ao tipo da regra — que era a saida obvia e a errada, porque a
   * mesma regra cabe ou nao cabe conforme o painel.
   */
  rule: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    // Mesma moldura da Base: cada regra e uma linha de valor, e o fundo e o que
    // as separa uma da outra numa lista de cinco. `background.primary` e nao
    // `secondary` porque o acordeao do elemento ja e `secondary` — fundo igual
    // sobre fundo igual nao se ve.
    padding: theme.spacing(0.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  /**
   * `minWidth: 0` em toda parte: sem ele, o tamanho minimo automatico de um item
   * de flex e o conteudo, e um `Input` com placeholder longo se recusaria a
   * encolher — o overflow horizontal que o painel estreito nao perdoa.
   */
  condition: css({
    flex: '1 1 88px',
    minWidth: 0,
    display: 'flex',
    gap: theme.spacing(0.5),

    // Os dois campos de `range` dividem o espaco em partes iguais.
    '> *': {
      flex: '1 1 0',
      minWidth: 0,
    },
  }),
  ruleLabel: css({
    flex: '1 1 88px',
    minWidth: 0,
  }),
  /**
   * Base menor que a do rotulo: o seletor de animacao tem quatro opcoes curtas e
   * nao precisa da mesma largura de um campo de texto livre. E o item que quebra
   * primeiro num painel estreito, que e o certo — ele e o mais dispensavel dos
   * quatro na hora de ler a regra.
   */
  ruleAnimation: css({
    flex: '1 1 72px',
    minWidth: 0,
  }),
  /** Fora da tela, dentro da arvore de acessibilidade. */
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
  /**
   * A Base tem a mesma moldura de um `Input`, que e como o editor nativo do
   * Grafana a desenha: e uma linha de valor, nao um item da lista de regras.
   *
   * `background.primary`, e nao `secondary`: o acordeao do elemento **ja e**
   * `background.secondary` (ver `ElementsEditor`), entao a versao anterior
   * pintava fundo igual sobre fundo igual e a Base ficava invisivel — o destaque
   * existia no codigo e nao na tela.
   */
  base: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  baseLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
