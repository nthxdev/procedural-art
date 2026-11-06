import { Link, Outlet, Route, Routes } from "react-router";

import PageIndex from "./pages/PageIndex";
import PageCircles from "./pages/generators/PageCircles";
import PageRectangles from "./pages/generators/PageRectangles";

export default function App() {
  return (
    <Routes>
        <Route index element={<PageIndex />} />
        <Route path="art/circles" element={<PageCircles />} />
        <Route path="art/rectangles" element={<PageRectangles />} />
    </Routes>
  );
}