'use client';

import Link from 'next/link';
import { SplineSceneBasic } from "@/components/ui/spline-scene-basic";
import { ArrowRight } from 'lucide-react'; 

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-black text-white selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">B</div>
            <span>Betsy AI</span>
          </div>
          <div className="flex items-center gap-4">
             <Link 
               href="/dashboard"
               className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
             >
               Sign In
             </Link>
             <Link 
               href="/dashboard"
               className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
             >
               Get Started
             </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col pt-16 md:pt-32 pb-8 md:pb-20 px-6">
        <div className="container mx-auto max-w-6xl space-y-6 md:space-y-12">
          
          {/* Reusing the Spline Scene with Custom Landing Copy */}
          <div className="w-full">
            <SplineSceneBasic 
              title={
                <h1 className="text-4xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-400">
                  Business Intelligence <br />
                  <span className="text-indigo-500">Reimagined.</span>
                </h1>
              }
              description={
                <div className="mt-6 max-w-xl space-y-6">
                  <p className="text-lg text-slate-400 leading-relaxed">
                    Betsy AI transforms your raw data into actionable strategic insights. 
                    Upload documents, ask questions, and get semantic answers instantly.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Link href="/dashboard" className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 px-8 font-medium text-white transition-all duration-300 hover:bg-indigo-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                      <span className="flex items-center gap-2">
                        Launch Dashboard <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>

                  </div>
                </div>
              }
              showStatus={false} // Hide the "System Active" status for cleaner landing look
              isCard={false} // No box border/background for landing page
            />
          </div>

          {/* Footer */}
          <div className="mt-8 md:mt-24 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-4">
              <p className="font-bold text-slate-300">Betsy AI</p>
              <span className="text-slate-600 text-xs border-l border-white/10 pl-4">&copy; 2026 All rights reserved.</span>
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>

        </div>
      </section>

    </main>
  );
}
