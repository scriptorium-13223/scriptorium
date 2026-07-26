-- ============================================================
-- Scriptorium Database Schema (Supabase Free Plan)
-- NO auth tables, NO user tables, NO sessions.
-- Orders are transient: deleted entirely once marked "delivered"
-- by the admin, to keep the free-tier database near-empty.
-- Telegram is the permanent order record.
-- ============================================================

-- Enable UUID generation (Supabase has this available by default via pgcrypto)
create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique, -- human-friendly, e.g. SCR-20260726-XXXX

  -- Assignment details
  assignment_type text not null check (assignment_type in ('handwritten', 'typed')),
  paper_type text not null,
  delivery_option text not null check (delivery_option in ('2-3', '3-5', '5-7')),
  cover_option text not null default 'none',
  addons jsonb not null default '[]'::jsonb,       -- array of addon keys
  customer_note text default '',

  -- File & page count (auto-detected, never customer-editable)
  file_path text not null,        -- path within Supabase Storage bucket
  file_name text not null,
  file_mime text not null,
  page_count integer not null,

  -- Pricing (computed & stored server-side only — never trust client)
  price_breakdown jsonb not null, -- itemized: base, materials, addons, coupon
  coupon_code text,
  final_amount numeric(10, 2) not null,

  -- Shipping address
  customer_name text not null,
  phone_number text not null,
  alternate_number text,
  address_line text not null,
  city text not null,
  state text not null,
  pin_code text not null,
  landmark text,

  -- Order lifecycle
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered')),
  payment_method text not null default 'cod',

  created_at timestamptz not null default now()
);

create index if not exists idx_orders_status on orders (status);
create index if not exists idx_orders_created_at on orders (created_at);

-- Coupons table - small, backend-validated only, never trust client-supplied discount amounts
create table if not exists coupons (
  code text primary key,
  type text not null check (type in ('flat', 'percentage')),
  value numeric(10, 2) not null,
  active boolean not null default true,
  max_uses integer,             -- null = unlimited
  used_count integer not null default 0,
  expires_at timestamptz,       -- null = never expires
  created_at timestamptz not null default now()
);

-- Sample coupons (optional - remove/edit as needed)
insert into coupons (code, type, value, active) values
  ('WELCOME10', 'percentage', 10, true),
  ('FLAT50', 'flat', 50, true)
on conflict (code) do nothing;

-- Atomic increment for coupon usage (avoids race conditions vs. read-then-write)
create or replace function increment_coupon_usage(coupon_code text)
returns void as $$
begin
  update coupons
  set used_count = used_count + 1
  where code = upper(trim(coupon_code));
end;
$$ language plpgsql;

-- ============================================================
-- Supabase Storage: create a bucket named 'assignment-uploads'
-- via Dashboard > Storage > New Bucket (private, not public).
-- Files are pushed here temporarily, forwarded to Telegram, and
-- deleted the moment admin marks the order 'delivered'.
-- ============================================================
