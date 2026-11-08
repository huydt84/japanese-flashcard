CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);

CREATE TABLE IF NOT EXISTS auth.accounts (
  id bigserial PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type varchar(255) NOT NULL,
  provider varchar(255) NOT NULL,
  "providerAccountId" varchar(255) NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_subject_unique
  ON auth.accounts (provider, "providerAccountId");
CREATE INDEX IF NOT EXISTS auth_accounts_user_id ON auth.accounts ("userId");

CREATE TABLE IF NOT EXISTS auth.sessions (
  id bigserial PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  "sessionToken" varchar(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS auth.verification_token (
  identifier text NOT NULL,
  expires timestamptz NOT NULL,
  token text NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique
  ON auth.users (lower(email)) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    lower(trim(coalesce(NEW.email, ''))),
    NEW.name,
    NEW.image
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = coalesce(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = coalesce(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS kotoba_auth_user_profile_sync ON auth.users;
CREATE TRIGGER kotoba_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, name, image ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile();

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_auth_user_fk
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO auth.users (id, name, email, "emailVerified", image)
SELECT p.id, coalesce(p.display_name, p.email), p.email, now(), p.avatar_url
FROM public.profiles p
JOIN public.auth_identities i ON i.user_id = p.id
WHERE lower(i.provider) = 'google'
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.accounts ("userId", type, provider, "providerAccountId")
SELECT i.user_id, 'oauth', 'google', i.provider_id
FROM public.auth_identities i
WHERE lower(i.provider) = 'google'
ON CONFLICT (provider, "providerAccountId") DO NOTHING;

REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM PUBLIC;
