'use client'

import { FileText, FileSpreadsheet, Database } from 'lucide-react';

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
import { cn } from "@/lib/utils";

interface SplineSceneBasicProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  showStatus?: boolean;
  isCard?: boolean;
  className?: string; 
}

export function SplineSceneBasic({ 
  title, 
  description, 
  showStatus = true,
  isCard = true,
  className
}: SplineSceneBasicProps) {
  const Wrapper = isCard ? Card : 'div';
  const baseClass = isCard 
    ? "w-full h-[500px] bg-black/[0.96] relative overflow-hidden" 
    : "w-full h-[500px] relative overflow-hidden";

  return (
    <Wrapper className={cn(baseClass, className)}>
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex h-full">
        {/* Left content */}
        <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
          {title || (
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Secure Data <br />
              <span className="text-indigo-400">Meaning Extraction</span>
            </h1>
          )}
          
          {description || (
            <p className="mt-4 text-neutral-300 max-w-lg leading-relaxed">
              Upload your <strong>Excel, CSV, and PDF</strong> files into our encrypted vector database. 
              Betsy doesn&apos;t just read words—she understands the 
              <span className="text-indigo-300 font-semibold"> semantic meaning </span> 
              of your data to provide context-aware answers.
            </p>
          )}
          
          {showStatus && (
            <div className="flex items-center gap-4 mt-6 text-xs font-mono text-neutral-500 uppercase tracking-widest">
              <div className="flex items-center gap-1.5 text-green-400/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                System Active
              </div>
              
              <div className="h-4 w-px bg-white/10 mx-2" />
              
              <div className="flex gap-3 text-neutral-400">
                 <div className="flex items-center gap-1" title="Excel/CSV Support">
                   <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                 </div>
                 <div className="flex items-center gap-1" title="PDF Support">
                   <FileText className="w-4 h-4 text-indigo-400" />
                 </div>
                 <div className="flex items-center gap-1" title="Vector Database">
                   <Database className="w-4 h-4 text-indigo-400" />
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="flex-1 relative">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Wrapper>
  )
}
