import { IconPack } from '../../types';

import i_bullet_camera_blue_96 from './bullet-camera-blue-96.png';
import i_bullet_camera_gray_96 from './bullet-camera-gray-96.png';
import i_bullet_camera_green_96 from './bullet-camera-green-96.png';
import i_bullet_camera_orange_96 from './bullet-camera-orange-96.png';
import i_bullet_camera_red_96 from './bullet-camera-red-96.png';
import i_bullet_camera_yellow_96 from './bullet-camera-yellow-96.png';
import i_circle_blue_96 from './circle-blue-96.png';
import i_circle_gray_96 from './circle-gray-96.png';
import i_circle_green_96 from './circle-green-96.png';
import i_circle_orange_96 from './circle-orange-96.png';
import i_circle_red_96 from './circle-red-96.png';
import i_circle_yellow_96 from './circle-yellow-96.png';
import i_database_blue_96 from './database-blue-96.png';
import i_database_gray_96 from './database-gray-96.png';
import i_database_green_96 from './database-green-96.png';
import i_database_orange_96 from './database-orange-96.png';
import i_database_red_96 from './database-red-96.png';
import i_database_yellow_96 from './database-yellow-96.png';
import i_firewall_blue_96 from './firewall-blue-96.png';
import i_firewall_gray_96 from './firewall-gray-96.png';
import i_firewall_green_96 from './firewall-green-96.png';
import i_firewall_orange_96 from './firewall-orange-96.png';
import i_firewall_red_96 from './firewall-red-96.png';
import i_firewall_yellow_96 from './firewall-yellow-96.png';
import i_hub_blue_96 from './hub-blue-96.png';
import i_hub_gray_96 from './hub-gray-96.png';
import i_hub_green_96 from './hub-green-96.png';
import i_hub_orange_96 from './hub-orange-96.png';
import i_hub_red_96 from './hub-red-96.png';
import i_hub_yellow_96 from './hub-yellow-96.png';
import i_layer_switch_blue_96 from './layer-switch-blue-96.png';
import i_layer_switch_gray_96 from './layer-switch-gray-96.png';
import i_layer_switch_green_96 from './layer-switch-green-96.png';
import i_layer_switch_orange_96 from './layer-switch-orange-96.png';
import i_layer_switch_red_96 from './layer-switch-red-96.png';
import i_layer_switch_yellow_96 from './layer-switch-yellow-96.png';
import i_printer_blue_96 from './printer-blue-96.png';
import i_printer_gray_96 from './printer-gray-96.png';
import i_printer_green_96 from './printer-green-96.png';
import i_printer_orange_96 from './printer-orange-96.png';
import i_printer_red_96 from './printer-red-96.png';
import i_printer_yellow_96 from './printer-yellow-96.png';
import i_router_blue_96 from './router-blue-96.png';
import i_router_gray_96 from './router-gray-96.png';
import i_router_green_96 from './router-green-96.png';
import i_router_orange_96 from './router-orange-96.png';
import i_router_red_96 from './router-red-96.png';
import i_router_yellow_96 from './router-yellow-96.png';
import i_server_blue_96 from './server-blue-96.png';
import i_server_gray_96 from './server-gray-96.png';
import i_server_green_96 from './server-green-96.png';
import i_server_orange_96 from './server-orange-96.png';
import i_server_red_96 from './server-red-96.png';
import i_server_yellow_96 from './server-yellow-96.png';
import i_wifi_blue_96 from './wifi-blue-96.png';
import i_wifi_gray_96 from './wifi-gray-96.png';
import i_wifi_green_96 from './wifi-green-96.png';
import i_wifi_orange_96 from './wifi-orange-96.png';
import i_wifi_red_96 from './wifi-red-96.png';
import i_wifi_yellow_96 from './wifi-yellow-96.png';
import i_world_blue_96 from './world-blue-96.png';
import i_world_gray_96 from './world-gray-96.png';
import i_world_green_96 from './world-green-96.png';
import i_world_orange_96 from './world-orange-96.png';
import i_world_red_96 from './world-red-96.png';
import i_world_yellow_96 from './world-yellow-96.png';

/**
 * O pack **Padrao** do TopoFlow: ativos de rede em figura, no estilo dos mapas
 * do Zabbix.
 *
 * Cada icone existe em seis cores, e e dai que vem a sua propriedade mais util:
 * uma figura que **anuncia estado**. Nao ha como tingir um PNG, mas ha como
 * trocar o arquivo, e e o que o canvas faz a cada mudanca da cadeia de cor.
 *
 * Quatro cores vieram prontas (cinza, azul, amarelo, vermelho); **laranja e
 * verde foram derivadas** das existentes por rotacao de matiz, girando apenas a
 * cor dominante de cada desenho — o display azul do servidor e a lente da camera
 * ficam onde estavam. O verde saiu do vermelho com +115 graus, que e exatamente
 * o matiz do `circle-green` original: as duas geracoes coincidem, e o pack
 * inteiro fala a mesma lingua de cor.
 *
 * Sao PNG de 96x96 com transparencia, servidos como **assets** do plugin: o
 * webpack os trata como `asset/resource` e eles saem em `dist/` com hash, sem
 * um byte no `module.js`. Embutir centenas de KB de base64 no bundle atrasaria o
 * primeiro render de todo painel do dashboard, inclusive os que nao usam icone
 * nenhum.
 *
 * As versoes de 16px que acompanhavam o `circle` ficaram de fora: o navegador
 * reduz o arquivo de 96 melhor do que um bitmap de 16 ampliado ate o tamanho do
 * icone do no, e duas fontes para o mesmo desenho so criariam a duvida de qual
 * esta em uso.
 *
 * Ao adicionar um icone, siga o padrao `<familia>-<tom>-96.png` e acrescente a
 * entrada abaixo — a lista e explicita de proposito: `require.context` esconderia
 * do compilador quais arquivos existem.
 */
export const topoflowPack: IconPack = {
  id: 'topoflow',
  label: 'Padrão',
  icons: [
    {
      name: 'router',
      label: 'Roteador',
      keywords: ['router', 'gateway', 'borda'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_router_gray_96,
          green: i_router_green_96,
          blue: i_router_blue_96,
          yellow: i_router_yellow_96,
          orange: i_router_orange_96,
          red: i_router_red_96,
        },
      },
    },
    {
      name: 'server',
      label: 'Servidor',
      keywords: ['server', 'host', 'maquina', 'vm'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_server_gray_96,
          green: i_server_green_96,
          blue: i_server_blue_96,
          yellow: i_server_yellow_96,
          orange: i_server_orange_96,
          red: i_server_red_96,
        },
      },
    },
    {
      name: 'firewall',
      label: 'Firewall',
      keywords: ['fw', 'seguranca'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_firewall_gray_96,
          green: i_firewall_green_96,
          blue: i_firewall_blue_96,
          yellow: i_firewall_yellow_96,
          orange: i_firewall_orange_96,
          red: i_firewall_red_96,
        },
      },
    },
    {
      name: 'layer-switch',
      label: 'Switch',
      keywords: ['switch', 'comutador', 'layer', 'l3'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_layer_switch_gray_96,
          green: i_layer_switch_green_96,
          blue: i_layer_switch_blue_96,
          yellow: i_layer_switch_yellow_96,
          orange: i_layer_switch_orange_96,
          red: i_layer_switch_red_96,
        },
      },
    },
    {
      name: 'hub',
      label: 'Hub',
      keywords: ['hub', 'concentrador'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_hub_gray_96,
          green: i_hub_green_96,
          blue: i_hub_blue_96,
          yellow: i_hub_yellow_96,
          orange: i_hub_orange_96,
          red: i_hub_red_96,
        },
      },
    },
    {
      name: 'wifi',
      label: 'Wi-Fi',
      keywords: ['wifi', 'wireless', 'ap', 'access point', 'antena'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_wifi_gray_96,
          green: i_wifi_green_96,
          blue: i_wifi_blue_96,
          yellow: i_wifi_yellow_96,
          orange: i_wifi_orange_96,
          red: i_wifi_red_96,
        },
      },
    },
    {
      name: 'world',
      label: 'Internet',
      keywords: ['world', 'mundo', 'wan', 'globo'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_world_gray_96,
          green: i_world_green_96,
          blue: i_world_blue_96,
          yellow: i_world_yellow_96,
          orange: i_world_orange_96,
          red: i_world_red_96,
        },
      },
    },
    {
      name: 'database',
      label: 'Banco de dados',
      keywords: ['database', 'db', 'sql'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_database_gray_96,
          green: i_database_green_96,
          blue: i_database_blue_96,
          yellow: i_database_yellow_96,
          orange: i_database_orange_96,
          red: i_database_red_96,
        },
      },
    },
    {
      name: 'printer',
      label: 'Impressora',
      keywords: ['printer', 'impressao'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_printer_gray_96,
          green: i_printer_green_96,
          blue: i_printer_blue_96,
          yellow: i_printer_yellow_96,
          orange: i_printer_orange_96,
          red: i_printer_red_96,
        },
      },
    },
    {
      name: 'bullet-camera',
      label: 'Câmera',
      keywords: ['camera', 'cftv', 'bullet', 'vigilancia'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_bullet_camera_gray_96,
          green: i_bullet_camera_green_96,
          blue: i_bullet_camera_blue_96,
          yellow: i_bullet_camera_yellow_96,
          orange: i_bullet_camera_orange_96,
          red: i_bullet_camera_red_96,
        },
      },
    },
    {
      name: 'circle',
      label: 'Círculo',
      keywords: ['circle', 'ponto', 'bolinha', 'status'],
      art: {
        kind: 'variants',
        base: 'gray',
        tones: {
          gray: i_circle_gray_96,
          green: i_circle_green_96,
          blue: i_circle_blue_96,
          yellow: i_circle_yellow_96,
          orange: i_circle_orange_96,
          red: i_circle_red_96,
        },
      },
    },
  ],
};
