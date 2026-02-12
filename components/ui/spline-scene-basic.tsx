'use client'

import { FileText, FileSpreadsheet, Database } from 'lucide-react';

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
    ? "w-full min-h-[500px] bg-white relative overflow-hidden border border-slate-200"
    : "w-full min-h-[500px] relative overflow-hidden";

  return (
    <Wrapper className={cn(baseClass, className)}>
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20 opacity-20"
        fill="#4f46e5"
      />
      
      <div className="flex flex-col h-full min-h-[500px] justify-center items-center text-center p-8">
        {/* TITLE */}
        <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto">
          {title || (
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500">
              Secure Data <br />
              <span className="text-indigo-600">Meaning Extraction</span>
            </h1>
          )}
        </div>

        {/* DESCRIPTION */}
        <div className="mt-8 relative z-10 flex flex-col items-center max-w-2xl mx-auto">
          {description || (
            <p className="text-slate-600 leading-relaxed">
              Upload your <strong>Excel, CSV, and PDF</strong> files into our encrypted vector database. 
              Betsy doesn&apos;t just read words—she understands the 
              <span className="text-indigo-600 font-semibold"> semantic meaning </span> 
              of your data to provide context-aware answers.
            </p>
          )}
          
          {showStatus && (
            <div className="flex items-center gap-4 mt-8 text-xs font-mono text-slate-500 uppercase tracking-widest justify-center">
              <div className="flex items-center gap-1.5 text-green-600/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                System Active
              </div>
              
              <div className="h-4 w-px bg-slate-200 mx-2" />
              
              <div className="flex gap-3 text-slate-400">
                 <div className="flex items-center gap-1" title="Excel/CSV Support">
                   <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                 </div>
                 <div className="flex items-center gap-1" title="PDF Support">
                   <FileText className="w-4 h-4 text-indigo-600" />
                 </div>
                 <div className="flex items-center gap-1" title="Vector Database">
                   <Database className="w-4 h-4 text-indigo-600" />
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  )
}
