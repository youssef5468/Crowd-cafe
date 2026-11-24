ALTER TABLE "branches"
  ALTER COLUMN "phone" DROP NOT NULL,
  ALTER COLUMN "lat" DROP NOT NULL,
  ALTER COLUMN "lng" DROP NOT NULL,
  ADD CONSTRAINT "branches_coordinate_pair" CHECK (("lat" IS NULL) = ("lng" IS NULL));
