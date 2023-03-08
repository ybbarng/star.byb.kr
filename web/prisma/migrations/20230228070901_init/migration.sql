-- CreateTable
CREATE TABLE "AddTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parameter1" INTEGER NOT NULL,
    "parameter2" INTEGER NOT NULL,
    "result" INTEGER
);
