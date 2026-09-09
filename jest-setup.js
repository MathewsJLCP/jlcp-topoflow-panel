// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// O jsdom define `getContext`, mas ele devolve `null` sem o pacote `canvas`.
// O `Combobox` do @grafana/ui mede texto para se auto-dimensionar e quebra
// nesse `null` — nada a ver com o codigo em teste. Substituicao incondicional:
// um guard por existencia nao pega o caso, ja que a funcao existe.
//
// O contexto e um `Proxy` e nao um objeto com dois metodos porque o uPlot (o
// grafico do `MetricChart`) chama dezenas deles — `clearRect`, `beginPath`,
// `stroke`, `save`… — e enumera-los seria uma lista para manter em dia a cada
// versao do Grafana. O que o proxy faz e simples: propriedade que alguem
// escreveu (`fillStyle`, `font`) volta como foi escrita; qualquer outra vira uma
// funcao que nao faz nada. Nada e desenhado, e nada quebra.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function () {
    const estado = {
      canvas: this,
      measureText: (text) => ({ width: String(text ?? '').length * 8 }),
      // O uPlot le de volta o que gravou aqui para desenhar o gradiente.
      createLinearGradient: () => ({ addColorStop() {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };

    return new Proxy(estado, {
      get: (alvo, prop) => (prop in alvo ? alvo[prop] : () => undefined),
      set: (alvo, prop, valor) => {
        alvo[prop] = valor;
        return true;
      },
    });
  };
}

// O menu aberto do `Combobox` vive dentro do `ScrollContainer` do @grafana/ui,
// que usa `IntersectionObserver` para decidir quando mostrar as sombras de
// rolagem. O jsdom nao implementa a API, e sem este stub qualquer teste que
// abra um dropdown derruba o componente com `IntersectionObserver is not
// defined` — falha de ambiente, nao do codigo em teste.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// O `<ReactFlow>` mede o container e cada nó com `ResizeObserver`, que o jsdom
// não implementa — sem este stub, qualquer teste que renderize o canvas morre em
// `ResizeObserver is not defined` antes de chegar ao código em teste. Falha de
// ambiente, como o `IntersectionObserver` acima. As medidas ficam em zero, e é o
// bastante: quem depende de medida real (enquadramento do screenshot) é testado
// por função pura, não pelo DOM.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// O uPlot desenha as linhas com `Path2D`, que o jsdom nao implementa. Sem o
// stub, o grafico do `MetricChart` derruba qualquer teste que o renderize — de
// novo, falha de ambiente e nao do componente. Os metodos nao precisam fazer
// nada: nada e pintado num canvas que nao existe.
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
    rect() {}
    arc() {}
    addPath() {}
  };
}

// O jsdom nao implementa `scrollIntoView`. O `Accordion` do Layer o chama para
// trazer a linha realcada para a area visivel quando a selecao vem do canvas —
// numa topologia de dezenas de elementos, o realce existiria e ninguem veria.
// Sem o stub, qualquer teste com linha selecionada derruba o componente.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
