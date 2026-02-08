'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Table, ShieldCheck, Search,
  UploadCloud, Send, ChevronRight, Loader2,
  PanelLeft, User, LogOut, MoreVertical, Trash2, Edit3, X, Download, Eye
} from 'lucide-react';
import { SplineSceneBasic } from "@/components/ui/spline-scene-basic";
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { Session } from '@supabase/supabase-js';
import Papa from 'papaparse';

// Types for our documents
interface Doc {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  file_url: string;
  user_id: string;
}

const BetsyDashboard = () => {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [conversations, setConversations] = useState<Record<string, { role: 'user' | 'ai', content: string }[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [csvData, setCsvData] = useState<string[][] | null>(null);

  // Responsive Sidebar: Close on mobile, Open on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsLeftSidebarOpen(false);
      } else {
        setIsLeftSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const createOrLoadConversation = async (title?: string) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;

      // If a title is provided (e.g. for a document), always create NEW conversation
      // Otherwise try to load most recent generic one
      let existingConversations = null;

      if (!title) {
        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .order('updated_at', { ascending: false })
          .limit(1);
        existingConversations = data;
      }

      if (existingConversations && existingConversations.length > 0) {
        const conversationId = existingConversations[0].id;
        setCurrentConversationId(conversationId);
        if (activeDoc) {
          // If we have an active doc, load its messages specifically
          await loadMessages(activeDoc.id);
        } else {
          await loadMessages(null);
        }
        return conversationId;
      } else {
        // Create a new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            title: title || 'New Conversation',
            user_id: userId
          })
          .select()
          .single();

        if (createError) {
          console.warn('Could not create conversation:', createError.message);
          return null;
        }

        setCurrentConversationId(newConversation.id);
        return newConversation.id;
      }
    } catch (error) {
      console.warn('Conversation management not available yet:', error);
      return null;
    }
  };

  const loadMessages = async (docId: string | null) => {
    try {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (docId) {
        query = query.eq('document_id', docId);
      } else {
        query = query.is('document_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Could not load messages:', error.message);
      } else {
        const key = docId || 'global';
        setConversations(prev => ({
          ...prev,
          [key]: data || []
        }));
      }
    } catch (error) {
      console.warn('Message loading not available:', error);
    }
  };

  const saveMessage = async (role: 'user' | 'ai', content: string, conversationId: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          document_id: activeDoc?.id || null
        });

      if (error) {
        console.warn('Could not save message:', error.message);
        // Message saving failed but chat still works in-memory
      }

      // Update conversation's updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.warn('Message persistence not available:', error);
      // Chat still works without persistence
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchDocuments();
        createOrLoadConversation();
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchDocuments();
        createOrLoadConversation();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown menu when clicking outside
  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking the menu itself (though stopPropagation in button handles most)
      // The button needs to be excluded if not stopPropagated, but since we use stopProp, this is fine.
      setOpenMenuDocId(null);
    };

    if (openMenuDocId) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuDocId]);

  // Parse CSV for preview
  useEffect(() => {
    if (previewDoc && (previewDoc.file_type || '').toLowerCase() === 'csv') {
      setCsvData(null);
      Papa.parse(previewDoc.file_url, {
        download: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data as string[][]);
        },
        error: (err) => {
          console.error('CSV Parse Error:', err);
        }
      });
    } else {
      setCsvData(null);
    }
  }, [previewDoc]);

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

    // 2. Insert into DB (Dual Track: files_raw + documents)
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

    // Track exact raw file
    const { error: rawError } = await supabase
      .from('files_raw')
      .insert({
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileExt,
        user_id: session?.user?.id,
        storage_path: filePath
      });

    if (rawError) console.error('Error saving to files_raw:', rawError);

    // Track for AI (existing flow)
    const { data: insertedDoc, error: dbError } = await supabase
      .from('documents')
      .insert({
        filename: file.name,
        file_type: fileExt,
        file_url: publicUrl,
        user_id: session?.user?.id,
        storage_path: filePath
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

    // Ensure we have a conversation (optional - chat works without it)
    let conversationId = currentConversationId;
    if (!conversationId) {
      // If we are chatting with a document selected, create a dedicated conversation for it
      const title = activeDoc ? `Chat about ${activeDoc.filename}` : undefined;
      conversationId = await createOrLoadConversation(title);
    }

    // Add user message
    const newMsg = { role: 'user' as const, content: chatInput };
    const docKey = activeDoc?.id || 'global';

    setConversations(prev => ({
      ...prev,
      [docKey]: [...(prev[docKey] || []), newMsg]
    }));

    const currentInput = chatInput;
    setChatInput('');

    // Save user message to database (if available)
    if (conversationId) {
      await saveMessage('user', currentInput, conversationId);
    }

    // Call API for semantic search
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Sending message to API:', currentInput);
      console.log('Auth token available:', !!session.access_token);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: currentInput,
          documentId: activeDoc?.id || undefined, // Search all if undefined
        }),
      });

      console.log('API Response status:', response.status);

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', response.status, data);
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      // Add AI response
      setConversations(prev => ({
        ...prev,
        [docKey]: [...(prev[docKey] || []), { role: 'ai', content: data.answer }]
      }));

      // Save AI message to database (if available)
      if (conversationId) {
        await saveMessage('ai', data.answer, conversationId);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      let errorMsg = "Sorry, I encountered an error searching your knowledge base.";

      // Provide more specific error messages
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMsg = "Connection error. Please check your internet connection.";
      } else if (error.message?.includes('401')) {
        errorMsg = "Authentication error. Please try refreshing the page.";
      } else if (error.message?.includes('500')) {
        errorMsg = "Server error. Please try again in a moment.";
      } else if (error.message) {
        errorMsg = `Error: ${error.message}`;
      }

      setConversations(prev => ({
        ...prev,
        [docKey]: [...(prev[docKey] || []), { role: 'ai', content: errorMsg }]
      }));

      // Save error message to database too (if available)
      if (conversationId) {
        await saveMessage('ai', errorMsg, conversationId);
      }
    }
  };

  const handleDocumentClick = async (doc: Doc) => {
    setActiveDoc(doc);

    // 1. Initialize conversation for this doc if not present
    const docId = doc.id;
    if (!conversations[docId]) {
      // Load from DB
      await loadMessages(docId);
      // Also ensure we have a conversation ID for persistence
      const title = `Chat about ${doc.filename}`;
      await createOrLoadConversation(title);
    } else {
      // Just ensure conversation ID is ready for new messages
      const title = `Chat about ${doc.filename}`;
      // update currentConversationId without reloading messages
      createOrLoadConversation(title).then(id => {
        if (id) setCurrentConversationId(id);
      });
    }
  };

  const handlePreviewDocument = async (doc: Doc) => {
    // Attempt to generate a signed URL for secure access
    try {
      // Extract storage path from the public URL
      // Format is usually: .../storage/v1/object/public/documents/filename.ext
      const pathParts = doc.file_url.split('/documents/');
      if (pathParts.length > 1) {
        // We take the last part in case the string 'documents' appears earlier in the URL
        const storagePath = decodeURIComponent(pathParts[pathParts.length - 1]);

        // Generate signed URL valid for 1 hour
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600);

        if (data?.signedUrl) {
          // Use the signed URL for preview
          setPreviewDoc({ ...doc, file_url: data.signedUrl });
          return;
        } else if (error) {
          console.warn('Error generating signed URL:', error);
        }
      }
    } catch (err) {
      console.warn('Failed to generate signed URL:', err);
    }

    // Fallback if extraction or signing fails
    setPreviewDoc(doc);
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      // 1. Get the document details first to find the file_url
      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', docId)
        .single();

      if (fetchError) throw fetchError;

      // 1.5. Delete associated chat messages (Clean up chat history for this doc)
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('document_id', docId);

      if (chatError) {
        console.warn('Error deleting chat messages:', chatError);
        // Continue with deletion even if chat deletion fails
      }

      // 2. Delete associated chunks/embeddings
      const { error: chunksError } = await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', docId);

      if (chunksError) {
        console.warn('Error deleting chunks:', chunksError);
        // Continue with deletion even if chunks fail
      }

      // 3. Delete the file from storage
      if (doc?.file_url) {
        // Extract the file path from the public URL
        const urlParts = doc.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1];

        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([fileName]);

        if (storageError) {
          console.warn('Error deleting file from storage:', storageError);
          // Continue with deletion even if storage deletion fails
        }
      }

      // 4. Delete the document record from database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (deleteError) throw deleteError;

      // If the deleted doc was selected, clear selection and chat
      if (activeDoc?.id === docId) {
        setActiveDoc(null);
        // setMessages([]); // No need to clear, just switching activeDoc clears view
        setCurrentConversationId(null);
      }

      // Refresh documents list
      fetchDocuments();
      setOpenMenuDocId(null);

      console.log('Document permanently deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleRenameDocument = async (docId: string) => {
    if (!newDocName.trim()) return;

    try {
      // 1. Get old filename first to find the conversation
      const { data: oldDoc } = await supabase
        .from('documents')
        .select('filename')
        .eq('id', docId)
        .single();

      const oldFilename = oldDoc?.filename;

      // 2. Update document filename
      const { error } = await supabase
        .from('documents')
        .update({ filename: newDocName })
        .eq('id', docId);

      if (error) throw error;

      // 3. Update associated conversation title (maintain the link)
      if (oldFilename) {
        const oldTitle = `Chat about ${oldFilename}`;
        const newTitle = `Chat about ${newDocName}`;

        await supabase
          .from('conversations')
          .update({ title: newTitle })
          .eq('title', oldTitle);
      }

      // Refresh documents list
      fetchDocuments();
      setRenamingDocId(null);
      setNewDocName('');
      setOpenMenuDocId(null);
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document');
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
        "border-r border-white/10 bg-black/95 md:bg-black/40 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
        "fixed inset-y-0 left-0 z-[60] h-full md:relative md:translate-x-0",
        isLeftSidebarOpen
          ? "w-72 translate-x-0 opacity-100 shadow-2xl"
          : "-translate-x-full w-72 opacity-0 md:w-0 md:translate-x-0 md:opacity-0 md:border-0"
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
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors text-sm relative group",
                    activeDoc?.id === doc.id
                      ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                      : "hover:bg-white/5 text-slate-400",
                    openMenuDocId === doc.id && "z-20 bg-white/5 ring-1 ring-white/10"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      onClick={() => handleDocumentClick(doc)}
                      className="flex items-center gap-3 flex-1 cursor-pointer min-w-0 hover:text-indigo-300 transition-colors"
                      title="Click to select for AI context"
                    >
                      {doc.file_type === 'pdf' ? <FileText size={16} /> : <Table size={16} />}
                      <span className="truncate">{doc.filename}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {activeDoc?.id === doc.id && (
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] mx-1" />
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewDocument(doc);
                        }}
                        className="p-2 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                        title="Open File Preview"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Three-dot menu button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id);
                      }}
                      className="p-2 rounded-md hover:bg-white/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                      aria-label="More options"
                    >
                      <MoreVertical size={16} className="text-slate-400" />
                    </button>

                    {/* Dropdown menu */}
                    {openMenuDocId === doc.id && (
                      <div className="absolute right-0 top-8 z-50 w-40 bg-black/95 border border-white/20 rounded-lg shadow-xl backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingDocId(doc.id);
                            setNewDocName(doc.filename);
                            setOpenMenuDocId(null);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                        >
                          <Edit3 size={12} className="text-indigo-400" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 bg-white/[0.02]">
          {/* Secured Badge */}
          <div className="mb-4 flex items-center gap-2 text-[10px] text-green-400/80 font-medium px-2">
            <ShieldCheck size={12} />
            <span>SECURED END-TO-END</span>
          </div>

          {/* User Profile Section - Clickable Toggle */}

          <div className="relative">
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

            {/* Popup Menu */}
            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute bottom-full left-0 w-full mb-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20 animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <div className="p-1 space-y-0.5">

                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs group"
                    >
                      <LogOut size={14} className="group-hover:text-red-400 transition-colors" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isLeftSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsLeftSidebarOpen(false)}
        />
      )}

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


        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-14 md:p-8 space-y-8 scrollbar-hide">

          {/* Integrated 3D Scene */}
          <div className="w-full max-w-4xl mx-auto mb-8">
            <SplineSceneBasic
              isCard={false}
              showStatus={false}
              className="h-48 md:h-64"
              title={
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Welcome, {session.user.user_metadata?.first_name || session.user.email?.split('@')[0]}
                </h1>
              }
              description={
                <p className="mt-2 text-slate-400 text-sm max-w-md">
                  {activeDoc
                    ? `Analyzing context from ${activeDoc.filename}...`
                    : "Ask questions about your uploaded documents."}
                </p>
              }
            />
          </div>

          {/* Chat Messages */}
          <div className="max-w-3xl mx-auto space-y-4">
            {(conversations[activeDoc?.id || 'global'] || []).map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold",
                  msg.role === 'ai' ? "bg-indigo-600" : "bg-slate-700"
                )}>
                  {msg.role === 'ai' ? 'AI' : 'U'}
                </div>
                <div className={cn(
                  "space-y-2 max-w-[70%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl",
                    msg.role === 'ai'
                      ? "bg-white/5 border border-white/10 text-slate-300"
                      : "bg-indigo-600 text-white"
                  )}>
                    <p className="leading-relaxed text-sm">
                      {msg.content}
                    </p>
                  </div>
                  {msg.role === 'ai' && idx === (conversations[activeDoc?.id || 'global'] || []).length - 1 && activeDoc && (
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
        <div className="p-4 md:p-6 max-w-4xl w-full mx-auto">
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
              placeholder={activeDoc ? `Ask about ${activeDoc.filename}...` : "Ask anything about your knowledge base..."}
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

        </div>
      </main>

      {/* Rename Dialog Modal */}
      {renamingDocId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setRenamingDocId(null);
            setNewDocName('');
          }}
        >
          <div
            className="bg-black/95 border border-white/20 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Rename Document</h3>
              <button
                onClick={() => {
                  setRenamingDocId(null);
                  setNewDocName('');
                }}
                className="p-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="docName" className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                  New Name
                </label>
                <input
                  id="docName"
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameDocument(renamingDocId);
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  placeholder="Enter new document name..."
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setRenamingDocId(null);
                    setNewDocName('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRenameDocument(renamingDocId)}
                  disabled={!newDocName.trim()}
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-black/95 border border-white/20 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {previewDoc.file_type === 'pdf' ? <FileText size={20} className="text-indigo-400" /> : <Table size={20} className="text-emerald-400" />}
                <h3 className="text-lg font-semibold text-white truncate max-w-md">{previewDoc.filename}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors mr-1"
                  title="Download / Open Original"
                >
                  <Download size={20} />
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white/5 relative overflow-hidden rounded-b-2xl">
              {previewDoc.file_type === 'pdf' ? (
                <iframe
                  src={previewDoc.file_url}
                  className="w-full h-full border-0"
                  title={previewDoc.filename}
                />
              ) : (['xlsx', 'xls', 'doc', 'docx', 'ppt', 'pptx'].includes((previewDoc.file_type || '').toLowerCase())) ? (
                <div className="w-full h-full bg-white relative">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewDoc.file_url)}`}
                    className="w-full h-full border-0"
                    title={previewDoc.filename}
                    onError={() => console.error("Failed to load Office Viewer")}
                  />
                </div>
                ) : (['csv'].includes((previewDoc.file_type || '').toLowerCase())) ? (
                  <div className="w-full h-full bg-white relative overflow-auto p-4">
                    {csvData ? (
                      <table className="min-w-full border-collapse border border-slate-200 text-sm text-slate-800">
                        <thead>
                          {csvData.length > 0 && (
                            <tr className="bg-slate-100 sticky top-0 border-b border-slate-300">
                              {csvData[0].map((header, i) => (
                                <th key={i} className="border border-slate-200 px-4 py-2 font-semibold text-left whitespace-nowrap bg-slate-100 sticky top-0 z-10">
                                  {header || `Col ${i + 1}`}
                                </th>
                              ))}
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {csvData.slice(1).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 border-b border-slate-100">
                              {row.map((cell, j) => (
                                <td key={j} className="border-r border-slate-200 px-4 py-2 whitespace-nowrap max-w-xs truncate" title={cell}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <p>Loading CSV Preview...</p>
                      </div>
                    )}
                  </div>
              ) : (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((previewDoc.file_type || '').toLowerCase())) ? (
                <div className="w-full h-full flex items-center justify-center p-4 bg-black/40">
                  <img
                    src={previewDoc.file_url}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              ) : (['txt', 'md', 'json', 'xml', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'sql', 'py', 'java', 'c', 'cpp'].includes((previewDoc.file_type || '').toLowerCase())) ? (
                <div className="w-full h-full bg-white">
                  <iframe
                    src={previewDoc.file_url}
                    className="w-full h-full border-0"
                    title={previewDoc.filename}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 p-8">
                  <Table size={48} className="text-slate-600" />
                  <p>Preview not available for this file type.</p>
                  <a
                    href={previewDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BetsyDashboard;
