"use client";

import { useEffect, useRef } from "react";
import SignaturePadLib from "signature_pad";

type Props = {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label: string;
  hint?: string;
};

export function SignaturePad({ value, onChange, label, hint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      minWidth: 0.7,
      maxWidth: 2.6,
      throttle: 8,
      minDistance: 1.5,
      penColor: "#12221c",
      backgroundColor: "rgb(255,255,255)",
    });
    padRef.current = pad;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const snapshot = pad.toData();
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      pad.clear();
      if (snapshot.length) pad.fromData(snapshot);
      else if (value) pad.fromDataURL(value);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    pad.addEventListener("endStroke", () => {
      onChange(pad.isEmpty() ? undefined : pad.toDataURL("image/png"));
    });

    return () => {
      observer.disconnect();
      pad.off();
      padRef.current = null;
    };
    // value is applied on resize; avoid re-init on every keystroke of parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sign-block">
      <div className="sign-head">
        <div>
          <div className="sign-label">{label}</div>
          <div className="muted">{hint ?? "Firma con S Pen, dito o mouse. Il tratto resta sul dispositivo."}</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            padRef.current?.clear();
            onChange(undefined);
          }}
        >
          Cancella
        </button>
      </div>
      <div className="sign-frame">
        <canvas ref={canvasRef} className="sign-canvas" />
      </div>
    </div>
  );
}
