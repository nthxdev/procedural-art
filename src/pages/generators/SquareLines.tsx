import { useEffect, useRef, useState } from "react";

export default function RandomCircles() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-8">
            <canvas
            ref={canvasRef}
            width={1000}
            height={600}
            className="h-auto w-full border border-neutral-300"
            />
        </main>
    );
}