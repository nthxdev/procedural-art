# Procedural Studio — React Router Lesson 1

This is a source-file bundle for the React + TypeScript + React Router project shown in the request.

## Files

- `src/App.tsx` — application layout and React Router routes.
- `src/pages/CircleGeneratorPage.tsx` — the lesson page, explanations, source-code example, and exercise checklist.
- `src/components/CircleGenerator.tsx` — interactive HTML Canvas circle generator.
- `src/main.tsx` — React entry point and `BrowserRouter`.
- `src/index.css` — Tailwind import and global styles.

## Add it to your existing project

1. Keep a backup of your current `src` folder.
2. Copy this bundle's `src` folder into the root of your existing Vite React TypeScript project. Replace the matching files.
3. Make sure the project has `react`, `react-dom`, `react-router`, and Tailwind CSS installed and configured.
4. Start the development server with `npm run dev`.

The imports use `react-router`, matching the React Router setup in the question. The CSS uses Tailwind CSS v4 syntax (`@import 'tailwindcss';`), also matching the supplied project.

## Routes

- `/` — Lesson 1: Random Art Generator
- `/lessons/vectors` — Lesson 1: Random Art Generator
- `/about` — About the course
- `/diagram` — Diagram section placeholder
- `/lab` — Graphics Lab placeholder

The circle slider redraws the canvas when its value changes. The **Generate new artwork** button creates a new random arrangement with the current circle count. The exercise checklist tracks completion in the current page session.
