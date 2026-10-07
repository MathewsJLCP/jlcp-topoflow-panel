import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { TextArea, useStyles2 } from '@grafana/ui';

import { insertTemplateField, isDisplayableField, missingTemplateFields } from '../data/dimensions';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixItemCatalog, useZabbixMetricNames } from './zabbixSource';

/**
 * Texto que combina palavra e metrica, no formato dos mapas do Zabbix:
 *
 *     IN:  ${AGLIN-FW: traffic in}
 *     OUT: ${AGLIN-FW: traffic out}
 *     Status: ${AGLIN-FW: oper status}
 *
 * E um `TextArea`, e nao um `Input`, porque o pedido nasceu de tres linhas — e
 * uma so linha obrigaria o usuario a espremer tres leituras num rotulo
 * horizontal que ja e o elemento mais apertado do canvas.
 *
 * O seletor abaixo existe para que ninguem precise **digitar** o nome do field.
 * O nome de exibicao real e coisa como `ACRILICO-SRV-AD: ICMP ping`: acertar
 * isso de cabeca, com dois-pontos e espacos no lugar certo, e a diferenca entre
 * o recurso funcionar e o usuario achar que ele nao funciona. Escolher no
 * seletor insere `${...}` pronto, no ponto onde o cursor estava.
 */

interface TemplateTextFieldProps {
  frames: DataFrame[];
  value: string;
  placeholder?: string;
  rows?: number;
  'aria-label'?: string;
  onChange: (next: string) => void;
}

export function TemplateTextField({
  frames,
  value,
  placeholder,
  rows = 3,
  'aria-label': ariaLabel,
  onChange,
}: TemplateTextFieldProps) {
  const styles = useStyles2(getStyles);

  /**
   * Onde inserir a proxima metrica. `null` enquanto o usuario nao tocou no
   * texto, e ai a insercao vai para o fim — que e o certo para quem acabou de
   * abrir o campo. Ler `selectionStart` so na hora do clique nao serve: o
   * `Combobox` rouba o foco, e o textarea desfocado ja perdeu a posicao.
   */
  const caret = React.useRef<number | null>(null);

  const rememberCaret = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    caret.current = event.currentTarget.selectionStart;
  };

  const insertField = (field?: string) => {
    if (!field) {
      return;
    }

    const at = caret.current ?? value.length;

    onChange(insertTemplateField(value, at, field));
    // Depois da inserção o cursor fica **depois** do que entrou: inserir duas
    // métricas em sequência produz `${a}${b}`, e não `${b}${a}`.
    caret.current = at + field.length + 3;
  };

  /*
    As series que o painel busca direto no Zabbix nao estao nos frames do editor
    — elas so existem quando o painel desenha. Entram no seletor para poderem
    ser inseridas, e saem da conta do aviso: acusar "sem correspondencia" uma
    metrica que o painel busca e vai exibir seria mentira, e foi assim que o
    aviso apareceu num painel funcionando.
  */
  const doZabbix = useZabbixMetricNames();
  // Alem do que ja esta vinculado, o combo oferece o catalogo de itens dos hosts
  // que o mapa usa: escolher uma metrica costuma ser o ato de vincular a
  // primeira, e ai `doZabbix` ainda esta vazio.
  const catalogo = useZabbixItemCatalog();
  const missing = missingTemplateFields(value, frames).filter((nome) => !doZabbix.includes(nome));

  return (
    <div className={styles.wrapper}>
      <TextArea
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.currentTarget.value)}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
      />

      <TopoFieldPicker
        frames={frames}
        extras={doZabbix}
        loadExtras={catalogo}
        // Sempre vazio: o seletor aqui e um botao de inserir, nao o dono de um
        // valor. Guardar a ultima escolha faria o campo parecer um vinculo — e
        // um rotulo com tres metricas nao tem "a" metrica selecionada.
        value={undefined}
        onChange={insertField}
        placeholder="Inserir métrica"
        // O `Problems` das queries de Problems e um array de objetos: inserido
        // aqui, nao produzia texto nenhum e nao havia como explicar por que.
        filter={isDisplayableField}
      />

      {missing.length > 0 && (
        <div className={styles.warning}>
          {missing.length === 1
            ? `Sem correspondência nas séries: ${missing[0]}`
            : `Sem correspondência nas séries: ${missing.join(', ')}`}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  /**
   * Aviso, e nao erro: o texto continua valido e o painel continua desenhando.
   * O que ele diz e que aquele `${...}` vai aparecer cru no canvas.
   */
  warning: css({
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
