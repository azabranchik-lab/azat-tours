-- Where the partner stopped in the add-car wizard, so "Продолжить" resumes exactly there
-- even after the dialog state was cleared (menu tap, /start).
ALTER TABLE cars ADD COLUMN draftStep TEXT;
