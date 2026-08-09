// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// O jsdom define `getContext`, mas ele devolve `null` sem o pacote `canvas`.
// O `Combobox` do @grafana/ui mede texto para se auto-dimensionar e quebra
// nesse `null` — nada a ver com o codigo em teste. Substituicao incondicional:
// um guard por existencia nao pega o caso, ja que a funcao existe.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => ({
    measureText: (text) => ({ width: String(text ?? '').length * 8 }),
  });
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
