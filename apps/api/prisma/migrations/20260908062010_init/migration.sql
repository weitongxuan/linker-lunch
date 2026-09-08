-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER,
    "service" TEXT NOT NULL,
    "hours" TEXT NOT NULL,
    "hoursUnknown" BOOLEAN NOT NULL DEFAULT false,
    "addr" TEXT,
    "phone" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "hoursSource" TEXT,
    "hoursRaw" TEXT,
    "googleRating" REAL,
    "googleReviews" INTEGER,
    "walkMin" INTEGER,
    "driveMin" INTEGER,
    "ownParking" BOOLEAN,
    "peakFrom" TEXT,
    "peakTo" TEXT,
    "peakNote" TEXT,
    "closedNote" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AfterPlace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "kind" TEXT NOT NULL,
    "price" INTEGER,
    "hours" TEXT NOT NULL,
    "hoursUnknown" BOOLEAN NOT NULL DEFAULT false,
    "addr" TEXT,
    "phone" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "hoursSource" TEXT,
    "hoursRaw" TEXT,
    "googleRating" REAL,
    "googleReviews" INTEGER,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Parking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "kind" TEXT NOT NULL,
    "rate" TEXT NOT NULL DEFAULT '',
    "searchMin" INTEGER NOT NULL,
    "spaces" INTEGER
);

-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "officeLat" REAL NOT NULL,
    "officeLng" REAL NOT NULL,
    "officeName" TEXT NOT NULL,
    "departStart" TEXT NOT NULL,
    "departEnd" TEXT NOT NULL,
    "backBy" TEXT NOT NULL,
    "eatMinutes" INTEGER NOT NULL,
    "priceBands" TEXT NOT NULL,
    "walkSpeed" INTEGER NOT NULL,
    "detour" REAL NOT NULL,
    "maxWalkMin" INTEGER NOT NULL,
    "driveSpeed" INTEGER NOT NULL,
    "parkSearch" INTEGER NOT NULL,
    "streetSearch" INTEGER NOT NULL,
    "driveWorthIt" INTEGER NOT NULL,
    "maxDriveMin" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Market" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "close" REAL NOT NULL,
    "pct" REAL NOT NULL,
    "src" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Menu" (
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("placeId", "placeType")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaderName" TEXT NOT NULL,
    "sizeKb" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vote" (
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("placeId", "placeType", "personName")
);

-- CreateTable
CREATE TABLE "TempClosed" (
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reportedBy" TEXT,

    PRIMARY KEY ("placeId", "placeType", "date")
);

-- CreateTable
CREATE TABLE "EatenLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Note" (
    "placeId" TEXT NOT NULL,
    "placeType" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("placeId", "placeType", "personName")
);

-- CreateIndex
CREATE INDEX "AfterPlace_placeType_idx" ON "AfterPlace"("placeType");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_placeId_placeType_personName_key" ON "Rating"("placeId", "placeType", "personName");

-- CreateIndex
CREATE INDEX "Photo_placeId_placeType_idx" ON "Photo"("placeId", "placeType");

-- CreateIndex
CREATE INDEX "EatenLog_placeId_placeType_personName_idx" ON "EatenLog"("placeId", "placeType", "personName");
