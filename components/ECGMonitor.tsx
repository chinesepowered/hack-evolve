"use client";

import { useEffect, useRef } from "react";
import type { Vitals } from "@/lib/evolution/engine";

/**
 * The signature element: a single-lead patient monitor.
 *
 * The waveform IS the app's health. With zero open findings it holds a calm
 * sinus rhythm in ECG mint. As findings pile up the rate climbs, the trace grows
 * tall and jittery (arrhythmia) and shifts to alarm magenta. During a verify
 * pass it settles back toward baseline. Drawn as a real left-to-right sweep with
 * the characteristic erase gap.
 */
export function ECGMonitor({ vitals, sick }: { vitals: Vitals; sick: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ bpm: 62, amp: 0, jitter: 0, color: "#2ce0a8" });

  // Feed latest vitals to the animation loop without restarting it.
  const openBugs = vitals.openBugs;
  useEffect(() => {
    const amp = Math.min(1, openBugs / 4);
    stateRef.current = {
      bpm: vitals.bpm,
      amp,
      jitter: sick ? Math.min(0.9, openBugs / 5) : 0,
      color: openBugs === 0 ? "#2ce0a8" : openBugs >= 2 ? "#ff5c7a" : "#f2b65a",
    };
  }, [vitals.bpm, openBugs, sick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(320, r.width);
      H = r.height || 150;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buf.length = Math.ceil(W);
      buf.fill(H / 2);
    };

    const buf: number[] = [];
    let cursor = 0;
    let beatPhase = 0;
    let last = performance.now();
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // One PQRST complex as a function of beat fraction u in [0,1).
    const wave = (u: number, amp: number): number => {
      const g = (c: number, w: number, h: number) =>
        h * Math.exp(-((u - c) * (u - c)) / (2 * w * w));
      let y = 0;
      y += g(0.16, 0.022, 0.12); // P
      y -= g(0.235, 0.008, 0.16); // Q
      y += g(0.26, 0.009, 1.0); // R spike
      y -= g(0.29, 0.011, 0.28); // S
      y += g(0.56, 0.05, 0.26); // T
      return y * (0.4 + amp * 0.6);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawGrid = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(150,200,210,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { bpm, amp, jitter, color } = stateRef.current;

      const beatsPerSec = bpm / 60;
      const speed = W / 4.2; // px per second the sweep travels
      const px = Math.max(1, Math.round(speed * dt));

      for (let i = 0; i < px; i++) {
        beatPhase += (beatsPerSec / speed) * 1;
        if (beatPhase >= 1) beatPhase -= 1 + (jitter ? (Math.random() - 0.5) * 0.25 : 0);
        const noise = jitter ? (Math.random() - 0.5) * jitter * 22 : 0;
        const y = H / 2 - wave(beatPhase, amp) * (H * 0.36) + noise;
        cursor = (cursor + 1) % buf.length;
        buf[cursor] = y;
      }

      drawGrid();

      // Trace with a leading erase gap, like a monitor sweep.
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      const gap = 14;
      for (let x = 0; x < buf.length; x++) {
        const idx = (cursor + 1 + x) % buf.length;
        const dist = buf.length - x;
        if (dist < gap) continue; // erase just ahead of the sweep head
        const y = buf[idx];
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Sweep head dot.
      const headX = buf.length - gap;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(headX, buf[(cursor + 1 + headX) % buf.length] || H / 2, 2.4, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      // Static single complex for reduced motion.
      drawGrid();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stateRef.current.color;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const u = ((x / W) * 3) % 1;
        const y = H / 2 - wave(u, stateRef.current.amp) * (H * 0.36);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="ecg-canvas" aria-label="Application health monitor" />;
}
