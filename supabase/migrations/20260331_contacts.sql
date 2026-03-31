-- Google Contacts cache (People API)
-- Stores synced contacts for typeahead and birthday/anniversary auto-creation

create table if not exists myday_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  google_resource_name text not null,
  name text,
  email text,
  phone text,
  birthday date,
  anniversary date,
  photo_url text,
  organization text,
  notes text,
  leo_tags text[],
  last_synced timestamptz,
  unique(user_id, google_resource_name)
);

alter table myday_contacts enable row level security;

create policy "Users can manage own contacts"
  on myday_contacts for all
  using (auth.uid() = user_id);
