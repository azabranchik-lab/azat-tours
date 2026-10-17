-- Every summary, moderation card and photo upload reads a car's photos by carId. The
-- only index on car_photos is partial (angle <> 'EXTRA'), which SQLite cannot use for
-- that, so each read scanned the whole table. Since 2026-10-17 all new photos are EXTRA.
CREATE INDEX car_photos_car ON car_photos(carId, sortOrder);
