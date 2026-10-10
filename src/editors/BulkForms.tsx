import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Combobox, Field, Slider, useStyles2 } from '@grafana/ui';

import { updateEdges, updatePoints } from '../model/mutations';
import { TopoEdge, TopoPoint, Topology } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { StateSection } from './StateSection';
import { TemplateTextField } from './TemplateTextField';
import { ANIMATION_OPTIONS, SHAPE_OPTIONS, STYLE_OPTIONS } from './ElementForms';
import { Segmented } from './ui/Segmented';
import { FONT_MONO, FONT_SANS, tfPalette } from '../theme/palette';

/**
 * Edicao em massa dos elementos selecionados no canvas.
 *
 * Dois formularios, um por tipo, porque os tipos nao tem os mesmos campos: a
 * Conexao tem geometria propria (estilo, forma, espessura, rotulo, animacao) e o
 * Point nao tem nenhuma — o formulario dele **e** o bloco de Estado. Um
 * formulario unico teria de esconder metade de si conforme a selecao, e o que a
 * tela ganharia em unidade perderia em clareza.
 *
 * Selecionando os dois tipos juntos aparecem os dois blocos, cada um dizendo
 * quantos edita. E o caso do caminho por points, onde o enlace **e** os
 * segmentos mais as ancoras: configurar os dois de uma vez e o pedido inteiro.
 *
 * ## O problema que ela resolve
 *
 * Um caminho montado com points nao e uma conexao, sao varias: ligar A a B
 * passando por tres ancoras cria quatro arestas e tres ancoras. Elas
 * representam **um** enlace e por isso precisam da mesma configuracao — mesma
 * trigger, mesmos thresholds. Configurar uma a uma nao e so trabalhoso: basta
 * esquecer um segmento para o caminho acender pela metade, e o mapa passa a
 * mentir.
 *
 * ## A regra que governa tudo aqui
 *
 * **So o campo que o usuario mexe e escrito.** O formulario nao e um retrato de
 * uma aresta que, ao salvar, cai por cima das outras — cada controle escreve o
 * seu proprio campo em todas as selecionadas e nao toca em mais nada. E o que
 * permite mudar a espessura de quatro conexoes sem achatar os rotulos, que sao
 * diferentes em cada uma.
 *
 * ## O que aparece nos controles
 *
 * Quando as selecionadas concordam, o valor comum. Quando divergem, o controle
 * fica **vazio** e a linha diz "valores diferentes" — mentir um valor unico
 * (mostrando o da primeira, por exemplo) faria o usuario acreditar que ja esta
 * tudo igual, que e exatamente o engano que este formulario existe para desfazer.
 *
 * O bloco de Estado e a excecao consciente: `trigger` e `thresholds` sao objetos
 * com lista dentro, e um "misto" util exigiria comparar regra a regra para
 * exibir uma escada meio preenchida. Ele e semeado com a primeira selecionada e
 * o que sair dali vai inteiro para todas — que e justamente o que se quer ao
 * vincular um caminho a uma trigger. O aviso no topo diz isso.
 */

/** Moldura comum: quantos elementos, e o contrato da edicao em massa. */
function BulkSection({ title, glyph, children }: { title: string; glyph: string; children: React.ReactNode }) {
  const styles = useStyles2(getStyles);

  // O cartao do mockup: mesmo desenho do cartao de um elemento so, com o glifo
  // do tipo e o aviso de que cada campo vale para todos.
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.glyph}>{glyph}</span>
        <div className={styles.titleBox}>
          <span className={styles.count}>{title}</span>
          <span className={styles.hint}>Cada campo alterado vale para todos.</span>
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/**
 * Aviso de que o bloco de Estado nao e um retrato fiel da selecao.
 *
 * Os controles de estado sao semeados com o **primeiro** selecionado, porque
 * `trigger` e `thresholds` sao objetos com lista dentro e um "misto" util
 * exigiria comparar regra a regra para exibir uma escada meio preenchida.
 *
 * Quando os selecionados ja concordam, a semente **e** a verdade e o aviso nao
 * aparece — que e o caso comum de quem acabou de criar um caminho. Ele so entra
 * quando ha divergencia de fato, e ai ele e a diferenca entre uma escolha
 * informada e uma surpresa.
 */
function StateSeedNote({ elements, count }: { elements: StatefulElement[]; count: number }) {
  const styles = useStyles2(getStyles);
  const divergem = !sameState(elements);

  return (
    <div className={styles.stateNote}>
      {divergem
        ? `Os selecionados não têm a mesma configuração de estado. O bloco abaixo parte do primeiro e é aplicado por inteiro aos ${count}.`
        : `O bloco abaixo é aplicado por inteiro aos ${count}.`}
    </div>
  );
}

/** O que o bloco de Estado le e escreve, em qualquer elemento que o tenha. */
type StatefulElement = Pick<TopoEdge, 'trigger' | 'color' | 'thresholds' | 'alert'>;

/**
 * Os selecionados ja tem a mesma configuracao de estado?
 *
 * Comparacao por JSON, e nao campo a campo: sao objetos aninhados com listas
 * dentro, e o que se pergunta aqui e "sao iguais?", nao "onde diferem?". A
 * ordem das chaves e estavel porque todos vem do mesmo parse Zod.
 *
 * Exportada para teste: e a regra que decide se a tela avisa ou se cala.
 */
export function sameState(elements: StatefulElement[]): boolean {
  const chave = (element: StatefulElement) =>
    JSON.stringify([element.trigger, element.color, element.thresholds, element.alert]);
  const [primeiro, ...resto] = elements.map(chave);

  return resto.every((atual) => atual === primeiro);
}

interface BulkEdgeFormProps {
  edges: TopoEdge[];
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

export function BulkEdgeForm({ edges, topology, frames, onChange }: BulkEdgeFormProps) {
  const ids = edges.map((edge) => edge.id);
  const patch = (changes: Partial<TopoEdge>) => onChange(updateEdges(topology, ids, changes));

  /** A primeira selecionada. Semente dos controles que nao sabem exibir "misto". */
  const [primeira] = edges;

  return (
    <BulkSection title={`${edges.length} conexões selecionadas`} glyph="—">
      <MixedField label="Estilo" values={edges.map((edge) => edge.style)}>
        {(comum) => (
          <Segmented options={STYLE_OPTIONS} value={comum} onChange={(style) => patch({ style })} fullWidth />
        )}
      </MixedField>

      <MixedField label="Forma" values={edges.map((edge) => edge.shape)}>
        {(comum) => (
          <Segmented options={SHAPE_OPTIONS} value={comum} onChange={(shape) => patch({ shape })} fullWidth />
        )}
      </MixedField>

      {/*
        O `Slider` nao tem estado vazio: ele sempre desenha uma alca em algum
        lugar. Com espessuras diferentes ele parte da menor, e nao da primeira —
        assim o gesto de arrastar so **aumenta**, e ninguem afina uma conexao
        sem querer ao encostar no controle.
      */}
      <MixedField label="Espessura" values={edges.map((edge) => edge.width)}>
        {(comum) => (
          <Slider
            min={1}
            max={10}
            step={0.5}
            value={comum ?? Math.min(...edges.map((edge) => edge.width))}
            onChange={(width) => patch({ width })}
          />
        )}
      </MixedField>

      <MixedField
        label={
          <FieldLabel info="Substitui o rótulo de todas as selecionadas. Use ${nome do field} para exibir o valor de uma métrica.">
            Rótulo
          </FieldLabel>
        }
        values={edges.map((edge) => edge.label ?? '')}
      >
        {(comum, misto) => (
          <TemplateTextField
            frames={frames}
            value={comum ?? ''}
            placeholder={misto ? 'Rótulos diferentes' : 'Sem rótulo. Ex.: IN: ${traffic in}'}
            aria-label="Rótulo"
            onChange={(label) => patch({ label: label || undefined })}
          />
        )}
      </MixedField>

      <MixedField label="Animação" values={edges.map((edge) => edge.animation)}>
        {(comum) => (
          <Combobox
            options={ANIMATION_OPTIONS}
            value={comum ?? null}
            placeholder="Animações diferentes"
            onChange={(selected) => patch({ animation: selected?.value ?? 'none' })}
          />
        )}
      </MixedField>

      {/*
        O bloco inteiro de estado, semeado com a primeira selecionada: e o campo
        que motivou o pedido — um caminho de cinco segmentos tem de acender junto,
        e para isso as cinco arestas precisam do **mesmo** vinculo.
      */}
      <StateSeedNote elements={edges} count={edges.length} />

      <StateSection
        frames={frames}
        trigger={primeira.trigger}
        color={primeira.color}
        thresholds={primeira.thresholds}
        alert={primeira.alert}
        // Mesma razao do formulario individual: a aresta e um traco, e nao ha
        // superficie de onde emitir a onda do radar. O grafico de hover sai pelo
        // mesmo motivo: o painel da aresta pendura no chip de alarme.
        allowRadar={false}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onAlertChange={(alert) => patch({ alert })}
      />
    </BulkSection>
  );
}

interface BulkPointFormProps {
  points: TopoPoint[];
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

/**
 * Edicao em massa dos points.
 *
 * Mais curto que o da Conexao porque o point **e** so estado: ele nao tem texto,
 * icone, valor nem geometria configuravel — o formulario individual dele ja e um
 * `StateSection` e mais nada. Nao ha campo primitivo a comparar, e por isso nao
 * ha "valores diferentes" aqui: o que existe e a nota de semente, que aparece
 * quando os selecionados divergem.
 *
 * Cada controle do bloco escreve **so o seu campo** em todos — a mesma regra da
 * Conexao. Trocar a trigger de cinco ancoras nao mexe nos thresholds delas.
 */
export function BulkPointForm({ points, topology, frames, onChange }: BulkPointFormProps) {
  const ids = points.map((point) => point.id);
  const patch = (changes: Partial<TopoPoint>) => onChange(updatePoints(topology, ids, changes));

  const [primeiro] = points;

  return (
    <BulkSection title={`${points.length} points selecionados`} glyph="•">
      <StateSeedNote elements={points} count={points.length} />

      <StateSection
        frames={frames}
        trigger={primeiro.trigger}
        color={primeiro.color}
        thresholds={primeiro.thresholds}
        alert={primeiro.alert}
        chart={primeiro.chart}
        onChartChange={(chart) => patch({ chart })}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onAlertChange={(alert) => patch({ alert })}
      />
    </BulkSection>
  );
}

interface MixedFieldProps<T> {
  label: React.ReactNode;
  values: T[];
  /** Recebe o valor comum (`undefined` quando divergem) e se ha divergencia. */
  children: (comum: T | undefined, misto: boolean) => React.ReactElement;
}

/**
 * Um campo do formulario em massa: o rotulo, o controle, e a marca de que as
 * selecionadas divergem naquele campo.
 *
 * A marca fica no **rotulo**, e nao dentro do controle, porque nem todo controle
 * tem estado vazio para emprestar — o `Slider` sempre desenha uma alca em algum
 * lugar, e o `RadioButtonGroup` sem opcao marcada nao explica por que.
 */
function MixedField<T>({ label, values, children }: MixedFieldProps<T>) {
  const styles = useStyles2(getStyles);
  const comum = commonValue(values);
  const misto = comum === undefined && values.length > 0;

  return (
    <Field
      label={
        <span className={styles.label}>
          {label}
          {misto && <span className={styles.mixed}>valores diferentes</span>}
        </span>
      }
    >
      {children(comum, misto)}
    </Field>
  );
}

/**
 * O valor que todos compartilham, ou `undefined` quando divergem.
 *
 * Comparacao por `===`: todos os campos que passam por aqui sao primitivos (o
 * estilo, a forma, a espessura, o rotulo, a animacao). Objetos — `trigger`,
 * `thresholds`, `color` — nao usam este caminho, e e por isso que o bloco de
 * Estado e semeado em vez de comparado.
 *
 * Exportada para teste: e a regra que decide o que a tela mostra, e testa-la
 * pelo DOM exigiria montar o formulario inteiro para verificar uma comparacao.
 */
export function commonValue<T>(values: T[]): T | undefined {
  const [primeiro, ...resto] = values;
  return resto.every((value) => value === primeiro) ? primeiro : undefined;
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    marginBottom: 12,
    border: `1px solid ${tfPalette(theme).ac}`,
    borderRadius: 10,
    background: tfPalette(theme).fundo,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '9px 10px',
    background: `color-mix(in oklab, ${tfPalette(theme).ac} 10%, ${tfPalette(theme).sup})`,
    borderBottom: `1px solid ${tfPalette(theme).borda}`,
  }),
  glyph: css({
    flex: 'none',
    width: 24,
    height: 24,
    borderRadius: 6,
    background: tfPalette(theme).ac,
    color: tfPalette(theme)['on-ac'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: `600 12px ${FONT_MONO}`,
  }),
  titleBox: css({ display: 'flex', flexDirection: 'column', minWidth: 0 }),
  count: css({ font: `600 13px ${FONT_SANS}`, color: tfPalette(theme).tf }),
  hint: css({ font: `11px ${FONT_SANS}`, color: tfPalette(theme).tx2 }),
  body: css({ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }),
  label: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  }),
  /**
   * Discreta de proposito: e uma constatacao sobre a selecao, nao um problema a
   * resolver. Em `warning.text` a tela ficaria pintada de amarelo so por alguem
   * ter seleccionado duas conexoes diferentes, que e o caso normal aqui.
   */
  mixed: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
  }),
  stateNote: css({
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
