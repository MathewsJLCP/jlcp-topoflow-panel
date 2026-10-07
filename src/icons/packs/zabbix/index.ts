import { IconPack } from '../../types';

import i_ap from './ap.png';
import i_cloud from './cloud.png';
import i_crypto_router from './crypto-router.png';
import i_crypto_router_symbol from './crypto-router-symbol.png';
import i_disk_array_2d from './disk-array-2d.png';
import i_disk_array_3d from './disk-array-3d.png';
import i_firewall from './firewall.png';
import i_house from './house.png';
import i_hub from './hub.png';
import i_ip_pbx from './ip-pbx.png';
import i_ip_pbx_symbol from './ip-pbx-symbol.png';
import i_modem from './modem.png';
import i_network from './network.png';
import i_network_adapter from './network-adapter.png';
import i_notebook from './notebook.png';
import i_pbx from './pbx.png';
import i_phone from './phone.png';
import i_printer from './printer.png';
import i_rack_42 from './rack-42.png';
import i_rack_42_with_door from './rack-42-with-door.png';
import i_router from './router.png';
import i_router_symbol from './router-symbol.png';
import i_san from './san.png';
import i_satellite from './satellite.png';
import i_satellite_antenna from './satellite-antenna.png';
import i_server from './server.png';
import i_server_1u_2d from './server-1u-2d.png';
import i_server_1u_3d from './server-1u-3d.png';
import i_server_2u_2d from './server-2u-2d.png';
import i_server_2u_3d from './server-2u-3d.png';
import i_server_3u_2d from './server-3u-2d.png';
import i_server_3u_3d from './server-3u-3d.png';
import i_server_4u_2d from './server-4u-2d.png';
import i_server_4u_3d from './server-4u-3d.png';
import i_server_5u_2d from './server-5u-2d.png';
import i_server_5u_3d from './server-5u-3d.png';
import i_switch from './switch.png';
import i_ups from './ups.png';
import i_ups_rack_2d from './ups-rack-2d.png';
import i_ups_rack_3d from './ups-rack-3d.png';
import i_video_terminal from './video-terminal.png';
import i_workstation from './workstation.png';
import i_zabbix_server_2d from './zabbix-server-2d.png';
import i_zabbix_server_3d from './zabbix-server-3d.png';

/**
 * O pack **Zabbix**: o conjunto de icones que acompanha os mapas do Zabbix,
 * inteiro, nos 128px de origem.
 *
 * E o pack que dispensa aprendizado. Quem monta topologia neste produto ja
 * desenhou o mesmo mapa no Zabbix, e reconhece estes desenhos de longe — o
 * roteador cinza de antenas, o disco de setas do `router-symbol`, a nuvem. Um
 * icone que o operador reconhece sem ler o rotulo vale mais do que um icone
 * mais bonito que ele precisa decifrar.
 *
 * ## Licenca — pendencia real, nao formalidade
 *
 * Estes arquivos vem do Zabbix, que e **GPL-2.0** (AGPL-3.0 a partir do 7.0), e
 * este plugin e **Apache-2.0** (ver `LICENSE` na raiz). Redistribuir os dois no
 * mesmo pacote assinado e uma questao juridica em aberto, e foi por ela que este
 * pack ficou de fora quando os outros tres foram feitos. Entrou agora por
 * decisao do usuario (2026-09-10). Se a resposta vier negativa, o custo de
 * remover e baixo de proposito: apagar esta pasta e a entrada em `ICON_PACKS`.
 * As chaves salvas nos dashboards caem no generico sozinhas, sem migrador — e
 * exatamente o caso que `resolveIcon` existe para absorver.
 *
 * ## Um arquivo que nao e do Zabbix
 *
 * `ap` e a foto do UniFi AC Lite, a mesma do pack Petrolífera, adicionada aqui a
 * pedido do usuario (2026-09-10): o conjunto original do Zabbix nao tem ponto de
 * acesso, e uma topologia de rede sem AP e uma topologia incompleta.
 *
 * O arquivo esta **copiado**, e nao importado de `../petrolifera`. E de
 * proposito: os dois packs tem pendencia de licenca propria e sao removiveis de
 * forma independente — apagar `petrolifera` nao pode quebrar o build de
 * `zabbix`. O custo da copia e zero no bundle, porque o webpack nomeia asset por
 * hash de conteudo e os dois arquivos identicos viram um so.
 *
 * ## Natureza: `image`, como no pack Petrolífera
 *
 * Sao renderizacoes 3D com as cores do equipamento. Nao existe a mesma arte em
 * seis tons, e deriva-los por rotacao de matiz — o truque do pack Padrao — nao
 * cabe aqui pela mesma razao de sempre: um switch de outra cor nao e "o switch
 * em alarme". Entao estes icones **nao anunciam estado**; quem anuncia e a placa
 * opaca da capsula, atras deles. O campo "Cor do ícone" nao aparece para eles.
 *
 * ## As tiras de rack
 *
 * Metade do conjunto original nao e icone de no: sao pecas de **elevacao de
 * rack**, desenhadas para serem empilhadas dentro de um mapa. `server-1u-2d` tem
 * 128x9 px — num no de 20px vira um fio de 1,4 px de altura. Entraram assim
 * mesmo, por decisao do usuario, e o lugar delas e o elemento **Imagem**, que
 * tem tamanho livre e onde montar uma elevacao faz sentido.
 *
 * Por isso tambem **2D e 3D entraram os dois**, ao contrario do que se fez no
 * pack Petrolífera com os tamanhos repetidos: la eram o mesmo desenho e a
 * escolha entre eles so podia ser errada; aqui sao duas renderizacoes distintas
 * — frontal e em perspectiva — e um rack so fecha se todas as pecas estiverem na
 * mesma projecao. Misturar 2D e 3D na mesma pilha e o erro visivel, entao os
 * rotulos dizem qual e qual.
 *
 * ## Ordem
 *
 * Nao e alfabetica: e por familia — rede, servidores e armazenamento, rack e
 * energia, terminais. O seletor mostra o pack inteiro numa grade, e 44 itens em
 * ordem alfabetica poem `cloud` entre `crypto-router` e `disk-array`, o que
 * transforma procurar em ler tudo. Dentro de cada familia de rack, o **3D vem
 * antes do 2D**: e a projecao dos mapas padrao do Zabbix.
 *
 * Como nos outros packs, a lista e explicita — `require.context` esconderia do
 * compilador quais arquivos existem.
 */
export const zabbixPack: IconPack = {
  id: 'zabbix',
  label: 'Zabbix',
  icons: [
    // --- Rede ---
    {
      name: 'router',
      label: 'Roteador',
      keywords: ['roteador', 'router', 'gateway', 'borda'],
      art: { kind: 'image', src: i_router },
    },
    {
      name: 'router-symbol',
      label: 'Roteador (símbolo)',
      keywords: ['roteador', 'router', 'simbolo', 'symbol', 'setas', 'disco'],
      art: { kind: 'image', src: i_router_symbol },
    },
    {
      name: 'crypto-router',
      label: 'Roteador cripto',
      keywords: ['roteador', 'router', 'cripto', 'crypto', 'vpn', 'cadeado', 'tunel'],
      art: { kind: 'image', src: i_crypto_router },
    },
    {
      name: 'crypto-router-symbol',
      label: 'Roteador cripto (símbolo)',
      keywords: ['roteador', 'router', 'cripto', 'crypto', 'vpn', 'simbolo', 'symbol'],
      art: { kind: 'image', src: i_crypto_router_symbol },
    },
    {
      name: 'switch',
      label: 'Switch',
      keywords: ['switch', 'comutador', 'lan', 'acesso'],
      art: { kind: 'image', src: i_switch },
    },
    {
      name: 'hub',
      label: 'Hub',
      keywords: ['hub', 'concentrador', 'repetidor'],
      art: { kind: 'image', src: i_hub },
    },
    {
      name: 'firewall',
      label: 'Firewall',
      keywords: ['firewall', 'muro', 'seguranca', 'utm'],
      art: { kind: 'image', src: i_firewall },
    },
    {
      name: 'modem',
      label: 'Modem',
      keywords: ['modem', 'dsl', 'adsl', 'discado'],
      art: { kind: 'image', src: i_modem },
    },
    {
      name: 'ap',
      label: 'AP',
      keywords: ['ap', 'access point', 'ponto de acesso', 'wifi', 'wireless', 'unifi', 'ubiquiti'],
      art: { kind: 'image', src: i_ap },
    },
    {
      name: 'network-adapter',
      label: 'Placa de rede',
      keywords: ['placa', 'adaptador', 'nic', 'adapter', 'interface', 'ethernet'],
      art: { kind: 'image', src: i_network_adapter },
    },
    {
      name: 'network',
      label: 'Rede',
      keywords: ['rede', 'network', 'lan', 'segmento', 'estacoes'],
      art: { kind: 'image', src: i_network },
    },
    {
      name: 'cloud',
      label: 'Nuvem',
      keywords: ['nuvem', 'cloud', 'internet', 'wan', 'operadora'],
      art: { kind: 'image', src: i_cloud },
    },
    {
      name: 'satellite',
      label: 'Satélite',
      keywords: ['satelite', 'satellite', 'orbita', 'espaco'],
      art: { kind: 'image', src: i_satellite },
    },
    {
      name: 'satellite-antenna',
      label: 'Antena de satélite',
      keywords: ['antena', 'parabolica', 'vsat', 'satelite', 'satellite', 'dish'],
      art: { kind: 'image', src: i_satellite_antenna },
    },

    // --- Servidores e armazenamento ---
    {
      name: 'server',
      label: 'Servidor',
      keywords: ['servidor', 'server', 'torre', 'host'],
      art: { kind: 'image', src: i_server },
    },
    {
      name: 'zabbix-server-3d',
      label: 'Servidor Zabbix (3D)',
      keywords: ['zabbix', 'servidor', 'server', 'rack', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_zabbix_server_3d },
    },
    {
      name: 'zabbix-server-2d',
      label: 'Servidor Zabbix (2D)',
      keywords: ['zabbix', 'servidor', 'server', 'rack', '2d', 'frontal'],
      art: { kind: 'image', src: i_zabbix_server_2d },
    },
    {
      name: 'san',
      label: 'SAN',
      keywords: ['san', 'storage', 'armazenamento', 'nas', 'discos'],
      art: { kind: 'image', src: i_san },
    },
    {
      name: 'disk-array-3d',
      label: 'Array de discos (3D)',
      keywords: ['disco', 'array', 'storage', 'raid', 'rack', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_disk_array_3d },
    },
    {
      name: 'disk-array-2d',
      label: 'Array de discos (2D)',
      keywords: ['disco', 'array', 'storage', 'raid', 'rack', '2d', 'frontal'],
      art: { kind: 'image', src: i_disk_array_2d },
    },

    // --- Rack e energia ---
    {
      name: 'rack-42',
      label: 'Rack 42U',
      keywords: ['rack', 'gabinete', '42u', 'bastidor'],
      art: { kind: 'image', src: i_rack_42 },
    },
    {
      name: 'rack-42-with-door',
      label: 'Rack 42U com porta',
      keywords: ['rack', 'gabinete', '42u', 'porta', 'bastidor', 'fechado'],
      art: { kind: 'image', src: i_rack_42_with_door },
    },
    {
      name: 'server-1u-3d',
      label: 'Servidor 1U (3D)',
      keywords: ['servidor', 'server', 'rack', '1u', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_server_1u_3d },
    },
    {
      name: 'server-1u-2d',
      label: 'Servidor 1U (2D)',
      keywords: ['servidor', 'server', 'rack', '1u', '2d', 'frontal'],
      art: { kind: 'image', src: i_server_1u_2d },
    },
    {
      name: 'server-2u-3d',
      label: 'Servidor 2U (3D)',
      keywords: ['servidor', 'server', 'rack', '2u', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_server_2u_3d },
    },
    {
      name: 'server-2u-2d',
      label: 'Servidor 2U (2D)',
      keywords: ['servidor', 'server', 'rack', '2u', '2d', 'frontal'],
      art: { kind: 'image', src: i_server_2u_2d },
    },
    {
      name: 'server-3u-3d',
      label: 'Servidor 3U (3D)',
      keywords: ['servidor', 'server', 'rack', '3u', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_server_3u_3d },
    },
    {
      name: 'server-3u-2d',
      label: 'Servidor 3U (2D)',
      keywords: ['servidor', 'server', 'rack', '3u', '2d', 'frontal'],
      art: { kind: 'image', src: i_server_3u_2d },
    },
    {
      name: 'server-4u-3d',
      label: 'Servidor 4U (3D)',
      keywords: ['servidor', 'server', 'rack', '4u', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_server_4u_3d },
    },
    {
      name: 'server-4u-2d',
      label: 'Servidor 4U (2D)',
      keywords: ['servidor', 'server', 'rack', '4u', '2d', 'frontal'],
      art: { kind: 'image', src: i_server_4u_2d },
    },
    {
      name: 'server-5u-3d',
      label: 'Servidor 5U (3D)',
      keywords: ['servidor', 'server', 'rack', '5u', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_server_5u_3d },
    },
    {
      name: 'server-5u-2d',
      label: 'Servidor 5U (2D)',
      keywords: ['servidor', 'server', 'rack', '5u', '2d', 'frontal'],
      art: { kind: 'image', src: i_server_5u_2d },
    },
    {
      name: 'ups',
      label: 'No-break',
      keywords: ['nobreak', 'no-break', 'ups', 'energia', 'bateria'],
      art: { kind: 'image', src: i_ups },
    },
    {
      name: 'ups-rack-3d',
      label: 'No-break de rack (3D)',
      keywords: ['nobreak', 'no-break', 'ups', 'energia', 'rack', '3d', 'perspectiva'],
      art: { kind: 'image', src: i_ups_rack_3d },
    },
    {
      name: 'ups-rack-2d',
      label: 'No-break de rack (2D)',
      keywords: ['nobreak', 'no-break', 'ups', 'energia', 'rack', '2d', 'frontal'],
      art: { kind: 'image', src: i_ups_rack_2d },
    },

    // --- Terminais e periféricos ---
    {
      name: 'workstation',
      label: 'Estação de trabalho',
      keywords: ['estacao', 'workstation', 'desktop', 'pc', 'computador'],
      art: { kind: 'image', src: i_workstation },
    },
    {
      name: 'notebook',
      label: 'Notebook',
      keywords: ['notebook', 'laptop', 'portatil'],
      art: { kind: 'image', src: i_notebook },
    },
    {
      name: 'video-terminal',
      label: 'Terminal de vídeo',
      keywords: ['video', 'terminal', 'conferencia', 'videoconferencia', 'headset'],
      art: { kind: 'image', src: i_video_terminal },
    },
    {
      name: 'printer',
      label: 'Impressora',
      keywords: ['impressora', 'printer', 'periferico'],
      art: { kind: 'image', src: i_printer },
    },
    {
      name: 'phone',
      label: 'Telefone',
      keywords: ['telefone', 'phone', 'ramal', 'voz'],
      art: { kind: 'image', src: i_phone },
    },
    {
      name: 'ip-pbx',
      label: 'PABX IP',
      keywords: ['pabx', 'pbx', 'ip', 'voip', 'telefonia', 'central'],
      art: { kind: 'image', src: i_ip_pbx },
    },
    {
      name: 'ip-pbx-symbol',
      label: 'PABX IP (símbolo)',
      keywords: ['pabx', 'pbx', 'ip', 'voip', 'telefonia', 'simbolo', 'symbol'],
      art: { kind: 'image', src: i_ip_pbx_symbol },
    },
    {
      name: 'pbx',
      label: 'PABX',
      keywords: ['pabx', 'pbx', 'telefonia', 'central', 'analogico'],
      art: { kind: 'image', src: i_pbx },
    },
    {
      name: 'house',
      label: 'Casa',
      keywords: ['casa', 'house', 'predio', 'site', 'filial', 'unidade'],
      art: { kind: 'image', src: i_house },
    },
  ],
};
