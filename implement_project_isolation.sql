

-- 1. Create Projects Table (The Core of Isolation)
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Projects
alter table projects enable row level security;

-- Policies for Projects (Drop first to allow re-run)
drop policy if exists "Users can view their own projects" on projects;
create policy "Users can view their own projects" on projects for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own projects" on projects;
create policy "Users can insert their own projects" on projects for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own projects" on projects;
create policy "Users can update their own projects" on projects for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own projects" on projects;
create policy "Users can delete their own projects" on projects for delete using (auth.uid() = user_id);

-- Explicitly Grant Permissions (Fixes 404/Visibility issues)
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on projects to service_role;


-- 2. Create Documents Table (was missing)
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  filename text not null,
  file_type text not null,
  file_url text not null,
  storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  project_id uuid references projects(id) on delete cascade
);

-- Enable RLS on Documents
alter table documents enable row level security;

drop policy if exists "Users can manage their own documents" on documents;
create policy "Users can manage their own documents" on documents for all using (auth.uid() = user_id);




-- 4. Create Conversations & Messages Tables
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  project_id uuid references projects(id) on delete cascade
);

create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Chat
alter table conversations enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "Users own conversations" on conversations;
create policy "Users own conversations" on conversations for all using (auth.uid() = user_id);

drop policy if exists "Users own messages" on chat_messages;
create policy "Users own messages" on chat_messages for all using (
  conversation_id in (select id from conversations where user_id = auth.uid())
);


-- 5. Helper Tables (from Dashboard code)
create table if not exists files_raw (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  file_name text,
  file_url text,
  file_type text,
  storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table files_raw enable row level security;

drop policy if exists "Users own raw files" on files_raw;
create policy "Users own raw files" on files_raw for all using (auth.uid() = user_id);


-- 6. Update Existing Tables (in case they existed but missed columns)
-- Link Documents to Projects (idempotent)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'documents' and column_name = 'project_id') then
    alter table documents add column project_id uuid references projects(id) on delete cascade;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'conversations' and column_name = 'project_id') then
    alter table conversations add column project_id uuid references projects(id) on delete cascade;
  end if;
end $$;


-- 7. Define match_documents function (Project-Aware)


-- 8. FORCE API SCHEMA CACHE RELOAD (Fixes "Could not find the table" error)
NOTIFY pgrst, 'reload config';
