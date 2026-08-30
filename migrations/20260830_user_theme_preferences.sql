-- Per-user visual preference for VIMS Day / Night / Auto mode.
-- Safe to apply repeatedly.

create table if not exists user_theme_preferences (
  user_id varchar(36) primary key references users(id) on delete cascade,
  theme_mode varchar(10) not null default 'system'
    check (theme_mode in ('light', 'dark', 'system')),
  updated_at timestamp not null default now()
);
