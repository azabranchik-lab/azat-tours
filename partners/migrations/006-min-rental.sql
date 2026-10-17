-- 2026-10-17: minimum rental period in days, asked on the «Страховка, доставка и срок» screen.
ALTER TABLE cars ADD COLUMN minRentalDays INTEGER;
