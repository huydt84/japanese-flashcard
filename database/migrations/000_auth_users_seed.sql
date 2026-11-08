CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);

INSERT INTO auth.users (id, name, email, "emailVerified", image)
SELECT p.id, coalesce(p.display_name, p.email), p.email, now(), p.avatar_url
FROM public.profiles p
JOIN public.auth_identities i ON i.user_id = p.id
WHERE lower(i.provider) = 'google'
ON CONFLICT (id) DO NOTHING;
