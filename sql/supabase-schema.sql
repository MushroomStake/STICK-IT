-- Supabase table schema for orders and order_files
-- Run these statements in the Supabase SQL editor (or adjust to your naming conventions).

-- enable pgcrypto for gen_random_uuid (run once per DB)
-- create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  qr_code text unique not null,
  full_name text not null,
  phone_number text,
  deal_id text,
  deal_title text,
  total_price numeric,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists order_files (
  id bigserial primary key,
  order_id uuid references orders(id) on delete cascade,
  file_url text,
  file_name text,
  quantity integer default 1,
  remove_background boolean default false,
  border boolean default false,
  created_at timestamptz default now()
);

-- Admin profiles: stores basic admin metadata
create table if not exists admin_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  email text unique not null,
  first_name text,
  middle_name text,
  last_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
