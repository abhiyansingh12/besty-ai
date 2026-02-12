'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react'; 
import { Spotlight } from "@/components/ui/spotlight";

export default function LandingPage() {
  return (
    <main className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden relative selection:bg-indigo-100 selection:text-indigo-900">
      
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20 opacity-20"
        fill="#4f46e5"
      />

      {/* Navbar */}
      <nav className="w-full z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl shrink-0">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">B</div>
            <span className="text-slate-900">Betsy AI</span>
          </div>
          <div className="flex items-center gap-4">
             <Link 
               href="/dashboard"
               className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
             >
               Sign In
             </Link>
             <Link 
               href="/dashboard"
               className="px-4 py-2 bg-slate-200 text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-300 transition-colors"
             >
               Get Started
             </Link>
          </div>
        </div>
      </nav>

      {/* Main Content - No Scroll */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 overflow-y-auto md:overflow-hidden">
        <div className="w-full max-w-7xl flex flex-col items-center gap-2 md:gap-12 h-full justify-center py-4 md:py-0">
          
          {/* Title - Top Centered */}
          <h1 className="text-3xl md:text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-slate-900 via-slate-800 to-slate-500 text-center shrink-0 leading-tight md:leading-tight pb-2">
            Business Intelligence <br />
            <span className="text-indigo-600">Reimagined.</span>
          </h1>

          {/* Content Area - Split Layout */}
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-16 w-full justify-center flex-1 min-h-0">
            
            {/* Image Area - Left Side */}
            <div className="relative w-full md:w-3/5 flex items-center justify-center h-[35vh] md:h-full md:max-h-[60vh] shrink-0 md:shrink">
               <div className="relative w-full h-full">
                  <Image 
                    src="/landing-organization.png" 
                    alt="Betsy AI organizing files" 
                    fill
                    className="object-contain"
                    priority
                  />
               </div>
            </div>

            {/* Text & CTA - Right Side */}
            <div className="flex flex-col items-center md:items-start gap-6 md:gap-8 shrink-0 max-w-xl text-center md:text-left md:w-2/5 pb-4 md:pb-0">
               <p className="text-sm md:text-lg text-slate-600 leading-relaxed px-4 md:px-0">
                 Betsy AI understands your files and turns raw data into clear, actionable insights. Upload any file, ask questions, and get answers instantly.
               </p>
               
               <Link href="/dashboard" className="group relative inline-flex h-10 md:h-12 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 px-6 md:px-8 font-medium text-white transition-all duration-300 hover:bg-indigo-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                  <span className="flex items-center gap-2 text-sm md:text-base">
                    Launch Dashboard <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
               </Link>
            </div>

          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full border-t border-slate-200 bg-white/50 backdrop-blur-sm py-2 md:py-3 shrink-0">
        <div className="container mx-auto px-6 flex items-center justify-between text-[10px] md:text-xs text-slate-400">
           <span>&copy; 2026 Betsy AI.</span>
           <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-slate-600">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-600">Terms</Link>
           </div>
        </div>
      </div>

    </main>
  );
}
