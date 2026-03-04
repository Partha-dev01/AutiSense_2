/**
 * useActionCamera — manages camera + YOLO inference + action detection
 * for Step 7 motor instruction verification.
 *
 * Reuses the existing inference.worker.ts in body-only mode (YOLO + TCN)
 * but only extracts keypoints for rule-based action detection.
 */

"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { PipelineResult, WorkerOutMessage } from "../types/inference";
import { ActionTracker, type ActionId, type ActionResult } from "../lib/actions/actionDetector";
import { getUserMediaWithFallback, getCameraErrorMessage } from "../lib/camera/cameraUtils";

// COCO-17 skeleton connections (same as DetectorVideoCanvas)
const SKELETON: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 6], [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

export interface UseActionCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  isModelLoaded: boolean;
  isActive: boolean;
  cameraError: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  startDetecting: (action: ActionId) => void;
  stopDetecting: () => void;
  actionResult: ActionResult | null;
  actionDetected: boolean;
  consecutiveHits: number;
  keypoints: Float32Array | null;
  confidence: Float32Array | null;
}

export function useActionCamera(): UseActionCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [actionDetected, setActionDetected] = useState(false);
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [keypoints, setKeypoints] = useState<Float32Array | null>(null);
  const [confidence, setConfidence] = useState<Float32Array | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef(new ActionTracker());
  const targetActionRef = useRef<ActionId | null>(null);
  const detectingRef = useRef(false);

  // Create & initialise worker on mount
  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../workers/inference.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (err) {
      setCameraError(`Failed to create inference worker: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case "initialized":
          setIsModelLoaded(true);
          // Set body-only mode
          worker.postMessage({ type: "setModality", modality: "body" });
          break;
        case "result":
          handleResult(msg.data);
          busyRef.current = false;
          break;
        case "error":
          busyRef.current = false;
          break;
      }
    };

    worker.postMessage({ type: "init" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle inference result
  const handleResult = useCallback((result: PipelineResult) => {
    const kps = result.keypoints;
    const conf = result.confidence;
    if (kps && conf) {
      setKeypoints(kps);
      setConfidence(conf);
      drawSkeleton(kps, conf);

      if (detectingRef.current && targetActionRef.current) {
        const tracked = trackerRef.current.update(kps, conf, targetActionRef.current);
        setActionResult(tracked);
        setConsecutiveHits(tracked.consecutiveHits);
        if (tracked.confirmed) {
          setActionDetected(true);
          detectingRef.current = false;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw skeleton overlay
  const drawSkeleton = useCallback((kps: Float32Array, conf: Float32Array) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (kps.length < 34) return;

    // Scale keypoints from 320×240 to canvas size
    const scaleX = w / 320;
    const scaleY = h / 240;

    // Draw bones
    ctx.strokeStyle = "rgba(104, 159, 56, 0.8)";
    ctx.lineWidth = 2.5;
    for (const [a, b] of SKELETON) {
      if (conf[a] < 0.3 || conf[b] < 0.3) continue;
      ctx.beginPath();
      ctx.moveTo(kps[a * 2] * scaleX, kps[a * 2 + 1] * scaleY);
      ctx.lineTo(kps[b * 2] * scaleX, kps[b * 2 + 1] * scaleY);
      ctx.stroke();
    }

    // Draw keypoints
    for (let i = 0; i < 17; i++) {
      if (conf[i] < 0.3) continue;
      ctx.fillStyle = "rgba(104, 159, 56, 0.9)";
      ctx.beginPath();
      ctx.arc(kps[i * 2] * scaleX, kps[i * 2 + 1] * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // Frame capture loop
  const sendFrame = useCallback(() => {
    const worker = workerRef.current;
    const video = videoRef.current;

    if (!worker || !video || !isActive || !isModelLoaded || busyRef.current || video.paused) {
      if (isActive) rafRef.current = requestAnimationFrame(sendFrame);
      return;
    }

    try {
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement("canvas");
        captureCanvasRef.current.width = 320;
        captureCanvasRef.current.height = 240;
      }
      const ctx = captureCanvasRef.current.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(sendFrame); return; }

      ctx.drawImage(video, 0, 0, 320, 240);
      const imageData = ctx.getImageData(0, 0, 320, 240);

      busyRef.current = true;
      worker.postMessage({ type: "processFrame", imageData }, [imageData.data.buffer]);
    } catch {
      // Frame capture error — skip
    }

    rafRef.current = requestAnimationFrame(sendFrame);
  }, [isActive, isModelLoaded]);

  // Start/stop frame loop when active changes
  useEffect(() => {
    if (isActive && isModelLoaded) {
      rafRef.current = requestAnimationFrame(sendFrame);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, isModelLoaded, sendFrame]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsActive(true);
      setCameraError(null);
    } catch (err) {
      setCameraError(getCameraErrorMessage(err));
    }
  }, []);

  const stopCamera = useCallback(() => {
    setIsActive(false);
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startDetecting = useCallback((action: ActionId) => {
    targetActionRef.current = action;
    detectingRef.current = true;
    trackerRef.current.reset();
    setActionDetected(false);
    setActionResult(null);
    setConsecutiveHits(0);
  }, []);

  const stopDetecting = useCallback(() => {
    targetActionRef.current = null;
    detectingRef.current = false;
  }, []);

  // Defensive: re-attach stream when video element appears in DOM.
  // Only runs when isActive changes (camera just started).
  useEffect(() => {
    if (!isActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && !video.srcObject) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    videoRef,
    overlayRef,
    isModelLoaded,
    isActive,
    cameraError,
    startCamera,
    stopCamera,
    startDetecting,
    stopDetecting,
    actionResult,
    actionDetected,
    consecutiveHits,
    keypoints,
    confidence,
  };
}
