-- Create enum types
create type public.role_enum as enum ('admin', 'manager', 'staff');
create type public.order_stage_enum as enum ('intake', 'assign_site', 'processing', 'dispatch', 'fitting', 'closed');
create type public.site_enum as enum ('naka', 'godown');

-- Create orders table
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint unique not null,
  stage order_stage_enum not null default 'intake',
  customer_name text not null,
  phone text,
  address text,
  city text,
  order_date date not null default current_date,
  estimated_duration integer,
  total_amount decimal(10,2),
  advance_amount decimal(10,2),
  freight_amount decimal(10,2),
  notes text,
  assign_site site_enum,
  processing_site site_enum,
  files jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create sequence for order numbers starting at 1000000000
create sequence public.orders_order_number_seq start with 1000000000;
alter table public.orders alter column order_number set default nextval('orders_order_number_seq');

-- Create index for order lookups
create index orders_order_number_idx on public.orders (order_number);
create index orders_stage_idx on public.orders (stage);
create index orders_customer_name_idx on public.orders (customer_name);
create index orders_city_idx on public.orders (city);
create index orders_order_date_idx on public.orders (order_date);

-- Create profiles table
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role role_enum not null default 'manager',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index profiles_email_idx on public.profiles (email);
create index profiles_role_idx on public.profiles (role);

-- Trigger to keep updated_at fresh for profiles
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at_tg
before update on public.profiles
for each row execute function set_updated_at();

-- Trigger to keep updated_at fresh for orders
create trigger orders_updated_at_tg
before update on public.orders
for each row execute function set_updated_at();

-- Security definer function to check if user has a specific role
-- This prevents RLS recursion issues
create or replace function public.has_role(_user_id uuid, _role role_enum)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = _user_id
      and role = _role
  );
$$;

-- Security definer function to check if user is admin
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = _user_id
      and role = 'admin'
  );
$$;

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS policies
-- Users can read their own profile
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

-- Admins can read all profiles
create policy "admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Admins can insert profiles (for user creation)
create policy "admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.is_admin(auth.uid()));

-- Admins can update all profiles
create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Admins can delete profiles
create policy "admins can delete profiles"
on public.profiles
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Enable RLS on orders
alter table public.orders enable row level security;

-- Orders RLS policies
-- Any authenticated user can select orders
create policy "authenticated users can read orders"
on public.orders
for select
to authenticated
using (true);

-- Any authenticated user can insert orders
create policy "authenticated users can insert orders"
on public.orders
for insert
to authenticated
with check (true);

-- Any authenticated user can update orders
create policy "authenticated users can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

-- Only admins can delete orders
create policy "only admins can delete orders"
on public.orders
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Function to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::role_enum, 'manager')
  );
  return new;
end;
$$;

-- Trigger to create profile on user creation
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();