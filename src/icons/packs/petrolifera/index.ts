import { IconPack } from '../../types';

import i_estacao from './estacao.png';
import i_radio_cambium from './radio-cambium.png';
import i_religador from './religador.png';
import i_sensor_temperatura from './sensor-temperatura.png';
import i_sonda from './sonda.png';
import i_sonda_frac from './sonda-frac.png';
import i_torre from './torre.png';
import i_unifi_ac_lite from './unifi-ac-lite.png';
import i_unifi_ac_mesh from './unifi-ac-mesh.png';
import i_unifi_ac_mesh_pro from './unifi-ac-mesh-pro.png';
import i_unifi_ac_pro from './unifi-ac-pro.png';

/**
 * O pack **Petrolífera**: os ativos que o cliente ja usa no monitoramento dele
 * — sonda, estacao, religador — ao lado dos radios e APs que ligam o campo.
 *
 * ## Por que aqui a natureza e `image`, e nao `variants`
 *
 * Sao fotos e ilustracoes de produto, cada uma com as cores do equipamento real.
 * Nao existe a mesma arte em seis tons, e inventa-los por rotacao de matiz — o
 * que foi feito no pack Padrao — nao cabe: girar o matiz de uma foto de sonda
 * nao produz "a sonda em alarme", produz uma sonda de outra cor. Entao estes
 * icones **nao anunciam estado**; quem anuncia e a superficie atras deles, que e
 * exatamente o tratamento que `DeviceNode` ja da a toda figura (a placa opaca da
 * capsula). O campo "Cor do ícone" nao aparece para eles, pela mesma razao: nao
 * ha variante a escolher.
 *
 * ## O que veio da pasta do cliente e o que ficou de fora
 *
 * O material chegou com a **mesma arte repetida em varios tamanhos**
 * (`ESTACAO` em cinco, `SONDA` em tres, `TORRE` em dois na epoca). Entrou **um arquivo
 * por familia**, o maior que ainda e leve: dois tamanhos do mesmo desenho seriam
 * duas entradas no seletor sem diferenca visivel, e a escolha entre elas so
 * poderia ser errada. O navegador reduz melhor do que ampliaria, entao o maior e
 * o que serve tanto ao icone de 20px do no quanto ao elemento Imagem, que tem
 * tamanho livre.
 *
 * Por isso **nao vale aqui a convencao `<familia>-<tom>-96.png`** do pack
 * Padrao: sem tons e sem grade fixa, o nome do arquivo e so a chave, e o tamanho
 * e o do original. Manter os arquivos nas dimensoes de origem tambem evita
 * reamostrar arte que nao temos como reamostrar bem — nao ha Pillow nem
 * ImageMagick nesta maquina.
 *
 * `SONDA_FRAC` ficou como icone proprio (`sonda-frac`): apesar do nome, e outro
 * desenho — a unidade de fraturamento sobre carreta, nao a torre de perfuracao.
 *
 * ## A torre foi trocada (2026-09-10)
 *
 * `torre` era o `TORRE_300` original — um pictograma azul de 128x128, antena de
 * treliça simples. O usuario mandou remover os dois tamanhos antigos e substituiu
 * pela arte nova: uma torre de telecom vermelha, com refletores parabolicos, em
 * 129x450.
 *
 * Duas consequencias que o arquivo nao conta:
 *
 *   - **E alta**, quase 1:3.5. Num no de 20px a figura ocupa ~6px de largura.
 *     Continua legivel porque a silhueta de torre e vertical por natureza — e o
 *     mesmo motivo pelo qual as tiras de rack do pack `zabbix` *nao* funcionam
 *     ali: la a proporcao briga com o desenho, aqui ela e o desenho.
 *   - **E vermelha**, e vermelho e a cor de alarme deste produto. Como todo
 *     icone `image`, ela nao anuncia estado — quem anuncia e a placa da capsula
 *     atras — mas um nó saudavel com uma torre vermelha depende do operador ler
 *     a placa, e nao a figura. Fica registrado; a escolha da arte e do usuario.
 *
 * Como no pack Padrao, a lista e explicita: `require.context` esconderia do
 * compilador quais arquivos existem.
 */
export const petroliferaPack: IconPack = {
  id: 'petrolifera',
  label: 'Petrolífera',
  icons: [
    {
      name: 'sonda',
      label: 'Sonda',
      keywords: ['sonda', 'perfuracao', 'poco', 'rig', 'drilling'],
      art: { kind: 'image', src: i_sonda },
    },
    {
      name: 'sonda-frac',
      label: 'Sonda de fraturamento',
      keywords: ['frac', 'fraturamento', 'fracking', 'bomba', 'carreta'],
      art: { kind: 'image', src: i_sonda_frac },
    },
    {
      name: 'estacao',
      label: 'Estação',
      keywords: ['estacao', 'station', 'planta', 'usina', 'refinaria', 'petroleo'],
      art: { kind: 'image', src: i_estacao },
    },
    {
      name: 'religador',
      label: 'Religador',
      keywords: ['religador', 'recloser', 'disjuntor', 'energia', 'eletrica'],
      art: { kind: 'image', src: i_religador },
    },
    {
      name: 'sensor-temperatura',
      label: 'Sensor de temperatura',
      keywords: ['sensor', 'temperatura', 'termometro', 'display'],
      art: { kind: 'image', src: i_sensor_temperatura },
    },
    {
      name: 'torre',
      label: 'Torre',
      keywords: ['torre', 'antena', 'tower', 'transmissao', 'radio'],
      art: { kind: 'image', src: i_torre },
    },
    {
      name: 'radio-cambium',
      label: 'Rádio Cambium',
      keywords: ['radio', 'cambium', 'enlace', 'ptp', 'wireless'],
      art: { kind: 'image', src: i_radio_cambium },
    },
    {
      name: 'unifi-ac-lite',
      label: 'UniFi AC Lite',
      keywords: ['unifi', 'ubiquiti', 'ap', 'access point', 'wifi', 'lite'],
      art: { kind: 'image', src: i_unifi_ac_lite },
    },
    {
      name: 'unifi-ac-pro',
      label: 'UniFi AC Pro',
      keywords: ['unifi', 'ubiquiti', 'ap', 'access point', 'wifi', 'pro'],
      art: { kind: 'image', src: i_unifi_ac_pro },
    },
    {
      name: 'unifi-ac-mesh',
      label: 'UniFi AC Mesh',
      keywords: ['unifi', 'ubiquiti', 'ap', 'access point', 'wifi', 'mesh'],
      art: { kind: 'image', src: i_unifi_ac_mesh },
    },
    {
      name: 'unifi-ac-mesh-pro',
      label: 'UniFi AC Mesh Pro',
      keywords: ['unifi', 'ubiquiti', 'ap', 'access point', 'wifi', 'mesh', 'pro'],
      art: { kind: 'image', src: i_unifi_ac_mesh_pro },
    },
  ],
};
