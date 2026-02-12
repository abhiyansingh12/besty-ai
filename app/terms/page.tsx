'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto max-w-4xl px-6 pt-32 pb-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight text-slate-900">Terms of Service</h1>
        <p className="text-slate-500 mb-12">Last updated: February 8, 2026</p>

        <div className="space-y-12 text-slate-700 leading-relaxed font-light">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-600">
              Welcome to Betsy AI. By accessing, browsing, or using our website and services (collectively, the "Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Description of Service</h2>
            <p className="text-slate-600">
              Betsy AI provides an AI-powered business intelligence platform that allows users to upload documents, perform semantic search, and generate insights. We reserve the right to modify, suspend, or discontinue the Service at any time, with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. User Accounts</h2>
            <p className="mb-4 text-slate-600">
              To use certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 marker:text-indigo-600">
              <li>Provide accurate, current, and complete information during the registration process.</li>
              <li>Maintain the security of your password and accept all risks of unauthorized access to your account.</li>
              <li>Immediately notify us if you discover or suspect any security breaches related to the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. User Content & Intellectual Property</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">A. Your Content</h3>
                <p className="text-slate-600">
                  You retain all rights and ownership in your data, documents, and files ("User Content"). We do not claim any ownership rights in your User Content. You grant Betsy AI a limited, worldwide license to access, use, process, and display your User Content solely as necessary to provide the Service to you.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">B. Our Intellectual Property</h3>
                <p className="text-slate-600">
                  The Service, including its software, code, proprietary algorithms, and branding ("Betsy AI IP"), is owned by Betsy AI and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our Services or included software.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Prohibited Conduct</h2>
            <p className="text-slate-600 mb-4">You agree not to engage in any of the following prohibited activities:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 marker:text-red-600">
              <li>Use the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Attempt to reverse engineer, decompile, or disassemble any aspect of the Service.</li>
              <li>Access or search the Service by any means other than our publicly supported interfaces (e.g., "scraping").</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Disclaimer of Warranties</h2>
            <p className="text-slate-600 uppercase text-sm tracking-wide leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND ON AN "AS AVAILABLE" BASIS. BETSY AI DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Limitation of Liability</h2>
            <p className="text-slate-600 uppercase text-sm tracking-wide leading-relaxed">
              IN NO EVENT SHALL BETSY AI BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; OR (III) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Governing Law</h2>
            <p className="text-slate-600">
              These Terms shall be governed and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. Contact Information</h2>
            <p className="text-slate-600">
              Questions about the Terms of Service should be sent to us at <a href="mailto:legal@betsyai.com" className="text-indigo-600 hover:text-indigo-500 transition-colors">legal@betsyai.com</a>.
            </p>
          </section>
        </div>
      </div>

      <footer className="w-full border-t border-slate-200 py-8 mt-auto">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
          <p>&copy; 2026 Betsy AI. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
