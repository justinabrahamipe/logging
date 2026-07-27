CREATE TABLE IF NOT EXISTS "LocationLog" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "userId" text NOT NULL,
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "date" text NOT NULL,
  "notes" text,
  "createdAt" integer DEFAULT (unixepoch()) NOT NULL,
  "updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);
