'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText, Table, Search,
  UploadCloud, Send, ChevronRight, Loader2,
  PanelLeft, User, LogOut, MoreVertical, Trash2, Edit3, X, Download, Eye, Check,
  Folder, FolderPlus, ArrowLeft, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { Session } from '@supabase/supabase-js';
import Papa from 'papaparse';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Types for our documents
interface Doc {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  file_url: string;
  user_id: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
}

const BetsyDashboard = () => {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isViewingDocs, setIsViewingDocs] = useState(false);

  // Analyze CSV rows for color-coding sections
  const rowStyles = useMemo(() => {
    if (!csvData) return [];
    const styles = new Array(csvData.length).fill('hover:bg-slate-50');
    let currentSection = 'neutral'; // 'sales', 'commission', 'neutral'

    csvData.forEach((row, index) => {
        const rowText = row.join(' ').toLowerCase();
        
        // Detect Section Headers (Heuristic)
        if (rowText.includes('sales summary') || rowText.includes('gross sales') || rowText.includes('sales volume')) {
            currentSection = 'sales';
        } else if (rowText.includes('payment') || rowText.includes('commission') || rowText.includes('payout')) {
            currentSection = 'commission';
        }

        // Apply styles based on current section
        if (currentSection === 'sales') {
            styles[index] = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-100';
        } else if (currentSection === 'commission') {
            styles[index] = 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-100';
        } else {
            styles[index] = 'hover:bg-slate-50 border-slate-100';
        }
    });
    return styles;
  }, [csvData]);

  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [newProjectRename, setNewProjectRename] = useState('');


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

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      const projectsList = data || [];
      setProjects(projectsList);

      // Auto-select latest project if available and none selected
      if (projectsList.length > 0 && !activeProject) {
        const latestProject = projectsList[0];
        setActiveProject(latestProject);
        // Load documents for the project
        await fetchDocuments(latestProject.id);
        // Load conversation context for the project
        await createOrLoadConversation(latestProject);
      }
    }
  };

  const fetchDocuments = async (projectId?: string) => {
    // Only fetch if we have a project ID (strict isolation)
    if (!projectId) {
      setDocuments([]);
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching docs:', error);
    else setDocuments(data || []);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: newProjectName,
        user_id: session?.user?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      alert(`Failed to create project: ${error.message}`);
    } else {
      setProjects([data, ...projects]);
      setActiveProject(data);
      setIsCreatingProject(false);
      setNewProjectName('');
      // Selecting new project clears docs and loads context
      setDocuments([]);
      setActiveDoc(null);
      
      // Initialize conversation for the new project
      setMessages([]);
      await createOrLoadConversation(data);
    }
  };

  const createOrLoadConversation = async (project: Project | null = activeProject) => {
    try {
      if (!project) return null;

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;

      // Try to find existing conversation for this project
      const { data: existingConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', project.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingConversations && existingConversations.length > 0) {
        const conversationId = existingConversations[0].id;
        setCurrentConversationId(conversationId);
        await loadMessages(conversationId);
        return conversationId;
      } else {
        // Create a new conversation for this project
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            title: `${project.name} Chat`,
            user_id: userId,
            project_id: project.id
          })
          .select()
          .single();

        if (createError) {
          console.warn('Could not create conversation:', createError.message);
          return null;
        }

        setCurrentConversationId(newConversation.id);
        setMessages([]);
        return newConversation.id;
      }
    } catch (error) {
      console.warn('Conversation management not available yet:', error);
      return null;
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Could not load messages:', error.message);
      } else {
        setMessages(data || []);
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
          content
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
        // Initial Load
        fetchProjects();
        // Don't auto-fetch docs anymore, user must select project
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown menu when clicking outside
  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Close both document and project menus when clicking outside
      setOpenMenuDocId(null);
      setOpenMenuProjectId(null);
    };

    if (openMenuDocId || openMenuProjectId) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuDocId, openMenuProjectId]);


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
        storage_path: filePath,
        project_id: activeProject?.id
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

        if (!ingestResponse.ok) {
          const errorData = await ingestResponse.json();
          throw new Error(errorData.error || 'Ingestion failed');
        }

        console.log('Document processed successfully');
      } catch (err: any) {
        console.error('Error processing document:', err);
        let msg = 'AI processing failed.';
        if (err instanceof Error) msg = err.message;
        alert(`Upload warning: ${msg}`);
      }

      await fetchDocuments(activeProject?.id);

      // Automatically select the newly uploaded document
      if (insertedDoc) {
        handleDocumentClick(insertedDoc as Doc);
      }
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
    
    if (!activeProject) {
        setIsAiThinking(true);
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'ai', content: "Please create a project to start chatting, as there is no context available." }]);
            setIsAiThinking(false);
        }, 600);
        return;
    }

    // Ensure we have a conversation for this project
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createOrLoadConversation();
    }

    setIsAiThinking(true);

    // Save user message to database (if available)
    if (conversationId) {
      await saveMessage('user', currentInput, conversationId);
    }

    // Call API for semantic search across ALL documents in project
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('Sending message to API:', currentInput);
      console.log('Project ID:', activeProject.id);
      console.log('Auth token available:', !!session.access_token);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: currentInput,
          // GLOBAL WORKSPACE MODE: Search across ALL documents in project
          projectId: activeProject.id  // This enables cross-document synthesis
        }),

      });

      console.log('API Response status:', response.status);

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', response.status, data);
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      // Add AI response
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
      setIsAiThinking(false);

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

      setMessages(prev => [...prev, { role: 'ai', content: errorMsg }]);
      setIsAiThinking(false);

      // Save error message to database too (if available)
      if (conversationId) {
        await saveMessage('ai', errorMsg, conversationId);
      }
    }
  };

  const handleDocumentClick = async (doc: Doc) => {
    // Simply select the document - chat remains at project level
    setActiveDoc(doc);
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

  // Project Management Handlers
  const handleRenameProject = async (projectId: string) => {
    if (!newProjectRename.trim()) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: newProjectRename.trim() })
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(projects.map(p =>
        p.id === projectId ? { ...p, name: newProjectRename.trim() } : p
      ));

      if (activeProject?.id === projectId) {
        setActiveProject({ ...activeProject, name: newProjectRename.trim() });
      }

      setRenamingProjectId(null);
      setNewProjectRename('');
      setOpenMenuProjectId(null);
    } catch (error) {
      console.error('Error renaming project:', error);
      alert('Failed to rename project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? All documents and conversations will be permanently deleted.')) {
      return;
    }

    try {
      // 1. Get all documents in this project
      const { data: projectDocs, error: docsError } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', projectId);

      if (docsError) throw docsError;

      // 2. Delete all document chunks for these documents (No longer needed)
      if (projectDocs && projectDocs.length > 0) {
        const docIds = projectDocs.map(d => d.id);

        // 3. Delete all chat messages for these documents
        await supabase
          .from('chat_messages')
          .delete()
          .in('document_id', docIds);

        // 4. Delete all documents
        await supabase
          .from('documents')
          .delete()
          .eq('project_id', projectId);
      }

      // 5. Delete all conversations for this project
      await supabase
        .from('conversations')
        .delete()
        .eq('project_id', projectId);

      // 6. Delete the project itself
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (deleteError) throw deleteError;

      // 7. Update local state
      setProjects(projects.filter(p => p.id !== projectId));

      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setDocuments([]);
        setActiveDoc(null);
        setMessages([]);
        setCurrentConversationId(null);
      }

      setOpenMenuProjectId(null);
      console.log('Project and all associated data deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center text-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center text-slate-900 p-4">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-300">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
                B
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                {isSignUp ? 'Create an Account' : 'Welcome to Betsy'}
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <form onSubmit={handleAuth} className="space-y-4">
              {authError && (
                <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {authError}
                </div>
              )}

              <div className="space-y-4">
                {isSignUp && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">First Name</label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full rounded-md border-0 bg-slate-50 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Last Name</label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full rounded-md border-0 bg-slate-50 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border-0 bg-slate-50 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-3 transition-shadow"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border-0 bg-slate-50 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-3 transition-shadow"
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
                className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors"
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
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased overflow-hidden">

      {/* LEFT SIDEBAR: KNOWLEDGE BASE */}
      <aside className={cn(
        "border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
        "fixed inset-y-0 left-0 z-[60] h-full md:relative md:translate-x-0",
        isLeftSidebarOpen
          ? "w-72 translate-x-0 opacity-100 shadow-xl"
          : "-translate-x-full w-72 opacity-0 md:w-0 md:translate-x-0 md:opacity-0 md:border-0"
      )}>
        <div className="p-6 border-b border-slate-200 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">B</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Betsy AI</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {!isViewingDocs || !activeProject ? (
            // Project List View (Default)
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Your Projects</p>
                <button
                  onClick={() => setIsCreatingProject(true)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                  title="New Project"
                >
                  <FolderPlus size={16} />
                </button>
              </div>

              <div className="space-y-1">
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500 italic px-4 py-2">No projects yet. Create one to get started.</p>
                ) : (
                  projects.map(p => (
                    <div
                      key={p.id}
                      className="relative group"
                    >
                      {renamingProjectId === p.id ? (
                        // Rename Input
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-indigo-200">
                          <input
                            type="text"
                            value={newProjectRename}
                            onChange={(e) => setNewProjectRename(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameProject(p.id);
                              if (e.key === 'Escape') {
                                setRenamingProjectId(null);
                                setNewProjectRename('');
                              }
                            }}
                            className="flex-1 bg-transparent text-slate-900 text-sm outline-none"
                            placeholder="New project name"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameProject(p.id)}
                            className="p-1.5 hover:bg-emerald-500/20 rounded text-emerald-600"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setRenamingProjectId(null);
                              setNewProjectRename('');
                            }}
                            className="p-1.5 hover:bg-red-500/20 rounded text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        // Normal Project Item
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 text-slate-600 text-sm transition-all border border-transparent hover:border-slate-200">
                          <button
                            onClick={async () => {
                              // If this project is already active and we're clicking it again,
                              // maybe toggle the docs view or do nothing?
                              // For now, let's select it and stay on the list view (chat enabled).
                              if (activeProject?.id !== p.id) {
                                setActiveProject(p);
                                setDocuments([]);
                                setActiveDoc(null);
                                setMessages([]);
                                await fetchDocuments(p.id);
                                await createOrLoadConversation(p);
                              }
                              setIsViewingDocs(false); // Stay on list view
                            }}
                            className={cn(
                              "flex items-center gap-3 flex-1 min-w-0 text-left p-2 rounded-lg transition-colors group",
                              activeProject?.id === p.id 
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" 
                                : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                            )}
                          >
                            <div 
                              className={cn(
                                "flex-shrink-0 transition-colors p-1.5 rounded-lg",
                                activeProject?.id === p.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:text-indigo-500"
                              )}
                            >
                              <Folder size={16} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "block truncate font-medium text-sm",
                                activeProject?.id === p.id ? "text-indigo-900" : "text-slate-700"
                              )}>
                                {p.name}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                                {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Manage Files Button (Separate Hit Area) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProject(p);
                                if (activeProject?.id !== p.id) {
                                   setMessages([]);
                                   createOrLoadConversation(p);
                                }
                                fetchDocuments(p.id);
                                setIsViewingDocs(true);
                              }}
                              className="p-1.5 hover:bg-slate-200 rounded-md transition-all opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 flex-shrink-0"
                              title="Manage Files"
                            >
                                <ChevronRight size={14} />
                            </div>
                          </button>

                          {/* Three-dot Menu */}
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuProjectId(openMenuProjectId === p.id ? null : p.id);
                              }}
                              className={cn(
                                "p-1.5 hover:bg-slate-200 rounded-lg transition-colors",
                                openMenuProjectId === p.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              <MoreVertical size={14} className="text-slate-400" />
                            </button>

                            {openMenuProjectId === p.id && (
                              <div className="absolute right-0 top-8 z-30 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingProjectId(p.id);
                                    setNewProjectRename(p.name);
                                    setOpenMenuProjectId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                  <Edit3 size={12} className="text-indigo-600" />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProject(p.id);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Active Project View (Documents)
            <div className="space-y-4">
              <button
                onClick={() => {
                  setIsViewingDocs(false);
                  // Don't clear activeProject, just return to list
                }}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 px-2 mb-4 hover:bg-slate-100 py-1.5 rounded-lg transition-colors w-fit"
              >
                <ArrowLeft size={14} /> Back to Projects
              </button>

              <div className="px-3 py-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
                <div className="flex items-center gap-2 text-indigo-600 mb-1">
                  <Lock size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Active Project</span>
                </div>
                <h3 className="font-semibold text-slate-900 truncate text-sm">{activeProject.name}</h3>
              </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">Project Files</p>
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm group disabled:opacity-50 text-slate-600"
                  >
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                    ) : (
                      <UploadCloud size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
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
                      <>
                        {documents.map(doc => (
                          <div
                            key={doc.id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg transition-colors text-sm relative group",
                              "hover:bg-slate-100 text-slate-500",
                              openMenuDocId === doc.id && "z-20 bg-slate-100 ring-1 ring-slate-200"
                            )}
                          >
                            {/* Document Info (Non-clickable, just visual inventory) */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {doc.file_type === 'pdf' ? <FileText size={16} className="text-indigo-600" /> : <Table size={16} className="text-emerald-600" />}
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-slate-700 font-medium">{doc.filename}</span>
                                <span className="text-[10px] text-slate-400">
                                  {doc.file_type?.toUpperCase()} • {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                              {/* Preview Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewDocument(doc);
                                }}
                                className="p-2 rounded-md hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                                title="Preview Document"
                              >
                                <Eye size={16} />
                              </button>

                              {/* Three-dot menu button */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id);
                                  }}
                                  className="p-2 rounded-md hover:bg-white transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
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
                                        handlePreviewDocument(doc);
                                        setOpenMenuDocId(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                                    >
                                      <Eye size={12} className="text-blue-400" />
                                      Preview
                                    </button>
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
                          </div>
                        ))}
                    </>
                  )}
                </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white/[0.02]">

          {/* User Profile Section - Clickable Toggle */}

          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-full flex items-center gap-3 px-2 py-2 mb-1 rounded-xl hover:bg-slate-200 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
                {session?.user?.user_metadata?.first_name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
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
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <div className="p-1 space-y-0.5">

                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all text-xs group"
                    >
                      <LogOut size={14} className="group-hover:text-red-500 transition-colors" />
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
          className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsLeftSidebarOpen(false)}
        />
      )}

      {/* CENTER: SEMANTIC CHAT */}
      <main className="flex-1 flex flex-col bg-white relative">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <PanelLeft size={16} />
          </button>
        </div>


        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-14 md:p-8 space-y-8 scrollbar-hide">

          {/* Integrated Header (No 3D Scene) */}
          <div className="w-full max-w-4xl mx-auto mb-8 p-6 md:p-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-slate-200">
            <div className="relative z-10">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Welcome, {session.user.user_metadata?.first_name || session.user.email?.split('@')[0]}
              </h1>
              <p className="mt-2 text-slate-500 text-sm max-w-md">
                {activeProject
                  ? `Ask questions about all documents in "${activeProject.name}"`
                  : "Select a project to start chatting with your documents."}
              </p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold",
                  msg.role === 'ai' ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {msg.role === 'ai' ? 'AI' : (session?.user?.user_metadata?.first_name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || 'U')}
                </div>
                <div className={cn(
                  "space-y-2 max-w-[70%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl shadow-sm",
                    msg.role === 'ai'
                      ? "bg-white border border-slate-200 text-slate-800"
                      : "bg-indigo-600 text-white"
                  )}>
                    <div className="leading-relaxed text-sm [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:mb-2 last:[&>p]:mb-0 [&>strong]:font-bold [&>strong]:text-indigo-600 [&>table]:w-full [&>table]:border-collapse [&>th]:border-b [&>th]:border-slate-200 [&>th]:text-left [&>th]:p-2 [&>td]:p-2 [&>td]:border-b [&>td]:border-slate-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking Indicator */}
            {isAiThinking && (
              <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 flex-row">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold bg-indigo-600 text-white">
                  AI
                </div>
                <div className="items-start space-y-2 max-w-[70%]">
                  <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="italic">Betsy is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              placeholder={activeProject ? `Ask anything about "${activeProject.name}" documents...` : "Type a message..."}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 pr-14 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-lg text-slate-900 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            {/* Upload Button in Input */}
            <button
              onClick={() => chatFileInputRef.current?.click()}
              disabled={uploading}
              className="absolute left-3 top-2.5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              title="Upload Document"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-indigo-600" />
              ) : (
                <UploadCloud size={18} />
              )}
            </button>

            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className="absolute right-3 top-2.5 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:bg-slate-300 disabled:opacity-50"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>

        </div>
      </main>

      {/* Create Project Modal */}
      {isCreatingProject && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setIsCreatingProject(false);
            setNewProjectName('');
          }}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Create New Project</h3>
              <button
                onClick={() => {
                  setIsCreatingProject(false);
                  setNewProjectName('');
                }}
                className="p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="projectName" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Project Name
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateProject();
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  placeholder="e.g. Q1 Marketing Campaign"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsCreatingProject(false);
                    setNewProjectName('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Rename Document</h3>
              <button
                onClick={() => {
                  setRenamingDocId(null);
                  setNewDocName('');
                }}
                className="p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="docName" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
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
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                {previewDoc.file_type === 'pdf' ? <FileText size={20} className="text-indigo-600" /> : <Table size={20} className="text-emerald-600" />}
                <h3 className="text-lg font-semibold text-slate-900 truncate max-w-md">{previewDoc.filename}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors mr-1"
                  title="Download / Open Original"
                >
                  <Download size={20} />
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 relative overflow-hidden rounded-b-2xl">
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
                            <tr key={i} className={`border-b transition-colors ${rowStyles[i + 1] || 'hover:bg-slate-50 border-slate-100'}`}>
                              {row.map((cell, j) => (
                                <td key={j} className="border-r border-slate-200/50 px-4 py-2 whitespace-nowrap max-w-xs truncate" title={cell}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <p>Loading CSV Preview...</p>
                      </div>
                    )}
                  </div>
              ) : (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((previewDoc.file_type || '').toLowerCase())) ? (
                <div className="w-full h-full flex items-center justify-center p-4 bg-slate-100">
                  <img
                    src={previewDoc.file_url}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
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
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 p-8">
                  <Table size={48} className="text-slate-400" />
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
