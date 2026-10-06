import { createCanvas, DOMMatrix, ImageData } from "canvas";

import {
  type CanvasAndContext,
  type CanvasLike,
  runPdfjsBenchmark,
} from "./pdfjs-shared";
import type { BenchOptions, BenchRunResult } from "./types";

export const PDFJS_NODE_CANVAS_BACKEND = "pdfjs-dist + node-canvas";

function installGlobals(): void {
  Object.assign(globalThis, {
    DOMMatrix,
    ImageData,
  });
}

/**
 * pdf.js's default Node factory creates @napi-rs/canvas scratch canvases, and
 * node-canvas rejects them in drawImage ("Image or Canvas expected"). Keep
 * every canvas in node-canvas instead.
 */
class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number) {
    const canvas = canvasAndContext.canvas as CanvasLike;
    canvas.width = width;
    canvas.height = height;
  }

  destroy(canvasAndContext: CanvasAndContext) {
    const canvas = canvasAndContext.canvas as CanvasLike;
    canvas.width = 0;
    canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export function runPdfjsNodeCanvasBenchmark(
  inputPath: string,
  options: BenchOptions,
): Promise<BenchRunResult> {
  return runPdfjsBenchmark(
    {
      name: PDFJS_NODE_CANVAS_BACKEND,
      installGlobals,
      createCanvas: (width, height) => createCanvas(width, height),
      CanvasFactory: NodeCanvasFactory,
    },
    inputPath,
    options,
  );
}
