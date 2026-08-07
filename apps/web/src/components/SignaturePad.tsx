"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

interface Props {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}

function getPoint(canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const point = "touches" in e ? e.touches[0] : e;
  return { x: point.clientX - rect.left, y: point.clientY - rect.top };
}

export function SignaturePad({ value, onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(!!value);

  // Restore a previously saved signature (e.g. reopening the builder preview).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";

    function start(e: MouseEvent | TouchEvent) {
      if (!canvas) return;
      drawingRef.current = true;
      const { x, y } = getPoint(canvas, e);
      ctx!.beginPath();
      ctx!.moveTo(x, y);
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawingRef.current || !canvas) return;
      e.preventDefault();
      const { x, y } = getPoint(canvas, e);
      ctx!.lineTo(x, y);
      ctx!.stroke();
    }
    function end() {
      if (!drawingRef.current || !canvas) return;
      drawingRef.current = false;
      setHasDrawing(true);
      onChange(canvas.toDataURL("image/png"));
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: true });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange("");
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className={`w-full touch-none ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-slate-400">Draw your signature above.</p>
        {!disabled && hasDrawing && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
          >
            <Eraser size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
