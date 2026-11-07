import { useEffect, useRef, useState } from "react";

type Circle = {
  x: number;
  y: number;
  radius: number;
  hue: number;
};

export default function RandomCircles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"Default" | "Packed" | "Transparent">("Packed");

  const [packedCount, setPackedCount] = useState(450);
  const [transparentCount, setTransparentCount] = useState(180);

  const [maxRadius, setMaxRadius] = useState(34);
  const [generation, setGeneration] = useState(0);

  const count = mode === "Packed" ? packedCount : transparentCount;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Background
    ctx.fillStyle = mode === "Packed" ? "#404040" : "#000000";
    ctx.fillRect(0, 0, width, height);

    // =================================
    // IMAGE 1: CIRCLE PACKING
    // =================================

    if (mode === "Packed") {

      const circles: Circle[] = [];

      // Generate random circle sizes.
      // Bigger circles are placed first.
      const radii = Array.from(
        { length: count },
        () => 4 + Math.random() ** 1.8 * (maxRadius - 4)
      );

      radii.sort((a, b) => b - a);

      // Try to place each circle.
      for (const radius of radii) {

        for (let attempt = 0; attempt < 100; attempt++) {

          const x = Math.random() * width;
          const y = Math.random() * height;

          // Check whether this circle overlaps another.
          const overlaps = circles.some((other) => {

            const dx = x - other.x;
            const dy = y - other.y;

            const minDistance =
              radius + other.radius + 2;

            return (
              dx * dx + dy * dy <
              minDistance * minDistance
            );
          });

          // Only accept circles that do not overlap.
          if (!overlaps) {

            circles.push({
              x,
              y,
              radius,
              hue: Math.random() * 360,
            });

            break;
          }
        }
      }

      // Draw accepted circles.
      for (const circle of circles) {

        ctx.beginPath();

        ctx.arc(
          circle.x,
          circle.y,
          circle.radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = `hsl(${circle.hue}, 85%, 50%)`;
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#080808";
        ctx.stroke();
      }
    }

    // =================================
    // IMAGE 2: TRANSPARENT CIRCLES
    // =================================

    else {

      const circles: Circle[] = [];

      // Generate random circles.
      for (let i = 0; i < count; i++) {

        circles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 2 + Math.random() * (maxRadius - 2),
          hue: Math.random() * 360,
        });
      }

      // First draw all transparent fills.
      for (const circle of circles) {

        ctx.beginPath();

        ctx.arc(
          circle.x,
          circle.y,
          circle.radius,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          `hsla(${circle.hue}, 85%, 55%, 0.35)`;

        ctx.fill();
      }

      // Then draw all outlines.
      for (const circle of circles) {

        ctx.beginPath();

        ctx.arc(
          circle.x,
          circle.y,
          circle.radius,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle = "rgba(220, 220, 220, 0.65)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

  }, [mode, count, maxRadius, generation]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">

      <h1 className="text-2xl font-bold">
        Random Circles
      </h1>

      {/* Style selection */}
      <div className="flex gap-3">

        <button
          onClick={() => setMode("Packed")}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Circle Packing
        </button>

        <button
          onClick={() => setMode("Transparent")}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Transparent Circles
        </button>

        <button
          onClick={() => setGeneration(g => g + 1)}
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Generate
        </button>

      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-6">

        <label>
          Circle Count: {count}

          <input
            type="range"
            min={50}
            max={mode === "Packed" ? 800 : 400}
            value={count}
            onChange={(e) => {
              const value = Number(e.target.value);

              if (mode === "Packed") {
                setPackedCount(value);
              } else {
                setTransparentCount(value);
              }
            }}
            className="ml-3"
          />
        </label>

        <label>
          Maximum Radius: {maxRadius}

          <input
            type="range"
            min="10"
            max="60"
            value={maxRadius}
            onChange={(e) =>
              setMaxRadius(Number(e.target.value))
            }
            className="ml-3"
          />
        </label>

      </div>

      <canvas
        ref={canvasRef}
        width={mode === "Packed" ? 1200 : 800}
        height={mode === "Packed" ? 600 : 450}
        className="h-auto w-full border border-neutral-300"
      />

    </main>
  );
}
