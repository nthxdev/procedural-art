import { Link, Outlet, Route, Routes } from "react-router";

import PageIndex from "./pages/Index";
import RandomCircles from "./pages/generators/RandomCircles";
import Art from "./pages/generators/Art";
import Viewport from "./pages/viewport";

export default function App() {
  return (
    <Routes>
        <Route index element={<PageIndex />} />
        <Route path="generators/RandomCircles" element={<RandomCircles />} />
        <Route path="generators/Art" element={<Art />} />
        <Route path="viewport" element={<Viewport />} />
    </Routes>
  );
}