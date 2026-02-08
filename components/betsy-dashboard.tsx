'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Table, ShieldCheck, Search, 
  UploadCloud, Send, ChevronRight, Database, Loader2,
  PanelLeft, PanelRight, User, Settings, LogOut
} from 'lucide-react';
import { SplineSceneBasic } from "@/components/ui/spline-scene-basic";
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Session } from '@supabase/supabase-js';

// Types for our documents
interface Doc {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  url: string;
  user_id: string;
}

const BetsyDashboard = () => {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([
    { role: 'ai', content: "Hello! Upload a document to start analyzing your data semantically." }
  ]);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching docs:', error);
    else setDocuments(data || []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchDocuments();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDocuments();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/dashboard`,
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      });
      if (error) setAuthError(error.message);
      else alert('Check your email for the confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/dashboard`
      }
    });
    if (error) setAuthError(error.message);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    setUploading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      setAuthError('Error uploading file: ' + uploadError.message);
      setUploading(false);
      return;
    }

    // 2. Insert into DB
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
    
    const { data: insertedDoc, error: dbError } = await supabase
      .from('documents')
      .insert({
        filename: file.name,
        file_type: fileExt,
        file_url: publicUrl,
        user_id: session?.user?.id
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving document metadata:', dbError);
    } else {
      // 3. Ingest Document (Chunk & Embed)
      try {
        const ingestResponse = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: insertedDoc.id,
            storagePath: filePath
          })
        });

        if (!ingestResponse.ok) throw new Error('Ingestion failed');
        
        console.log('Document processed successfully');
      } catch (err: any) {
        console.error('Error processing document:', err);
        let msg = 'Semantic processing failed.';
        if (err instanceof Error) msg += ' ' + err.message;
        alert(`Upload warning: ${msg}. Check console for details.`);
      }

      fetchDocuments();
    }
    setUploading(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    // Add user message
    const newMsg = { role: 'user' as const, content: chatInput };
    setMessages(prev => [...prev, newMsg]);
    const currentInput = chatInput;
    setChatInput('');

    // Call API for semantic search
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          documentId: selectedDoc?.id || undefined, // Search all if undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (error) {
      console.error('Search error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error searching your knowledge base." }]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[#050505] items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-[#050505] items-center justify-center text-white p-4">
        <div className="w-full max-w-md space-y-8 bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              {isSignUp ? 'Create an Account' : 'Welcome to Betsy'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isSignUp ? 'Get started with your semantic dashboard' : 'Access your secured semantic dashboard'}
            </p>
          </div>

          <div className="space-y-4">
            <form onSubmit={handleAuth} className="space-y-4">
              {authError && (
                <div className="p-3 text-xs text-red-200 bg-red-900/20 border border-red-900/50 rounded-md">
                  {authError}
                </div>
              )}
              
              <div className="space-y-4">
                {isSignUp && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">First Name</label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full rounded-md border-0 bg-white/5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">Last Name</label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full rounded-md border-0 bg-white/5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border-0 bg-white/5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border-0 bg-white/5 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? "Create Account" : "Sign in")}
                </button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#111] px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-md bg-white text-slate-900 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
            >
              <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 font-sans antialiased overflow-hidden">
      
      {/* LEFT SIDEBAR: KNOWLEDGE BASE */}
      <aside className={cn(
        "border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
        isLeftSidebarOpen ? "w-72 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-full border-0"
      )}>
        <div className="p-6 border-b border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">B</div>
          <h1 className="text-xl font-semibold tracking-tight">Betsy AI</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">Knowledge Base</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.csv,.xlsx,.txt"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-all text-sm group disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-indigo-400" />
              ) : (
                <UploadCloud size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              )}
              <span>{uploading ? 'Uploading...' : 'Upload Document'}</span>
            </button>
          </div>

          <div className="space-y-1">
            {documents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 italic">
                  No documents yet.
                </div>
            ) : (
              documents.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                    selectedDoc?.id === doc.id 
                      ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                      : "hover:bg-white/5 text-slate-400"
                  )}
                >
                  {doc.file_type === 'pdf' ? <FileText size={16} /> : <Table size={16} />}
                  <span className="truncate">{doc.filename}</span>
                  {selectedDoc?.id === doc.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          {/* Secured Badge */}
          <div className="mb-4 flex items-center gap-2 text-[10px] text-green-400/80 font-medium px-2">
            <ShieldCheck size={12} />
            <span>SECURED END-TO-END</span>
          </div>

          {/* User Profile Section - Clickable Toggle */}
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center gap-3 px-2 py-2 mb-1 rounded-xl hover:bg-white/5 transition-colors text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                {session?.user?.user_metadata?.first_name || 'User'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {session?.user?.email}
              </p>
            </div>
            <ChevronRight size={14} className={cn("text-slate-500 transition-transform", isProfileOpen && "rotate-90")} />
          </button>

          {/* Collapsible Actions */}
          <div className={cn(
            "space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
            isProfileOpen ? "max-h-24 opacity-100 pb-2" : "max-h-0 opacity-0"
          )}>
            <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs group pl-12">
               <Settings size={14} className="group-hover:text-indigo-400 transition-colors" /> 
               <span>Settings</span>
            </button>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs group pl-12"
            >
              <LogOut size={14} className="group-hover:text-red-400 transition-colors" /> 
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* CENTER: SEMANTIC CHAT */}
      <main className="flex-1 flex flex-col bg-[#080808] relative">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
          >
            <PanelLeft size={16} />
          </button>
        </div>
        <div className="absolute top-4 right-4 z-50 xl:block hidden">
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
          >
            <PanelRight size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          
          {/* Integrated 3D Scene */}
          <div className="w-full max-w-4xl mx-auto mb-8">
            <SplineSceneBasic 
              isCard={false} 
              showStatus={false}
              className="h-64"
              title={
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Welcome, {session.user.user_metadata?.first_name || session.user.email?.split('@')[0]}
                </h1>
              }
              description={
                <p className="mt-2 text-slate-400 text-sm max-w-md">
                   {selectedDoc 
                     ? `Analyzing context from ${selectedDoc.filename}...` 
                     : "Ask questions about your uploaded documents."}
                </p>
              }
            />
          </div>

          {/* Chat Messages */}
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px]",
                  msg.role === 'ai' ? "bg-indigo-600" : "bg-slate-700"
                )}>
                  {msg.role === 'ai' ? 'AI' : 'U'}
                </div>
                <div className="space-y-2">
                  <p className="text-slate-300 leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.role === 'ai' && idx === messages.length - 1 && selectedDoc && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 transition-colors flex items-center gap-2">
                        <Search size={12} /> View Source Chunks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Invisible div to auto-scroll to */}
            <div id="chat-end" />
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="p-6 max-w-4xl w-full mx-auto">
          <div className="relative group">
            {/* Hidden Chat File Input */}
            <input 
              type="file" 
              ref={chatFileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.csv,.xlsx,.txt"
            />
            
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={selectedDoc ? `Ask about ${selectedDoc.filename}...` : "Ask anything about your knowledge base..."}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 pr-14 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
            />
            
            {/* Upload Button in Input */}
            <button 
              onClick={() => chatFileInputRef.current?.click()}
              disabled={uploading}
              className="absolute left-3 top-2.5 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              title="Upload Document"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-indigo-400" />
              ) : (
                <UploadCloud size={18} />
              )}
            </button>

            <button 
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className="absolute right-3 top-2.5 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:bg-slate-700 disabled:opacity-50"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-4 tracking-tight">
            Betsy uses semantic vector search to ensure accuracy. Privacy is encrypted.
          </p>
        </div>
      </main>

      {/* RIGHT PANE: DATA INSPECTOR */}
      <section className={cn(
        "border-l border-white/10 bg-black/40 backdrop-blur-xl hidden xl:block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
        isRightSidebarOpen ? "w-80 p-6 opacity-100 translate-x-0" : "w-0 p-0 opacity-0 translate-x-full border-0"
      )}>
        <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
          <Database size={16} className="text-indigo-400" />
          Semantic Context
        </h3>
        
        {selectedDoc ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-indigo-400 uppercase">Match Score: 0.98</span>
                <FileText size={12} className="text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 italic">
                &quot;...analysis of {selectedDoc.filename} indicates strong correlation in sector 7G...&quot;
              </p>
              <button className="text-[10px] text-indigo-300 hover:underline flex items-center gap-1">
                Open Page 1 <ChevronRight size={10} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic text-center mt-10">
            Select a document to view semantic context context match scores.
          </div>
        )}
      </section>

    </div>
  );
};

export default BetsyDashboard;
