import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, Switch, useStyles2 } from '@grafana/ui';

import { drilldownHref, isInternal } from '../canvas/drilldown';
import { Drilldown } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { ToggleField } from './ToggleField';

/**
 * Drill-down: o link que o clique no elemento abre.
 *
 * Um componente so para os tres elementos que tem a funcao (No, Imagem e Texto)
 * pela mesma razao do `StateSection`: montado formulario a formulario, o mesmo
 * campo acabaria com tres comportamentos diferentes para a mesma pergunta.
 *
 * O link **nao navega no editor de painel** — la o clique ja seleciona o
 * elemento. Isso e contraintuitivo o bastante para merecer uma linha na tela em
 * vez de um comentario no codigo: sem ela, quem acabou de configurar clica,
 * nada acontece, e conclui que o campo nao funciona.
 */

/** Vinculo recem-criado. Espelha os defaults do schema; ver `drilldownSchema`. */
const NOVO_LINK: Drilldown = { url: '' };

interface DrilldownFieldProps {
  value: Drilldown | undefined;
  onChange: (next: Drilldown | undefined) => void;
}

export function DrilldownField({ value, onChange }: DrilldownFieldProps) {
  const styles = useStyles2(getStyles);
  const id = React.useId();

  const patch = (changes: Partial<Drilldown>) => onChange({ ...NOVO_LINK, ...value, ...changes });
  const url = value?.url ?? '';
  /** Ja com o esquema completado e as variaveis do dashboard resolvidas. */
  const alvo = drilldownHref(value);

  return (
    <ToggleField
      label="Drill-down"
      info="Ao clicar no elemento, abre este link. Serve tanto para outro dashboard deste Grafana quanto para outra plataforma — Zabbix, wiki, sistema de chamados."
      // Ausencia do valor e o desligado, como nos demais campos opcionais.
      enabled={value !== undefined}
      onToggle={(on) => onChange(on ? NOVO_LINK : undefined)}
    >
      <Field
        label={
          <FieldLabel info="Endereço de outra plataforma (https://…) ou caminho deste Grafana (/d/uid/…). Aceita variáveis do dashboard: ?var-host=$host resolve na hora do clique.">
            Link
          </FieldLabel>
        }
      >
        <Input
          value={url}
          placeholder="https://zabbix.corp/tr_events.php  ou  /d/uid/detalhe"
          aria-label="Link do drill-down"
          onChange={(event) => patch({ url: event.currentTarget.value })}
        />
      </Field>

      {/*
        O endereco que vai de fato abrir, e nao o que foi digitado.

        Existe por causa do unico jeito de errar este campo que o usuario nao
        tem como perceber sozinho: `www.google.com` sem esquema nao e um
        endereco, e o browser o resolve contra a pagina atual — o clique caia
        num 404 do Grafana em vez de sair para a outra plataforma. Hoje o
        esquema e completado, e esta linha e o que impede a correcao de virar
        uma suposicao silenciosa: quem precisa de `http://` ve `https://` aqui
        e corrige antes de salvar.
      */}
      {alvo && (
        <div className={styles.note}>
          {isInternal(alvo) ? 'Abre neste Grafana: ' : 'Sai do Grafana para: '}
          <span className={styles.target}>{alvo}</span>
        </div>
      )}

      {/* `label` explicito, e nao o `Field` do Grafana: com um `Switch` dentro,
          o `Field` renderiza o rotulo num `<span>` e o controle fica sem rotulo
          acessivel. Mesmo padrao do "Exibir triggers ativas". */}
      <div className={styles.switchRow}>
        <label className={styles.switchLabel} htmlFor={id}>
          <FieldLabel info="Desligado, o link abre no lugar do dashboard atual e o botão de voltar traz de volta. Ligado é o que um telão precisa: o mapa continua na tela.">
            Abrir em nova aba
          </FieldLabel>
        </label>
        <Switch
          id={id}
          value={value?.targetBlank === true}
          // `undefined` e nao `false`: ausente ja significa mesma aba, e gravar
          // o valor explicito so encheria o JSON do dashboard.
          onChange={(event) => patch({ targetBlank: event.currentTarget.checked || undefined })}
        />
      </div>

      {/* Permanente porque a condicao e permanente: no editor o clique
          seleciona o elemento, e sem esta linha quem acabou de configurar
          clica, nada acontece, e conclui que o campo nao funciona. */}
      <div className={styles.note}>No editor de painel o clique seleciona o elemento; o link só abre no dashboard.</div>
    </ToggleField>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  switchRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  switchLabel: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
  }),
  note: css({
    marginTop: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  /** O endereco em si, destacado do texto que o apresenta. */
  target: css({
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    wordBreak: 'break-all',
  }),
});
