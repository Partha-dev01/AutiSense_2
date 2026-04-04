/**
 * InferenceWorker — Web Worker that runs the full multimodal autism detector
 * inference pipeline off the main thread so that the UI remains responsive.
 *
 * Ported from the standalone detector (Autism_code/web/src/workers/InferenceWorker.ts)
 * and adapted for the AutiSense Next.js app.
 *
 * Protocol:
 *   Main  -> Worker:  { type: "init" }
 *   Worker -> Main:   { type: "initialized" }
 *
 *   Main  -> Worker:  { type: "processFrame", imageData: ImageData }
 *   Worker -> Main:   { type: "result", data: PipelineResult }
 *
 *   Main  -> Worker:  { type: "toggleFace", enabled: boolean }
 *   Main  -> Worker:  { type: "setModality", modality: Modality }
 *   Main  -> Worker:  { type: "reset" }
 *
 *   Worker -> Main:   { type: "error", message: string }
 *
 * Privacy: Raw video frames are processed and immediately discarded.
 * Only numerical scores (PipelineResult) are emitted back to the main thread.
 */

import { MultimodalOrchestrator } from "../app/lib/inference/MultimodalOrchestrator";
import type { WorkerInMessage, WorkerOutMessage, PipelineResult } from "../app/types/inference";

const pipeline = new MultimodalOrchestrator();
let isProcessing = false;

/** Post a typed message to the main thread. */
function post(msg: WorkerOutMessage): void {
  self.postMessage(msg);
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "init": {
        console.log("[Worker] Loading ONNX models...");
        const MAX_RETRIES = 3;
        const DELAYS = [1000, 2000, 4000];
        let lastError: unknown;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`[Worker] Retry ${attempt}/${MAX_RETRIES}...`);
              await new Promise(r => setTimeout(r, DELAYS[attempt - 1]));
            }
            const t0 = performance.now();
            await pipeline.init();
            console.log(`[Worker] Models loaded in ${(performance.now() - t0).toFixed(0)}ms`);
            post({ type: "initialized" });
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
          }
        }
        if (lastError) throw lastError;
        break;
      }

      case "toggleFace": {
        await pipeline.setFaceEnabled(msg.enabled);
        break;
      }

      case "setModality": {
        await pipeline.setModality(msg.modality);
        break;
      }

      case "reset": {
        pipeline.reset();
        break;
      }

      case "processFrame": {
        // Drop frames if the previous inference is still running.
        if (isProcessing) return;
        isProcessing = true;

        const t0 = performance.now();
        const result: PipelineResult = await pipeline.processFrame(msg.imageData);
        const elapsed = performance.now() - t0;
        if (elapsed > 1000) {
          console.log(`[Worker] Frame processed in ${elapsed.toFixed(0)}ms (first frame is slow due to WASM compilation)`);
        }

        // Transfer typed arrays for zero-copy posting.
        const transferable: Transferable[] = [];
        if (result.keypoints) transferable.push(result.keypoints.buffer);
        if (result.confidence) transferable.push(result.confidence.buffer);
        if (result.behavior) transferable.push(result.behavior.probabilities.buffer);

        self.postMessage({ type: "result", data: result }, { transfer: transferable });

        isProcessing = false;
        break;
      }
    }
  } catch (err) {
    isProcessing = false;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Worker] Error:", message);
    post({ type: "error", message });
  }
};

export {};
