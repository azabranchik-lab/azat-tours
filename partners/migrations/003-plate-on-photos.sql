-- Partner's choice for the plate on front/back photos (SPEC §6.4): hide it himself,
-- ask AZAT TOURS to blur it, or allow it to be shown.
ALTER TABLE cars ADD COLUMN plateOnPhotos TEXT CHECK (plateOnPhotos IN ('HIDE', 'BLUR', 'SHOW'));
