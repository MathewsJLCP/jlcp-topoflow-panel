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

  await expect(panelEditPage.getThresholdsOptions().element).toBeVisible();
  await expect(panelEditPage.getValueMappingOptions().element).toBeVisible();
});

test('expoe as opcoes de canvas', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  const canvas = panelEditPage.getCustomOptions('Canvas');
  await canvas.expand();

  await expect(canvas.getSwitch('Mostrar grid').locator()).toBeChecked();
  await expect(canvas.getSwitch('Alinhar ao grid').locator()).toBeChecked();
});

test('renderiza a topologia com os quatro nos', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.getByText('srv-app-01')).toBeVisible();
});

/** O criterio de aceite do Bloco 3, em um teste. */
test('resolve valor e cor pelos thresholds e value mappings nativos', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });

  const borderOf = (name: string) =>
    page
      .locator('.react-flow__node')
      .filter({ hasText: name })
      .locator('> div')
      .first()
      .evaluate((el) => getComputedStyle(el).borderColor);

  const RED = 'rgb(242, 73, 92)';
  const GREEN = 'rgb(115, 191, 105)';

  // Dois hosts na mesma query, desambiguados por `getFieldDisplayName`.
  await expect(page.locator('.react-flow__node').filter({ hasText: 'srv-app-01' })).toContainText('92%');
  expect(await borderOf('srv-app-01')).toBe(RED);

  await expect(page.locator('.react-flow__node').filter({ hasText: 'srv-db-01' })).toContainText('40%');
  expect(await borderOf('srv-db-01')).toBe(GREEN);

  // Sem vinculo: cor fixa, sem linha de valor.
  const livre = page.locator('.react-flow__node').filter({ hasText: 'sem-vinculo' });
  await expect(livre).not.toContainText('%');
  expect(await borderOf('sem-vinculo')).not.toBe(RED);

  // Value mapping 1 -> "UP"/verde.
  await expect(page.locator('.react-flow__node').filter({ hasText: 'trigger-01' })).toContainText('UP');
  expect(await borderOf('trigger-01')).toBe(GREEN);
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

  await expect(page.getByText('Valor exibido')).toBeVisible();
  await expect(page.getByText('Texto primário')).toBeVisible();
});
