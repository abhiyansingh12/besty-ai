'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white hover:text-indigo-400 transition-colors">
                        <ArrowLeft size={20} />
                        <span>Back to Home</span>
                    </Link>
                </div>
            </nav>

            <div className="container mx-auto max-w-4xl px-6 pt-32 pb-20">
                <h1 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight">Privacy Policy</h1>
                <p className="text-slate-400 mb-12">Last updated: February 8, 2026</p>

                <div className="space-y-12 text-slate-300 leading-relaxed font-light">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
                        <p className="text-slate-400">
                            Betsy AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you access our website and use our AI-powered business intelligence services (the "Service"). By using the Service, you consent to the data practices described in this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
                        <p className="mb-4 text-slate-400">
                            We collect information that you assist us in providing the Service effectively. This includes:
                        </p>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">A. Personal Information</h3>
                                <p className="text-slate-400">
                                    When you register for an account, we collect personally identifiable information, such as your name, email address, and authentication credentials. If you subscribe to paid services, we may collect billing information (processed by secure third-party payment providers).
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">B. User Content (Documents & Data)</h3>
                                <p className="text-slate-400">
                                    We collect and process the documents, spreadsheets, text files, and other data you upload to the Service ("User Content") solely for the purpose of providing AI analysis and generation. <strong>Your documents remain your property.</strong> We do not use your proprietary documents to train public AI models without your explicit consent.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">C. Usage & Technical Data</h3>
                                <p className="text-slate-400">
                                    We automatically collect certain information when you visit, use, or navigate the Service. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, and information about how and when you use our Service.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
                        <p className="mb-4 text-slate-400">
                            We use the information we collect or receive for the following legitimate business purposes:
                        </p>
                        <ul className="list-disc pl-5 space-y-3 text-slate-400 marker:text-indigo-500">
                            <li>
                                <strong className="text-white">To Provide and Manage the Service:</strong> We use your information to facilitate account creation, authentication, and the core functionality of processing your uploaded documents.
                            </li>
                            <li>
                                <strong className="text-white">To Improve Our AI Models:</strong> We may use aggregated, anonymized usage data to improve the performance and accuracy of our AI systems. We do <strong>not</strong> access your raw private documents for model training purposes.
                            </li>
                            <li>
                                <strong className="text-white">To Communicate with You:</strong> We may use your information to send you administrative information, such as product updates, security alerts, and support responses.
                            </li>
                            <li>
                                <strong className="text-white">To Enforce Our Terms:</strong> We may use your information to ensure compliance with our Terms of Service and to prevent malicious or illegal activity.
                            </li>
                            <li>
                                <strong className="text-white">Legal Obligations:</strong> We may disclose information where we are legally required to do so in order to comply with applicable law, governmental requests, a judicial proceeding, court order, or legal process.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">4. Data Retention & Security</h2>
                        <p className="text-slate-400 mb-4">
                            We retain your personal information and User Content only for as long as is necessary for the purposes set out in this Privacy Policy. We employ industry-standard security measures, including encryption at rest and in transit, to protect your data. However, please be aware that no security measure is perfect or impenetrable.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">5. Your Privacy Rights</h2>
                        <p className="text-slate-400">
                            Depending on your location, you may have the right to access, correct, or delete your personal information. You can manage your documents directly within the dashboard. For account deletion requests, please contact our support team.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Us</h2>
                        <p className="text-slate-400">
                            If you have questions or comments about this policy, you may email us at <a href="mailto:support@betsyai.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">support@betsyai.com</a>.
                        </p>
                    </section>
                </div>
            </div>

            <footer className="w-full border-t border-white/5 py-8 mt-auto">
                <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
                    <p>&copy; 2026 Betsy AI. All rights reserved.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}
