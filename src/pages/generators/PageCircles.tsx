import { useEffect, useRef, useState } from "react";

export default function PageCircles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [count, setCount] = useState(150);
  const [maxRadius, setMaxRadius] = useState(30);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    ctx.fillStyle = "#101522";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 5 + Math.random() * (maxRadius - 5);
      const hue = Math.random() * 360;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue}, 85%, 65%)`;
      ctx.fill();
    }
  }, [count, maxRadius, generation]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">

      <h1 className="text-2xl font-bold">
        Random Circles
      </h1>

      <div className="flex flex-wrap gap-6">

        <label>
          Circle Count: {count}
          <input
            type="range"
            min="10"
            max="500"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="ml-3"
          />
        </label>

        <label>
          Maximum Radius: {maxRadius}
          <input
            type="range"
            min="10"
            max="100"
            value={maxRadius}
            onChange={(e) => setMaxRadius(Number(e.target.value))}
            className="ml-3"
          />
        </label>

      </div>

      <canvas
        ref={canvasRef}
        width={1000}
        height={600}
        className="h-auto w-full border border-neutral-300"
      />

    </main>
  );
}