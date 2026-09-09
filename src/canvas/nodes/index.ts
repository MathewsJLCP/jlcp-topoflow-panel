import { NodeTypes } from '@xyflow/react';

import { DeviceNode } from './DeviceNode';
import { ImageNode } from './ImageNode';
import { PointNode } from './PointNode';
import { PostitNode } from './PostitNode';
import { TextNode } from './TextNode';

/**
 * Definido em modulo, nunca dentro de um componente: o React Flow remonta todos
 * os nos quando a identidade de `nodeTypes` muda.
 */
export const nodeTypes: NodeTypes = {
  deviceNode: DeviceNode,
  pointNode: PointNode,
  postitNode: PostitNode,
  textNode: TextNode,
  imageNode: ImageNode,
};
