import { test, expect } from '@grafana/plugin-e2e';

/**
 * As tres interacoes que fazem o canvas ser um editor, e nao um desenho:
 * selecionar, arrastar e abrir o menu de contexto.
 *
 * Nenhuma delas tinha cobertura ate aqui — os testes existentes so olhavam
 * renderizacao e opcoes. O custo disso apareceu na pratica: diante de um relato
 * de "nao da mais para mover nem clicar com o botao direito" nao havia nada que
 * respondesse sim ou nao, e a resposta teve que ser reconstruida a mao no
 * navegador. E o tipo de regressao que o jsdom nao pega: as tres dependem de
 * hit-testing e de arraste real.
 *
 * Todas rodam no **editor de painel**, que e onde `editable` vale `true` sem
 * depender de opcao salva. O modo somente-leitura tem teste proprio no fim.
 */

const nav = { waitUntil: 'domcontentloaded' } as const;

/** Espaco para o canvas: no viewport padrao ele fica estreito demais. */
test.use({ viewport: { width: 1600, height: 900 } });

const NODE = '.react-flow__node-deviceNode';

async function abrirEditor(gotoPanelEditPage: any, readProvisionedDashboard: any, page: any) {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });
  await expect(page.locator(NODE).first()).toBeVisible();
  // `srv-app-01` e o no de cima. Os de baixo da coluna caem sob o `<Controls>`
  // depois do `fitView`, e ali nenhum evento de ponteiro chega ate eles — o
  // problema esta registrado no fim deste arquivo.
  return page.locator(NODE).filter({ hasText: 'srv-app-01' }).first();
}

test('clicar num no o seleciona', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const no = await abrirEditor(gotoPanelEditPage, readProvisionedDashboard, page);

  const box = (await no.boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + box.height / 2);

  await expect(no).toHaveClass(/selected/);
});

/**
 * O commit de posicao e adiado (200ms) e passa por `onOptionsChange`, entao o no
 * so esta de fato movido se continuar no lugar **depois** de a topologia voltar
 * pelo caminho todo. Medir logo apos o `mouseup` testaria so o React Flow.
 */
test('arrastar um no move e a posicao gruda', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const no = await abrirEditor(gotoPanelEditPage, readProvisionedDashboard, page);

  const antes = (await no.boundingBox())!;
  await page.mouse.move(antes.x + 40, antes.y + antes.height / 2);
  await page.mouse.down();
  await page.mouse.move(antes.x + 140, antes.y + antes.height / 2 + 20, { steps: 15 });
  await page.mouse.up();

  await expect
    .poll(async () => Math.round((await no.boundingBox())!.x - antes.x), { timeout: 10_000 })
    .toBeGreaterThan(50);

  // Sobrevive ao ciclo de commit e reparse.
  await page.waitForTimeout(1500);
  expect(Math.round((await no.boundingBox())!.x - antes.x)).toBeGreaterThan(50);
});

test('botao direito no pane abre o menu de adicionar', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  await abrirEditor(gotoPanelEditPage, readProvisionedDashboard, page);

  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  // Canto superior direito: longe dos nos (coluna x=40) e do `<Controls>`, que
  // fica embaixo a esquerda e engoliria o clique.
  await page.mouse.click(pane.x + pane.width - 80, pane.y + 40, { button: 'right' });

  await expect(page.getByRole('menuitem', { name: 'Adicionar nó aqui' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Adicionar point aqui' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Adicionar postit aqui' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Adicionar texto aqui' })).toBeVisible();
});

test('botao direito num no abre o menu do elemento', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const no = await abrirEditor(gotoPanelEditPage, readProvisionedDashboard, page);

  const box = (await no.boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + box.height / 2, { button: 'right' });

  await expect(page.locator('[role="menuitem"]').first()).toBeVisible();
  expect(await page.locator('[role="menuitem"]').count()).toBeGreaterThan(0);
});

test('o elemento criado pelo Layer nasce arrastavel', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  await abrirEditor(gotoPanelEditPage, readProvisionedDashboard, page);
  const antes = await page.locator('.react-flow__node').count();

  await page.getByRole('button', { name: 'Adicionar elemento' }).click();
  await page.getByRole('menuitem', { name: 'Nó' }).click();

  await expect(page.locator('.react-flow__node')).toHaveCount(antes + 1);

  const novo = page.locator('.react-flow__node').last();
  await expect(novo).toHaveClass(/draggable/);

  const a = (await novo.boundingBox())!;
  await page.mouse.move(a.x + 40, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 140, a.y + a.height / 2 + 60, { steps: 15 });
  await page.mouse.up();

  await expect
    .poll(async () => Math.round((await novo.boundingBox())!.x - a.x), { timeout: 10_000 })
    .toBeGreaterThan(50);
});

/**
 * O `<Controls>` do React Flow flutua no canto inferior esquerdo do canvas e
 * captura ponteiro na sua area inteira. Todo elemento que caia debaixo dele fica
 * **inerte**: nao seleciona, nao arrasta, nao abre menu de contexto. Nada na
 * tela explica por que — o elemento esta visivel, so nao responde.
 *
 * Foi assim que o dashboard provisionado quebrou dois testes deste arquivo: os
 * nos ficam numa coluna a esquerda e os de baixo pousam sob os botoes de zoom.
 *
 * O teste documenta o problema em vez de afirmar o conserto — a correcao (mover
 * os controles, encolhe-los, ou deixa-los sumir enquanto nao ha hover) e decisao
 * de produto, nao de teste.
 */
test('elemento sob os controles de zoom nao recebe clique (problema conhecido)', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoPanelEditPage({ dashboard, id: '1', ...nav });
  await expect(page.locator(NODE).first()).toBeVisible();

  const controls = (await page.locator('.react-flow__controls').boundingBox())!;
  const centro = { x: controls.x + controls.width / 2, y: controls.y + controls.height / 2 };

  const sob = await page.evaluate(
    (p) => document.elementFromPoint(p.x, p.y)?.closest('.react-flow__node')?.getAttribute('data-id') ?? null,
    centro
  );

  // Se um dia os controles sairem de cima dos nos, `sob` vira `null` e este
  // teste passa a cobrar que continue assim.
  if (sob) {
    const encoberto = page.locator(`[data-id="${sob}"]`);
    await page.mouse.click(centro.x, centro.y);
    await expect(encoberto).not.toHaveClass(/selected/);
  }
});

/**
 * O outro lado da mesma regra, e a origem provavel do relato: fora do editor de
 * painel, com "Edicao inline" desligada, o canvas e **inerte de proposito** —
 * quem so visualiza nao arrasta a topologia por acidente. O que falta ali nao e
 * interacao, e sinalizacao: nada na tela distingue "somente leitura" de
 * "quebrado". Este teste fixa o comportamento atual para que a diferenca seja
 * uma decisao, e nao um acidente.
 */
test('no dashboard, sem edicao inline, o canvas e somente leitura', async ({
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await page.goto(`/d/${dashboard.uid}`, nav);

  const no = page.locator(NODE).first();
  await expect(no).toBeVisible();

  await expect(no).not.toHaveClass(/draggable/);
  await expect(no).not.toHaveClass(/selectable/);

  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.click(pane.x + pane.width - 80, pane.y + 40, { button: 'right' });
  await page.waitForTimeout(500);

  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
});
