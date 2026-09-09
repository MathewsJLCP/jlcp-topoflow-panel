import React from 'react';

import { IconPack } from '../types';

/**
 * Os icones com que o TopoFlow nasceu — ativos de rede em traco.
 *
 * Desenhados aqui em vez de vir de um pacote porque **nao existe conjunto
 * pronto que sirva**: o `@grafana/ui` expoe 115 icones e nenhum deles e switch,
 * servidor, load balancer, access point ou storage — os cinco que uma topologia
 * de rede mais usa. As alternativas seriam mapear para o icone "mais parecido"
 * (um switch virando `apps` nao comunica nada) ou adicionar uma dependencia
 * inteira para dez glifos, num plugin que precisa ser assinado.
 *
 * Viraram um **pack** quando a biblioteca ganhou pastas. O `id` e `classic`, e
 * nao `default`, porque o pack padrao passou a ser outro — mas as chaves curtas
 * (`router`, sem pack) continuam apontando para ca, que e o que faz toda
 * topologia ja salva carregar sem migrador. Ver `registry.ts`.
 *
 * Regras do traco, para quem for adicionar um icone:
 *
 *   - `viewBox` 24x24, sempre.
 *   - Contorno, nunca preenchimento: `stroke="currentColor"` com `fill="none"`.
 *     A cor vem de quem renderiza — e o que faz o icone seguir a cadeia de cor
 *     do elemento sem saber nada sobre ela.
 *   - Preenchimento so em detalhe solido (LED, eixo de disco), e ai declarado
 *     no proprio shape com `fill="currentColor"` e `stroke="none"`.
 *   - Margem de ~2px ate a borda do viewBox, para os glifos parecerem do mesmo
 *     tamanho quando trocados no mesmo lugar.
 */

/** Detalhe solido — LED de chassi, eixo de disco. */
const dot = (cx: number, cy: number, key?: string) => (
  <circle key={key} cx={cx} cy={cy} r={0.9} fill="currentColor" stroke="none" />
);

const SHAPES = {
  /** Chassi de duas unidades, com LED em cada uma. */
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      {dot(6.5, 7.5)}
      {dot(6.5, 16.5)}
    </>
  ),

  /** Setas opostas: trafego comutado entre portas. */
  switch: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h9m-2.5-2.5L15 10l-2.5 2.5" />
      <path d="M18 14H9m2.5-2.5L9 14l2.5 2.5" />
    </>
  ),

  /** Chassi com setas de entrada e saida: trafego roteado entre redes. */
  router: (
    <>
      <rect x="2" y="12" width="20" height="9" rx="2" />
      {dot(6, 16.5)}
      {dot(9.5, 16.5)}
      <path d="M14 3v6m0-6-2 2m2-2 2 2" />
      <path d="M18.5 9V3m0 6-2-2m2 2 2-2" />
    </>
  ),

  /** Muro de tijolos — distingue do `shield`, que ja significa seguranca. */
  firewall: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <path d="M2.5 9.7h19M2.5 14.3h19" />
      <path d="M9 5v4.7M15 5v4.7" />
      <path d="M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6" />
      <path d="M9 14.3V19M15 14.3V19" />
    </>
  ),

  /** Cilindro classico de banco de dados. */
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),

  cloud: <path d="M7 18.5a4.5 4.5 0 0 1 .38-8.98 6 6 0 0 1 11.42 1.55A3.75 3.75 0 0 1 18 18.5H7Z" />,

  /** Uma entrada distribuida em tres saidas. */
  'load-balancer': (
    <>
      <circle cx="4.5" cy="12" r="2.5" />
      <circle cx="19" cy="5.5" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="19" cy="18.5" r="2" />
      <path d="M7 12h10M6.6 10.6 17.2 6.2M6.6 13.4l10.6 4.4" />
    </>
  ),

  /** Base com ondas de propagacao. */
  'access-point': (
    <>
      <rect x="7" y="16" width="10" height="4.5" rx="1.5" />
      {dot(12, 18.25)}
      <path d="M8.5 12.5a5 5 0 0 1 7 0" />
      <path d="M6 9.8a8.5 8.5 0 0 1 12 0" />
    </>
  ),

  /** Disco: prato com eixo e braco de leitura. */
  storage: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="9.5" cy="12" r="3.5" />
      {dot(9.5, 12)}
      <path d="M12.3 14.1 16 17" />
      {dot(18, 8)}
    </>
  ),

  /** Ativo sem tipo definido. E o fallback de tudo. */
  generic: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </>
  ),
} as const;

/**
 * Ordem de exibicao: dos ativos mais comuns aos mais especificos, com o
 * generico por ultimo — ele e o fallback, nao uma escolha de primeira linha.
 */
const ORDER: Array<[keyof typeof SHAPES, string, string[]?]> = [
  ['server', 'Servidor', ['host', 'maquina', 'vm']],
  ['switch', 'Switch', ['comutador', 'lan']],
  ['router', 'Roteador', ['gateway', 'borda']],
  ['firewall', 'Firewall', ['fw', 'seguranca']],
  ['load-balancer', 'Load balancer', ['balanceador', 'lb']],
  ['access-point', 'Access point', ['ap', 'wifi', 'wireless']],
  ['database', 'Banco de dados', ['db', 'sql']],
  ['storage', 'Storage', ['disco', 'nas', 'san']],
  ['cloud', 'Nuvem', ['cloud', 'internet', 'wan']],
  ['generic', 'Genérico', ['outro', 'ativo']],
];

export const classicPack: IconPack = {
  id: 'classic',
  label: 'Clássicos',
  icons: ORDER.map(([name, label, keywords]) => ({
    name,
    label,
    keywords,
    art: { kind: 'glyph', shape: SHAPES[name] },
  })),
};

/** O fallback de tudo: chave vazia, desconhecida ou de um pack que sumiu. */
export const FALLBACK_ICON = 'generic';
