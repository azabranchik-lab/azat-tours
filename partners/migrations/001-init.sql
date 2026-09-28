-- Car partners: full schema from docs/car-partners/SPEC.md §4.
-- Dates are ISO strings, enums are TEXT with CHECK, arrays/objects are JSON TEXT.

CREATE TABLE partners (
  id              TEXT PRIMARY KEY,
  telegramId      INTEGER NOT NULL UNIQUE,
  username        TEXT,
  lang            TEXT NOT NULL DEFAULT 'RU' CHECK (lang IN ('RU', 'KY')),
  -- name/phone/city stay NULL until the partner fills them in during registration;
  -- a partner counts as registered once offerAcceptedAt is set.
  name            TEXT,
  phone           TEXT,
  city            TEXT,
  offerAcceptedAt TEXT,
  offerVersion    TEXT,
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED')),
  state           TEXT,
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL
);

CREATE TABLE cars (
  id                 TEXT PRIMARY KEY,
  partnerId          TEXT NOT NULL REFERENCES partners(id),
  status             TEXT NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'ARCHIVED')),
  availability       TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability IN ('AVAILABLE', 'BUSY')),
  make               TEXT,
  model              TEXT,
  year               INTEGER,
  bodyType           TEXT CHECK (bodyType IN ('SEDAN', 'SUV', 'CROSSOVER', 'MINIVAN', 'MINIBUS', 'PICKUP', 'OTHER')),
  transmission       TEXT CHECK (transmission IN ('AUTOMATIC', 'MANUAL')),
  drive              TEXT CHECK (drive IN ('AWD', 'FWD', 'RWD')),
  fuel               TEXT CHECK (fuel IN ('PETROL', 'DIESEL', 'GAS_PETROL', 'HYBRID', 'ELECTRIC')),
  seats              INTEGER,
  color              TEXT,
  plateNumber        TEXT,
  mileageKm          INTEGER,
  features           TEXT NOT NULL DEFAULT '[]',
  description        TEXT,
  rentalModes        TEXT NOT NULL DEFAULT '[]',
  priceSelfDrive     INTEGER,
  priceWithDriver    INTEGER,
  longTermDiscount   TEXT,
  deposit            INTEGER,
  insurance          TEXT CHECK (insurance IN ('OSAGO', 'KASKO', 'NONE')),
  delivery           TEXT CHECK (delivery IN ('FREE', 'PAID', 'NO')),
  driverRequirements TEXT,
  restrictions       TEXT,
  availabilityNote   TEXT,
  city               TEXT,
  en                 TEXT,
  rejectReason       TEXT,
  copiedFromId       TEXT,
  submittedAt        TEXT,
  approvedAt         TEXT,
  createdAt          TEXT NOT NULL,
  updatedAt          TEXT NOT NULL
);
CREATE INDEX cars_partner ON cars(partnerId);
CREATE INDEX cars_status ON cars(status);

CREATE TABLE car_photos (
  id                   TEXT PRIMARY KEY,
  carId                TEXT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  angle                TEXT NOT NULL CHECK (angle IN ('FRONT', 'BACK', 'LEFT', 'RIGHT', 'INTERIOR_FRONT',
                                                     'INTERIOR_BACK', 'TRUNK', 'DASHBOARD', 'EXTRA')),
  telegramFileId       TEXT NOT NULL,
  telegramFileUniqueId TEXT NOT NULL,
  path                 TEXT NOT NULL,
  thumbPath            TEXT NOT NULL,
  width                INTEGER NOT NULL,
  height               INTEGER NOT NULL,
  sortOrder            INTEGER NOT NULL DEFAULT 0,
  createdAt            TEXT NOT NULL
);
-- One photo per angle, except EXTRA (the 5-photo cap is enforced in code).
CREATE UNIQUE INDEX car_photos_angle ON car_photos(carId, angle) WHERE angle <> 'EXTRA';

CREATE TABLE moderation_log (
  id              TEXT PRIMARY KEY,
  carId           TEXT NOT NULL REFERENCES cars(id),
  adminTelegramId INTEGER NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'PUBLISH')),
  comment         TEXT,
  createdAt       TEXT NOT NULL
);
