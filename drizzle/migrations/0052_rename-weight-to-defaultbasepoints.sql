ALTER TABLE Pillar RENAME COLUMN weight TO defaultBasePoints;
UPDATE Pillar SET defaultBasePoints = 10 WHERE defaultBasePoints = 0;
