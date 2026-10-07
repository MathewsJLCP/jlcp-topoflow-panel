import { test, expect } from '@grafana/plugin-e2e';

/**
 * `waitUntil: 'domcontentloaded'` e obrigatorio: o default do plugin-e2e e
 * 'load', que nao resolve neste Grafana porque o app mantem conexoes abertas
 * apos o primeiro render.
 */
const nav = { waitUntil: 'domcontentloaded' } as const;

test('aparece na lista de visualizacoes', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  // Abre o viz picker e seleciona pelo nome: falha se o plugin nao estiver
  // listado. `getVisualizationName()` nao serve — o seletor que o plugin-e2e
  // usa a partir da 12.4.0 nao existe no Grafana 13.1.0.
  await panelEditPage.setVisualization('TopoFlow');

  await expect(page.locator('.react-flow__node').first()).toBeVisible();
});

test('expoe Thresholds e Value mappings vindos de .useFieldConfig()', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  // `.first()` porque o dashboard provisionado tem um override de field, e o
  // painel de opcoes repete a secao dentro dele: o que este teste garante e que
  // as secoes nativas aparecem, nao quantas vezes.
  await expect(panelEditPage.getThresholdsOptions().element.first()).toBeVisible();
  await expect(panelEditPage.getValueMappingOptions().element.first()).toBeVisible();
});

test('expoe as opcoes de canvas', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  const canvas = panelEditPage.getCustomOptions('Canvas');
  await canvas.expand();

  await expect(canvas.getSwitch('Mostrar grid').locator()).toBeChecked();
  await expect(canvas.getSwitch('Alinhar ao grid').locator()).toBeChecked();
});

/**
 * A seção nasce desligada — o padrão é o painel viver das queries do dashboard —
 * e é o interruptor que revela o resto. O `DataSourcePicker` do Grafana entra
 * aqui num lugar onde o plugin nunca o usou (dentro do painel de opções), e o
 * jsdom não diria se ele derruba a aba inteira.
 *
 * O teste checa os **controles**, e não o conteúdo da lista: quantos Zabbix a
 * instância tem é propriedade do ambiente, e um teste que dependesse disso
 * passaria na máquina de quem provisionou um e falharia na de quem provisionou
 * dois. Foi assim que a primeira versão deste teste falhou — e o que ela
 * revelou, de quebra, foi um bug de verdade: `getList({ type })` acrescenta o
 * `-- Grafana --` ao resultado depois de filtrar.
 */
test('a secao Zabbix e um interruptor que revela o datasource', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  const zabbix = panelEditPage.getCustomOptions('Zabbix');
  await zabbix.expand();

  const toggle = page.getByRole('switch', { name: /Consultar o Zabbix/ });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText('Datasource do Zabbix')).toBeHidden();

  await toggle.click({ force: true });

  await expect(page.getByText('Datasource do Zabbix')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Select a data source' })).toBeVisible();
});

test('renderiza a topologia com os quatro nos', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  // Escopado ao no: o nome tambem aparece na lista do Layer, e um `getByText`
  // solto passou a casar com os dois.
  await expect(page.getByTestId('rf__node-app').getByText('srv-app-01')).toBeVisible();
});

/**
 * O contrato de cor do elemento, em um teste.
 *
 * Desde 2026-09-02 quem pinta o elemento e **so** o bloco de Thresholds dele. Os
 * thresholds e value mappings nativos do painel seguem formatando o valor — e e
 * essa divisao que este teste fixa, nos quatro nos do dashboard provisionado.
 */
test('a regra do elemento pinta; o pipeline nativo formata o valor', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  /**
   * A cor de estado pousa no **fundo do card** desde que o elemento passou a se
   * pintar inteiro. O gancho e `topo-card`, que existe justamente para o
   * seletor: o nome do Emotion muda entre builds, e `> div` pega o wrapper de
   * hover, cuja borda e neutra em todo no — foi assim que este teste passou a
   * medir a superficie errada.
   */
  const fillOf = (name: string) =>
    page
      .locator('.react-flow__node')
      .filter({ hasText: name })
      .locator('.topo-card')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

  const RED = 'rgb(242, 73, 92)';
  const GREEN = 'rgb(115, 191, 105)';
  const PURPLE = 'rgb(184, 119, 217)';
  const BLUE = 'rgb(87, 148, 242)';

  // Dois hosts na mesma query, desambiguados por `getFieldDisplayName`.
  // A regra do proprio no dispara em 85, e o valor no badge sai formatado pelo
  // `unit` nativo — a regra e deixada sem rotulo justamente para nao ocupar o
  // badge, que e onde o valor aparece (ver a precedencia em `DeviceNode`).
  await expect(page.locator('.react-flow__node').filter({ hasText: 'srv-app-01' })).toContainText('92%');
  expect(await fillOf('srv-app-01')).toBe(RED);

  // Field vinculado e nenhuma regra propria: o step base verde do painel pintaria
  // este no de verde ate a mudanca de 2026-09-02. Roxo e a cor Base do elemento —
  // e a prova de que o pipeline nativo nao decide mais a cor de ninguem.
  await expect(page.locator('.react-flow__node').filter({ hasText: 'srv-db-01' })).toContainText('40%');
  expect(await fillOf('srv-db-01')).toBe(PURPLE);

  // Sem vinculo: so a cor fixa, e nenhuma linha de valor.
  const livre = page.locator('.react-flow__node').filter({ hasText: 'sem-vinculo' });
  await expect(livre).not.toContainText('%');
  expect(await fillOf('sem-vinculo')).toBe(BLUE);

  // Os dois lados no mesmo no: o texto "UP" vem do value mapping nativo (a regra
  // do elemento foi deixada sem rotulo), e o verde vem da regra do elemento,
  // cuja Base e laranja.
  await expect(page.locator('.react-flow__node').filter({ hasText: 'trigger-01' })).toContainText('UP');
  expect(await fillOf('trigger-01')).toBe(GREEN);
});

test('o layer lista os elementos e abre o formulario', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  await panelEditPage.getCustomOptions('Layer').expand();

  const row = page.locator('[role="button"]').filter({ hasText: 'srv-app-01' }).first();
  await row.click();

  await expect(page.getByText('Exibir valor')).toBeVisible();
  await expect(page.getByText('Texto primário')).toBeVisible();
});
