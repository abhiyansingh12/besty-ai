# Next.js Spline Demo

This project was bootstrapped with [Create Next App](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Components

The following components have been integrated into `components/ui`:

- **SplineScene** (`splite.tsx`): Wrapper for Spline 3D scenes.
- **Spotlight** (`spotlight.tsx`): Aceternity UI spotlight effect.
- **InteractiveSpotlight** (`interactive-spotlight.tsx`): Ibelick UI interactive spotlight (move mouse).
- **Card** (`card.tsx`): Shadcn card component.
- **SplineSceneBasic** (`spline-scene-basic.tsx`): Demo composition.

## Project Structure

- `app/`: App router pages.
- `components/ui/`: Reusable UI components.
- `lib/`: Utility functions (cn).
- `public/`: Static assets.

## Notes

- The original `index.html` and other files have been moved to `_legacy/`.
