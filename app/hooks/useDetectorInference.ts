/**
 * useDetectorInference — React hook that manages the ONNX inference worker,
 * feeds webcam frames, and returns multimodal pipeline results.
 *
 * Adapted from Autism_code/web/src/hooks/useInference.ts for AutiSense.
 * Worker runs off main thread via requestAnimationFrame loop.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { PipelineResult, WorkerOutMessage, Modality } from "../types/inference";

export interface UseDetectorInferenceReturn {
  result: PipelineResult | null;
  isModelLoaded: boolean;
  error: string | null;
  modelError: string | null;
  backend: string;
  modality: Modality;
  setModality: (m: Modality) => void;
  faceEnabled: boolean;
  resetPipeline: () => void;
  retryInit: () => void;
}

export function useDetectorInference(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isCamReady: boolean,
): UseDetectorInferenceReturn {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [backend, setBackend] = useState("");
  const [modality, setModalityState] = useState<Modality>("both");

  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const rafRef = useRef(0);

  // Create & initialise the worker on mount
  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../workers/inference.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (err) {
      setModelError(`Failed to create inference worker: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case "initialized":
          setIsModelLoaded(true);
          setModelError(null);
          break;
        case "result":
          setResult(msg.data);
          busyRef.current = false;
          break;
        case "error":
          if (msg.message.includes("404") || msg.message.includes("Failed to fetch") || msg.message.includes("not initialised")) {
            setModelError(msg.message);
          } else {
            setError(msg.message);
          }
          busyRef.current = false;
          break;
      }
    };

    worker.onerror = (ev) => {
      setModelError(`Worker error: ${ev.message}`);
    };

    worker.postMessage({ type: "init" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Detect backend
  useEffect(() => {
    if (result && !backend) {
      (async () => {
        try {
          if ("gpu" in navigator) {
            const adapter = await (navigator as any).gpu.requestAdapter();
            setBackend(adapter ? "webgpu" : "wasm");
          } else {
            setBackend("wasm");
          }
        } catch {
          setBackend("wasm");
        }
      })();
    }
  }, [result, backend]);

  // Frame capture loop
  const sendFrame = useCallback(() => {
    const worker = workerRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!worker || !video || !canvas || !isCamReady || !isModelLoaded) {
      rafRef.current = requestAnimationFrame(sendFrame);
      return;
    }

    if (busyRef.current || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(sendFrame);
      return;
    }

    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(sendFrame); return; }

      const TARGET_W = 320, TARGET_H = 240;
      if (canvas.width !== TARGET_W || canvas.height !== TARGET_H) {
        canvas.width = TARGET_W;
        canvas.height = TARGET_H;
      }

      ctx.drawImage(video, 0, 0, TARGET_W, TARGET_H);
      const imageData = ctx.getImageData(0, 0, TARGET_W, TARGET_H);

      busyRef.current = true;
      worker.postMessage({ type: "processFrame", imageData }, [imageData.data.buffer]);
    } catch (err) {
      console.warn("[useDetectorInference] Frame capture error:", err);
    }

    rafRef.current = requestAnimationFrame(sendFrame);
  }, [videoRef, canvasRef, isCamReady, isModelLoaded]);

  useEffect(() => {
    // Only start the rAF loop when camera + models are both ready
    if (!isCamReady || !isModelLoaded) return;
    rafRef.current = requestAnimationFrame(sendFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sendFrame, isCamReady, isModelLoaded]);

  const resetPipeline = useCallback(() => {
    workerRef.current?.postMessage({ type: "reset" });
  }, []);

  const retryInit = useCallback(() => {
    setModelError(null);
    setIsModelLoaded(false);
    workerRef.current?.postMessage({ type: "init" });
  }, []);

  const setModality = useCallback((m: Modality) => {
    setModalityState(m);
    workerRef.current?.postMessage({ type: "setModality", modality: m });
  }, []);

  return {
    result, isModelLoaded, error, modelError, backend,
    modality, setModality, faceEnabled: modality === "face" || modality === "both",
    resetPipeline, retryInit,
  };
}
