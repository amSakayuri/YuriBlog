-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NovelStatus" AS ENUM ('DRAFT', 'ONGOING', 'COMPLETED', 'HIATUS');

-- CreateEnum
CREATE TYPE "ChapterRelationType" AS ENUM ('RELATED', 'REFERENCE', 'FORESHADOWING', 'PAYOFF', 'SAME_ARC', 'PARALLEL', 'FLASHBACK', 'ALTERNATE_PERSPECTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "translationKey" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "ogImage" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTag" (
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ArticleTag_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "Essay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "translationKey" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "ogImage" TEXT NOT NULL DEFAULT '',
    "copyright" TEXT NOT NULL DEFAULT '',
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Essay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EssayTag" (
    "essayId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "EssayTag_pkey" PRIMARY KEY ("essayId","tagId")
);

-- CreateTable
CREATE TABLE "Novel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "translationKey" TEXT,
    "status" "NovelStatus" NOT NULL DEFAULT 'DRAFT',
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Novel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelTag" (
    "novelId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "NovelTag_pkey" PRIMARY KEY ("novelId","tagId")
);

-- CreateTable
CREATE TABLE "NovelVolume" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NovelVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovelChapter" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "volumeId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovelChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterRelation" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "sourceChapterId" TEXT NOT NULL,
    "targetChapterId" TEXT NOT NULL,
    "type" "ChapterRelationType" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ChapterRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "translationKey" TEXT,
    "category" TEXT NOT NULL DEFAULT '',
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "githubUrl" TEXT NOT NULL DEFAULT '',
    "demoUrl" TEXT NOT NULL DEFAULT '',
    "projectStatus" TEXT NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "content" TEXT NOT NULL DEFAULT '',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavigationItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NavigationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "targetId" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Article_status_language_publishedAt_idx" ON "Article"("status", "language", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_language_slug_key" ON "Article"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Article_language_translationKey_key" ON "Article"("language", "translationKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "ArticleTag_tagId_idx" ON "ArticleTag"("tagId");

-- CreateIndex
CREATE INDEX "Essay_status_language_publishedAt_idx" ON "Essay"("status", "language", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Essay_language_slug_key" ON "Essay"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Essay_language_translationKey_key" ON "Essay"("language", "translationKey");

-- CreateIndex
CREATE INDEX "EssayTag_tagId_idx" ON "EssayTag"("tagId");

-- CreateIndex
CREATE INDEX "Novel_status_language_idx" ON "Novel"("status", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Novel_language_slug_key" ON "Novel"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Novel_language_translationKey_key" ON "Novel"("language", "translationKey");

-- CreateIndex
CREATE INDEX "NovelTag_tagId_idx" ON "NovelTag"("tagId");

-- CreateIndex
CREATE INDEX "NovelVolume_novelId_order_idx" ON "NovelVolume"("novelId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "NovelVolume_id_novelId_key" ON "NovelVolume"("id", "novelId");

-- CreateIndex
CREATE INDEX "NovelChapter_novelId_status_order_idx" ON "NovelChapter"("novelId", "status", "order");

-- CreateIndex
CREATE INDEX "NovelChapter_status_publishedAt_idx" ON "NovelChapter"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NovelChapter_novelId_slug_key" ON "NovelChapter"("novelId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NovelChapter_id_novelId_key" ON "NovelChapter"("id", "novelId");

-- CreateIndex
CREATE INDEX "ChapterRelation_targetChapterId_idx" ON "ChapterRelation"("targetChapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterRelation_sourceChapterId_targetChapterId_type_key" ON "ChapterRelation"("sourceChapterId", "targetChapterId", "type");

-- CreateIndex
CREATE INDEX "Project_status_order_idx" ON "Project"("status", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Project_language_slug_key" ON "Project"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_language_translationKey_key" ON "Project"("language", "translationKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storagePath_key" ON "MediaAsset"("storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "Page_language_slug_key" ON "Page"("language", "slug");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayTag" ADD CONSTRAINT "EssayTag_essayId_fkey" FOREIGN KEY ("essayId") REFERENCES "Essay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayTag" ADD CONSTRAINT "EssayTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelTag" ADD CONSTRAINT "NovelTag_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelTag" ADD CONSTRAINT "NovelTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelVolume" ADD CONSTRAINT "NovelVolume_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelChapter" ADD CONSTRAINT "NovelChapter_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovelChapter" ADD CONSTRAINT "NovelChapter_volumeId_novelId_fkey" FOREIGN KEY ("volumeId", "novelId") REFERENCES "NovelVolume"("id", "novelId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterRelation" ADD CONSTRAINT "ChapterRelation_sourceChapterId_novelId_fkey" FOREIGN KEY ("sourceChapterId", "novelId") REFERENCES "NovelChapter"("id", "novelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterRelation" ADD CONSTRAINT "ChapterRelation_targetChapterId_novelId_fkey" FOREIGN KEY ("targetChapterId", "novelId") REFERENCES "NovelChapter"("id", "novelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChapterRelation" ADD CONSTRAINT "ChapterRelation_no_self" CHECK ("sourceChapterId" <> "targetChapterId");
