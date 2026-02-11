

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


