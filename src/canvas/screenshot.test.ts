import { SCREENSHOT_MAX_SIDE, downloadImage, screenshotFilename, screenshotFrame } from './screenshot';

/**
 * A captura em si e do `html-to-image` e do browser — nao ha o que testar em
 * jsdom, que nao desenha nada. O que e nosso, e esta aqui, sao as decisoes que
 * antecedem a captura: qual retangulo, em que resolucao, com que nome.
 */

const bounds = (width: number, height: number) => ({ x: 0, y: 0, width, height });

describe('screenshotFrame', () => {
  it('enquadra a topologia com margem, na densidade cheia', () => {
    // 400x200 + 48 de margem dos dois lados = 496x296, em 2x.
    expect(screenshotFrame(bounds(400, 200))).toEqual({ width: 992, height: 592, zoom: 2 });
  });

  /**
   * A margem nao e enfeite: a caixa que o React Flow mede e a do no, e a legenda
   * da imagem e a lista de triggers vivem fora dela, em `position: absolute`.
   * Sem folga elas sairiam cortadas.
   */
  it('a margem entra dos dois lados de cada eixo', () => {
    const frame = screenshotFrame(bounds(0, 0), 10, SCREENSHOT_MAX_SIDE, 1);

    expect(frame).toEqual({ width: 20, height: 20, zoom: 1 });
  });

  /**
   * Topologia grande sai menos nitida; nenhuma topologia sai pela metade. O
   * corte seria invisivel para quem so olha o arquivo, e e o erro que nao se
   * pode cometer aqui.
   */
  it('reduz a densidade em vez de cortar quando passa do teto', () => {
    const frame = screenshotFrame(bounds(4000, 1000))!;

    expect(Math.max(frame.width, frame.height)).toBeLessThanOrEqual(SCREENSHOT_MAX_SIDE);
    expect(frame.zoom).toBeLessThan(2);
    // A proporcao da topologia é preservada — reduzir não é recortar.
    expect(frame.width / frame.height).toBeCloseTo((4000 + 96) / (1000 + 96), 5);
  });

  it('o teto vale para o lado maior, seja ele qual for', () => {
    const deitada = screenshotFrame(bounds(6000, 100))!;
    const empe = screenshotFrame(bounds(100, 6000))!;

    expect(deitada.width).toBeLessThanOrEqual(SCREENSHOT_MAX_SIDE);
    expect(empe.height).toBeLessThanOrEqual(SCREENSHOT_MAX_SIDE);
  });

  /**
   * `getNodesBounds` de uma lista vazia devolve uma caixa com `Infinity` — sem
   * este guard, o tamanho da imagem sairia `NaN` e o PNG viria em branco.
   */
  it('sem elementos não há enquadramento', () => {
    expect(screenshotFrame({ x: 0, y: 0, width: Infinity, height: Infinity })).toBeUndefined();
    expect(screenshotFrame({ x: 0, y: 0, width: NaN, height: NaN })).toBeUndefined();
  });
});

describe('screenshotFilename', () => {
  const quando = new Date(2026, 8, 1, 9, 5);

  it('usa o título do painel e o instante da captura', () => {
    expect(screenshotFilename('Topologia Núcleo', quando)).toBe('topologia-nucleo-2026-09-01-0905.png');
  });

  /** Duas capturas do mesmo painel são dois documentos, não um duplicado. */
  it('o carimbo separa capturas do mesmo painel', () => {
    const antes = screenshotFilename('Rede', new Date(2026, 8, 1, 9, 5));
    const depois = screenshotFilename('Rede', new Date(2026, 8, 1, 9, 15));

    expect(antes).not.toBe(depois);
  });

  it('painel sem título ainda gera um nome utilizável', () => {
    expect(screenshotFilename(undefined, quando)).toBe('topoflow-2026-09-01-0905.png');
    expect(screenshotFilename('   ', quando)).toBe('topoflow-2026-09-01-0905.png');
  });

  /** Barra em nome de arquivo não é caractere, é separador de diretório. */
  it('não deixa passar nada que não seja letra, dígito ou hífen', () => {
    expect(screenshotFilename('NOC / Core: "produção"', quando)).toBe('noc-core-producao-2026-09-01-0905.png');
  });

  it('trunca título quilométrico sem perder o carimbo', () => {
    const nome = screenshotFilename('a'.repeat(200), quando);

    expect(nome).toBe(`${'a'.repeat(60)}-2026-09-01-0905.png`);
  });
});

describe('downloadImage', () => {
  /**
   * O `<a download>` clicado por codigo e o unico caminho que **nomeia** o
   * arquivo: abrir a data URI numa aba mostra a imagem, mas o "salvar como" do
   * browser chega sem nome nenhum.
   */
  it('entrega o arquivo já nomeado', () => {
    const link = document.createElement('a');
    const click = jest.spyOn(link, 'click').mockImplementation(() => {});
    jest.spyOn(document, 'createElement').mockReturnValueOnce(link);

    downloadImage('data:image/png;base64,AAA', 'rede-2026-09-01-0905.png');

    expect(link.download).toBe('rede-2026-09-01-0905.png');
    expect(link.href).toBe('data:image/png;base64,AAA');
    expect(click).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
