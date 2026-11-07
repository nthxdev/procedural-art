import { Link } from "react-router";

export default function Index() {
  return (
    <main className="flex min-h-[85vh] flex-col items-center justify-center gap-5">
      <h1 className="text-3xl font-bold">
        Procedural Art
      </h1>
      <nav className="flex flex-col items-center gap-3">
        <Link to="/generators/RandomCircles">Random Circles</Link>
        <Link to="/generators/Art">Art</Link>
        <Link to="/viewport">Viewport</Link>
      </nav>
    </main>
  );
}