-- Clean Postgres baseline for local installs. Existing Neon data is adopted by
-- the migration runner after its complete table/column check.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('teacher', 'student', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.lesson_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.review_rating AS ENUM ('again', 'hard', 'good');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  role public.user_role,
  onboarding_completed_at timestamptz,
  active_mode text CHECK (active_mode IN ('teacher', 'student')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT normalized_profile_email CHECK (email = lower(trim(email)))
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (lower(email));

CREATE TABLE IF NOT EXISTS public.auth_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_id text NOT NULL,
  identity_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  UNIQUE (provider, provider_id)
);
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_identities FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 240),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_memberships (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.class_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT normalized_invitation_email CHECK (email = lower(trim(email)))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_invitation_per_class_email
  ON public.class_invitations (class_id, lower(email)) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  status public.lesson_status NOT NULL DEFAULT 'draft',
  position integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  kanji text NOT NULL CHECK (char_length(kanji) BETWEEN 1 AND 80),
  hiragana text NOT NULL CHECK (char_length(hiragana) BETWEEN 1 AND 120),
  meaning_vi text NOT NULL CHECK (char_length(meaning_vi) BETWEEN 1 AND 240),
  example_ja text NOT NULL CHECK (char_length(example_ja) BETWEEN 1 AND 500),
  example_vi text NOT NULL CHECK (char_length(example_vi) BETWEEN 1 AND 500),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.card_progress (
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  fsrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  last_review_at timestamptz,
  review_count integer NOT NULL DEFAULT 0,
  lapse_count integer NOT NULL DEFAULT 0,
  last_rating public.review_rating,
  good_streak smallint NOT NULL DEFAULT 0 CHECK (good_streak BETWEEN 0 AND 4),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, card_id)
);

CREATE TABLE IF NOT EXISTS public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  rating public.review_rating NOT NULL,
  state_before jsonb NOT NULL,
  state_after jsonb NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS review_logs_student_card_time
  ON public.review_logs (student_id, card_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('class_invitation')),
  invitation_id uuid REFERENCES public.class_invitations(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_notification_per_invitation
  ON public.notifications (invitation_id) WHERE invitation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lessons_class_id ON public.lessons (class_id);
CREATE INDEX IF NOT EXISTS cards_lesson_id ON public.cards (lesson_id);
CREATE INDEX IF NOT EXISTS card_progress_card_id ON public.card_progress (card_id);
CREATE INDEX IF NOT EXISTS review_logs_card_id_active
  ON public.review_logs (card_id) WHERE undone_at IS NULL;
