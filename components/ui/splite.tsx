'use client'

import { Suspense, lazy, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-neutral-500 text-sm">3D Scene Unavailable</div>
      </div>
    );
  }

  return (
    <Suspense 
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      }
    >
      <div className="w-full h-full min-h-[400px]">
        <Spline
          scene={scene}
          className={className}
          onError={() => setHasError(true)}
        />
      </div>
    </Suspense>
  )
}
