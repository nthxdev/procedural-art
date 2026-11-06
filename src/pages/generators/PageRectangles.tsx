import { useEffect, useRef, useState } from "react";

export default function PageRectangles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [count, setCount] = useState(100);
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

      const width = 10 + Math.random() * 100;
      const height = 10 + Math.random() * 100;

      const hue = Math.random() * 360;

      ctx.fillStyle = `hsl(${hue}, 85%, 65%)`;
      ctx.fillRect(x, y, width, height);
    }
  }, [count, generation]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">

      <h1 className="text-2xl font-bold">
        Random Rectangles
      </h1>

      <div className="flex items-center gap-5">

        <label>
          Rectangle Count: {count}
          <input
            type="range"
            min="10"
            max="500"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
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