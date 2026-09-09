const path = require('path');

/**
 * Imports de imagem no jest.
 *
 * O webpack os trata como `asset/resource` e devolve uma URL; o jest tentaria
 * parsear o PNG como JavaScript. Este transformer devolve o **nome do arquivo**,
 * e nao um stub generico, porque e o nome que os testes precisam distinguir:
 * um pack de variantes escolhe entre `router-gray-96.png` e `router-red-96.png`,
 * e com um stub unico os dois casos passariam identicos — inclusive o errado.
 */
module.exports = {
  process(_src, filename) {
    return { code: `module.exports = ${JSON.stringify(path.basename(filename))};` };
  },
  getCacheKey() {
    return 'topoflow-file-transform-v1';
  },
};
