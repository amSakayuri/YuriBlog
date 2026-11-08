ALTER TABLE "User" ADD COLUMN "username" TEXT;
UPDATE "User" SET "username" = 'user_' || "id";
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "RepositoryState" (
  "id" TEXT NOT NULL DEFAULT 'content' PRIMARY KEY,
  "localHash" TEXT,
  "remoteCommit" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
