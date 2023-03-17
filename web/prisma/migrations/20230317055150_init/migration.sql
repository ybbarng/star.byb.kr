-- CreateTable
CREATE TABLE "PlateSolvingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultAt" DATETIME,
    "request" TEXT NOT NULL,
    "response" TEXT
);
