-- Run only after the signed review projection has been deployed and smoke-tested.
-- The old public review page selected complete entry rows by guessable ID.
DROP POLICY IF EXISTS "Anon users can view entries via review link" ON public.entries;
