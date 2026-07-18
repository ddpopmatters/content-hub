BEGIN;

-- Simulate an approval which predates the revision migration.
ALTER TABLE public.entries DISABLE TRIGGER maintain_entry_publication_revision;
INSERT INTO public.entries (
  id,
  date,
  caption,
  workflow_status,
  status,
  approved_at,
  content_revision,
  approved_revision
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '2026-07-17',
  'Legacy approved caption',
  'Approved',
  'Approved',
  '2026-07-17T09:00:00.000Z',
  1,
  NULL
);
ALTER TABLE public.entries ENABLE TRIGGER maintain_entry_publication_revision;

-- Unrelated changes must not legitimise a legacy, unbound approval.
UPDATE public.entries
SET updated_at = '2026-07-17T10:00:00.000Z'
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  entry public.entries%ROWTYPE;
BEGIN
  SELECT * INTO entry
  FROM public.entries
  WHERE id = '00000000-0000-0000-0000-000000000001';

  IF entry.content_revision <> 1 OR entry.approved_revision IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy approval was bound without re-approval';
  END IF;
END;
$$;

-- A real re-approval binds the exact current revision.
UPDATE public.entries
SET workflow_status = 'In Review', status = 'Pending', approved_at = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.entries
SET
  workflow_status = 'Approved',
  status = 'Approved',
  approved_at = '2026-07-17T11:00:00.000Z'
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  entry public.entries%ROWTYPE;
BEGIN
  SELECT * INTO entry
  FROM public.entries
  WHERE id = '00000000-0000-0000-0000-000000000001';

  IF entry.content_revision <> 1 OR entry.approved_revision <> 1 THEN
    RAISE EXCEPTION 'Re-approval did not bind the current revision';
  END IF;
END;
$$;

-- Content changes increment once, ignore client revision values and revoke approval.
UPDATE public.entries
SET
  caption = 'Edited after approval',
  workflow_status = 'Approved',
  status = 'Approved',
  approved_at = '2026-07-17T12:00:00.000Z',
  content_revision = 999,
  approved_revision = 999
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  entry public.entries%ROWTYPE;
BEGIN
  SELECT * INTO entry
  FROM public.entries
  WHERE id = '00000000-0000-0000-0000-000000000001';

  IF
    entry.content_revision <> 2
    OR entry.approved_revision IS NOT NULL
    OR entry.approved_at IS NOT NULL
    OR entry.workflow_status <> 'In Review'
    OR entry.status <> 'Pending'
  THEN
    RAISE EXCEPTION 'Content edit did not increment and revoke approval safely';
  END IF;
END;
$$;

-- Newly inserted approved content binds revision one, while publication preserves it.
INSERT INTO public.entries (
  id,
  date,
  caption,
  workflow_status,
  status,
  approved_at,
  content_revision,
  approved_revision
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '2026-07-17',
  'New approved caption',
  'Approved',
  'Approved',
  '2026-07-17T13:00:00.000Z',
  999,
  999
);

UPDATE public.entries
SET workflow_status = 'Published', updated_at = '2026-07-17T14:00:00.000Z'
WHERE id = '00000000-0000-0000-0000-000000000002';

DO $$
DECLARE
  entry public.entries%ROWTYPE;
BEGIN
  SELECT * INTO entry
  FROM public.entries
  WHERE id = '00000000-0000-0000-0000-000000000002';

  IF entry.content_revision <> 1 OR entry.approved_revision <> 1 THEN
    RAISE EXCEPTION 'Published entry did not retain its approved revision';
  END IF;
END;
$$;

ROLLBACK;
