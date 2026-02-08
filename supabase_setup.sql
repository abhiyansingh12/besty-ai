-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a private bucket for documents
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Enable RLS (Row Level Security) for storage
-- We use DO blocks to avoid errors if policies already exist
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can upload documents 1kqi81_0') then
    create policy "Authenticated users can upload documents 1kqi81_0" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
  end if;
  
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can read their own documents 1kqi81_1') then
    create policy "Authenticated users can read their own documents 1kqi81_1" on storage.objects for select to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
  end if;
end $$;

-- Create a table for document metadata
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  filename text not null,
  file_url text not null, -- Supabase Storage URL
  file_type text not null, -- 'pdf', 'csv', 'xlsx', etc.
  created_at timestamptz default now()
);

-- Enable RLS for documents table
alter table public.documents enable row level security;

-- Policy for viewing documents
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view their own documents') then
    create policy "Users can view their own documents" on public.documents for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can insert their own documents') then
    create policy "Users can insert their own documents" on public.documents for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Create a table for document chunks (for semantic search)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at timestamptz default now()
);

-- Enable RLS for chunks
alter table public.document_chunks enable row level security;

-- Policy for viewing chunks
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view their own document chunks') then
    create policy "Users can view their own document chunks" on public.document_chunks
      for select using (exists (
        select 1 from public.documents
        where public.documents.id = public.document_chunks.document_id
        and public.documents.user_id = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can insert their own document chunks') then
    create policy "Users can insert their own document chunks" on public.document_chunks
      for insert with check (exists (
        select 1 from public.documents
        where public.documents.id = public.document_chunks.document_id
        and public.documents.user_id = auth.uid()
      ));
  end if;
end $$;

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  join documents on documents.id = document_chunks.document_id
  where documents.user_id = auth.uid()
  and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  and (filter_document_id is null or document_chunks.document_id = filter_document_id)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
