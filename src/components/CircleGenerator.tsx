import { useEffect, useRef, useState } from "react";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export default function CircleGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [circleCount, setCircleCount] = useState(150);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Clear canvas with background color
    ctx.fillStyle = "#101522";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Generate circles
    for (let i = 0; i < circleCount; i++) {
      const x = randomBetween(0, CANVAS_WIDTH);
      const y = randomBetween(0, CANVAS_HEIGHT);

      const radius = randomBetween(5, 30);
      const hue = randomBetween(0, 360);

      // Define circle path
      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );

      // Apply random color
      ctx.fillStyle = `hsl(${hue}, 85%, 65%)`;

      ctx.fill();
    }
  }, [circleCount, generation]);

  function generateArt() {
    setGeneration((previous) => previous + 1);
  }

  return (
    <section className="space-y-5">

      {/* Generator Controls */}
      <div className="flex flex-wrap items-center justify-between gap-5">

        <div className="flex flex-1 items-center gap-4">
          <label htmlFor="circle-count" className="whitespace-nowrap text-sm">
            Circles: <strong>{circleCount}</strong>
          </label>

          <input
            id="circle-count"
            type="range"
            min="10"
            max="500"
            step="10"
            value={circleCount}
            onChange={(event) =>
              setCircleCount(Number(event.target.value))
            }
            className="w-full max-w-xs accent-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={generateArt}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-500"
        >
          Generate New Art
        </button>

      </div>

      {/* Canvas */}
      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block h-auto w-full"
        />
      </div>

      <p className="text-sm text-neutral-500">
        Every generation uses new random positions, sizes and colors.
      </p>

    </section>
  );
}