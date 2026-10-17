-- 2026-10-17: driver requirements, long-term discount and restrictions are asked as one
-- answer, «Условия аренды», stored in `restrictions`. Earlier answers are moved there so
-- nothing typed before is lost; the two old columns stay unused.
UPDATE cars SET restrictions = TRIM(
  COALESCE('Требования к водителю: ' || driverRequirements || '. ', '') ||
  COALESCE('Скидка: ' || longTermDiscount || '. ', '') ||
  COALESCE(restrictions, ''))
WHERE driverRequirements IS NOT NULL OR longTermDiscount IS NOT NULL;
UPDATE cars SET driverRequirements = NULL, longTermDiscount = NULL;
