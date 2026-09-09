import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Checkbox,
  ColorPicker,
  Combobox,
  ComboboxOption,
  Dropdown,
  Field,
  IconButton,
  Input,
  Menu,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

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
 *
 * **Este bloco e a unica fonte de cor por metrica do elemento.** O Thresholds do
 * painel de opcoes do Grafana nao concorre com ele desde 2026-09-02: enquanto
 * concorria, uma Base escolhida aqui podia ser ignorada em favor de um step
 * configurado em outra tela, sem nada nesta dizer isso. Ver a cadeia em
 * `data/elementColor`.
 */

/** Escala usada ao adicionar thresholds em sequencia, do mais leve ao mais grave. */
const THRESHOLD_COLORS = ['yellow', 'orange', 'red', 'dark-red'];

/** Mapeamentos nao tem gravidade implicita; azul e o neutro informativo. */
const MAPPING_COLOR = 'blue';

/**
 * Regra que o usuario adiciona a mao. A severidade fica de fora: no eixo de
 * Trigger a lista nao e montada regra a regra, e sim uma escada fixa com os seis
 * niveis do Zabbix (ver `SeverityLadder`).
 */
type MetricRuleType = Exclude<ElementRuleType, 'severity'>;

const METRIC_RULE_TYPES: Array<{ type: MetricRuleType; label: string; description: string }> = [
  { type: 'threshold', label: 'Threshold', description: 'A partir de um valor' },
  { type: 'value', label: 'Valor', description: 'Valor exato' },
  { type: 'range', label: 'Faixa', description: 'Entre dois valores' },
  { type: 'regex', label: 'Regex', description: 'Expressão regular' },
  { type: 'special', label: 'Especial', description: 'Nulo, NaN, booleanos' },
];

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
  /**
   * Campo aposentado do elemento, so de leitura: a escada o exibe e o dobra para
   * dentro das regras na primeira edicao. Ver `elementAlertSchema`.
   */
  alert?: ElementAlert;
  /** A aresta nao recebe anel de radar; ver `EDGE_CLASS` em `alertAnimation`. */
  allowRadar?: boolean;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
  /** Chamado com `undefined` quando o `alert` legado termina de ser dobrado. */
  onAlertChange?: (next: ElementAlert | undefined) => void;
}

export function ThresholdsEditor({
  axis,
  color,
  thresholds,
  alert,
  allowRadar = true,
  onColorChange,
  onThresholdsChange,
  onAlertChange,
}: ThresholdsEditorProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const ids = React.useId();

  /**
   * A lista exibida e so a do eixo atual, mas toda escrita devolve **a lista
   * inteira**: as regras do outro eixo viajam junto, intactas. Sem isso,
   * adicionar uma cor de severidade apagaria os thresholds de metrica do mesmo
   * elemento — e alternar os modos deixaria de ser gratuito, que e uma
   * propriedade que o binding de trigger tem desde que existe.
   */
  const hidden = axis === 'trigger' ? metricRules(thresholds) : severityRules(thresholds);
  const rules = metricRules(thresholds);

  const writeRules = (next: ElementRule[]) => {
    const all = [...hidden, ...next];
    // Lista vazia grava `undefined`, e nao `{ steps: [] }`: e a ausencia de
    // regra, e e ela que faz o elemento repousar na Base.
    onThresholdsChange(all.length > 0 ? { steps: sortRules(all) } : undefined);
  };

  const addRule = (type: MetricRuleType) => writeRules([...rules, newRule(type, rules)]);

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
      ? 'Uma cor por severidade do Zabbix. Enquanto não mexer em nenhuma, valem as cores padrão do Zabbix.'
      : 'As regras daqui são as únicas que pintam o elemento — o Thresholds do painel formata o valor, não a cor. Sem regra, vale a Base.';

  const hint =
    axis === 'metric' && !hasStateBinding(color) ? 'Escolha uma métrica acima para as regras terem efeito.' : undefined;

  return (
    <Field label={<FieldLabel info={info}>Thresholds</FieldLabel>}>
      <div className={styles.rules}>
        {/*
          Em Trigger nao ha o que adicionar: a lista de severidades do Zabbix e
          fechada, e as seis linhas ja estao na tela. O botao so faz sentido no
          eixo onde o usuario inventa as regras.
        */}
        {axis === 'metric' && (
          <Dropdown
            overlay={
              <Menu>
                {METRIC_RULE_TYPES.map(({ type, label, description }) => (
                  <Menu.Item key={type} label={label} description={description} onClick={() => addRule(type)} />
                ))}
              </Menu>
            }
          >
            <Button variant="secondary" size="sm" icon="plus" fullWidth>
              Adicionar regra
            </Button>
          </Dropdown>
        )}

        {axis === 'trigger' && (
          <SeverityLadder
            thresholds={thresholds}
            alert={alert}
            allowRadar={allowRadar}
            onChange={(next) => {
              writeRules(next);
              // O `alert` acabou de virar coluna das regras; deixa-lo no JSON
              // seria uma segunda fonte de animacao, invisivel na tela.
              if (alert) {
                onAlertChange?.(undefined);
              }
            }}
          />
        )}

        {axis === 'metric' &&
          rules.map((rule, index) => (
            // O indice como chave e seguro aqui: a lista e reordenada a cada
            // escrita, entao qualquer id estavel divergiria da ordem exibida no
            // mesmo instante.
            <div key={index} className={styles.rule}>
              <ColorPicker
                enableNamedColors
                color={rule.color}
                onChange={(next) => patchRule(index, { color: next })}
              />

              <div className={styles.condition}>
                <RuleCondition rule={rule} index={index} onChange={(changes) => patchRule(index, changes)} />
              </div>

              {/*
                A animacao e por regra, e nao do elemento: e o que permite `>= 75`
                pulsar e `> 90` fazer radar no mesmo campo. Tambem responde sozinha
                a pergunta que travava a extensao para metrica — nem toda regra e
                problema, e quem separa as que sao e o usuario.
              */}
              <AnimationPicker
                id={`${ids}-animation-${index}`}
                label={`Animação da regra ${index + 1}`}
                value={rule.animation}
                allowRadar={allowRadar}
                onChange={(animation) => patchRule(index, { animation })}
              />

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

          Sem cor escolhida, a amostra mostra a **superficie neutra do tema** —
          que e o que o elemento de fato exibe em repouso —, e nao verde. O
          verde de antes era um placeholder que o modelo nao guardava: ligar o
          Background de uma imagem e passar para o modo Estado deixava a placa
          neutra no canvas enquanto esta linha exibia verde, e a unica forma de
          faze-los concordar era abrir o seletor e escolher a cor que ja parecia
          estar escolhida. Verde ainda por cima e a pior cor possivel para um
          placeholder num NOC: le-se "verificado OK" sem nada ter sido
          verificado.
        */}
        <div className={styles.base}>
          <ColorPicker
            enableNamedColors
            color={color.fixed ?? theme.colors.background.secondary}
            onChange={(fixed) => onColorChange({ ...color, fixed })}
          />
          <span className={styles.baseLabel}>Base</span>
        </div>

        {hint && <div className={styles.empty}>{hint}</div>}
      </div>
    </Field>
  );
}

interface AnimationPickerProps {
  id: string;
  /** Nome acessivel do controle; nao aparece na tela. */
  label: string;
  value: AlertAnimation | undefined;
  allowRadar: boolean;
  onChange: (next: AlertAnimation | undefined) => void;
}

/**
 * A coluna de animacao, identica nos dois eixos — que e o ponto: a animacao
 * pertence a regra que casou, seja ela uma faixa de metrica ou uma severidade.
 *
 * O rotulo e um `<label>` de verdade fora da tela, e nao um `aria-labelledby`
 * com texto solto: o `Combobox` so aceita `id`, e sem isso o controle fica sem
 * nome acessivel — um leitor de tela anuncia "combobox" e mais nada, numa lista
 * com seis controles iguais.
 */
function AnimationPicker({ id, label, value, allowRadar, onChange }: AnimationPickerProps) {
  const styles = useStyles2(getStyles);
  const options = allowRadar ? RULE_ANIMATION_OPTIONS : RULE_ANIMATION_OPTIONS.filter((o) => o.value !== 'radar');

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

interface SeverityLadderProps {
  thresholds: ElementThresholds | undefined;
  alert: ElementAlert | undefined;
  allowRadar: boolean;
  /** Recebe **so** as regras de severidade; o `writeRules` do pai junta o resto. */
  onChange: (next: ElementRule[]) => void;
}

/**
 * As seis severidades do Zabbix, cada uma com a sua cor.
 *
 * Substitui o "Adicionar regra -> Severidade" que existia aqui. O menu era
 * tecnicamente completo e praticamente invisivel: um dropdown de uma opcao so,
 * numa lista que nascia vazia, para configurar um vocabulario **fechado** que o
 * usuario ja conhece de cor. Quem abria o modo Trigger via um bloco de
 * thresholds sem nada dentro e concluia — com razao — que ele nao servia para
 * trigger.
 *
 * A escada mostra o mapa inteiro de saida, ja preenchido com as cores padrao do
 * Zabbix, e a edicao vira o que ela aparenta ser: trocar a cor de uma linha.
 *
 * Enquanto ninguem toca em nada, nao ha regra salva e vale o mapa do Zabbix — a
 * primeira edicao materializa a escada inteira (ver `writeSeverityLadder`), e o
 * "Restaurar padrao" desfaz isso de uma vez.
 */
function SeverityLadder({ thresholds, alert, allowRadar, onChange }: SeverityLadderProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const ids = React.useId();
  const rows = severityLadder(thresholds, alert);
  const custom = severityRules(thresholds).length > 0 || alert !== undefined;

  const patch = (severity: Severity, changes: Partial<SeverityLadderRow>) =>
    // `text.secondary` e o padrao de *Not classified*, o unico nivel sem cor no
    // mapa do Zabbix; so chega aqui se o usuario editar aquela linha.
    onChange(writeSeverityLadder(thresholds, severity, changes, theme.colors.text.secondary, alert));

  return (
    <>
      {rows.map(({ severity, color, animation, enabled }) => (
        // A linha desligada continua editavel, so esmaecida: o usuario costuma
        // desligar e religar o mesmo nivel enquanto ajusta o painel, e desativar
        // os controles obrigaria a religar antes de trocar a cor.
        <div key={severity} className={cx(styles.rule, !enabled && styles.ruleOff)}>
          {/* Governa a linha inteira, entao abre a linha — e a leitura de uma
              lista de itens que se incluem ou nao. */}
          <Checkbox
            value={enabled}
            aria-label={`Atender ${SEVERITY_LABEL[severity]}`}
            onChange={(event) => patch(severity, { enabled: event.currentTarget.checked })}
          />

          <ColorPicker
            enableNamedColors
            color={color ?? theme.colors.text.secondary}
            onChange={(next) => patch(severity, { color: next })}
          />

          <span className={styles.severityName}>{SEVERITY_LABEL[severity]}</span>

          <AnimationPicker
            id={`${ids}-animation-${severity}`}
            label={`Animação de ${SEVERITY_LABEL[severity]}`}
            value={animation}
            allowRadar={allowRadar}
            onChange={(next) => patch(severity, { animation: next })}
          />
        </div>
      ))}

      {custom && (
        <Button variant="secondary" fill="text" size="sm" icon="history" onClick={() => onChange([])}>
          Restaurar padrão do Zabbix
        </Button>
      )}
    </>
  );
}

interface RuleConditionProps {
  rule: MetricRule;
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
  /**
   * O nome da severidade ocupa o lugar da condicao, mas nao e um campo: nao ha o
   * que escolher ali. `flex-basis` igual ao da condicao mantem as seis linhas
   * alinhadas com as regras de metrica, e `nowrap` impede que *Not classified*
   * quebre em duas linhas num painel estreito.
   */
  /**
   * Esmaecida, e nao escondida: o nivel desligado continua na escada porque a
   * escada e o mapa completo de severidades — sumir com a linha faria parecer
   * que o Zabbix tem cinco niveis.
   */
  ruleOff: css({
    opacity: 0.55,
  }),
  severityName: css({
    flex: '1 1 88px',
    minWidth: 0,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
