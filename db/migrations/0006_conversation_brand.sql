-- Active brand of the conversation (specs/003-brand-kit-no-chat): set by an @ mention or by the
-- agent's set_active_brand tool. A deleted brand clears it.
alter table conversations add column brand_id uuid references brands (id) on delete set null;
