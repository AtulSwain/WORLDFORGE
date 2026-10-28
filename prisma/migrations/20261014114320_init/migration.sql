-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('HIGH_FANTASY', 'DARK_FANTASY', 'SCIENCE_FICTION', 'POST_APOCALYPTIC', 'HISTORICAL_FICTION', 'MYTHOLOGY', 'SUPERHERO', 'HORROR', 'CONTEMPORARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CanonStatus" AS ENUM ('CANON', 'DRAFT', 'DISPUTED', 'NON_CANON');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TimelineStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CHARACTER', 'FACTION', 'LOCATION', 'ARTIFACT', 'SPECIES', 'CREATURE', 'CULTURE', 'RELIGION', 'LANGUAGE', 'TECHNOLOGY', 'MAGIC_SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('DAY', 'MONTH', 'YEAR', 'CIRCA', 'DECADE', 'CENTURY', 'ERA');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('PROTAGONIST', 'ANTAGONIST', 'VICTIM', 'INSTIGATOR', 'WITNESS', 'COMMANDER', 'ALLY', 'OBSERVER', 'SIGNATORY', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('CAUSES', 'ENABLES', 'PREVENTS', 'PRECEDES', 'CONTRIBUTES_TO');

-- CreateEnum
CREATE TYPE "ChangeTargetType" AS ENUM ('ENTITY', 'EVENT', 'RELATIONSHIP');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'ANALYZED', 'COMMITTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ImpactBasis" AS ENUM ('PRIMARY_CHANGE', 'EXPLICIT_DEPENDENCY', 'DETERMINISTIC_RULE', 'EXISTING_RELATIONSHIP', 'AI_INFERENCE', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "directoryView" TEXT NOT NULL DEFAULT 'grid',
    "onboardingDraft" JSONB,
    "lastUniverseId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Universe" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "genre" "Genre" NOT NULL DEFAULT 'HIGH_FANTASY',
    "customGenre" TEXT,
    "tone" TEXT,
    "mainConflict" TEXT,
    "timePeriod" TEXT,
    "coreRules" TEXT,
    "coverImage" TEXT,
    "currentEra" TEXT,
    "defaultTimelineId" TEXT,
    "calendar" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniverseMember" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniverseMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timeline" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "branchEventId" TEXT,
    "status" "TimelineStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "customTypeLabel" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "beginYear" INTEGER,
    "endYear" INTEGER,
    "portrait" TEXT,
    "attributes" JSONB NOT NULL,
    "canonStatus" "CanonStatus" NOT NULL DEFAULT 'CANON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipTypeDef" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "inverse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipTypeDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "validFromYear" INTEGER,
    "validToYear" INTEGER,
    "originEventId" TEXT,
    "endEventId" TEXT,
    "canonStatus" "CanonStatus" NOT NULL DEFAULT 'CANON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalEvent" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT 'OTHER',
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER,
    "startDay" INTEGER,
    "endYear" INTEGER,
    "endMonth" INTEGER,
    "endDay" INTEGER,
    "precision" "DatePrecision" NOT NULL DEFAULT 'YEAR',
    "startOrdinal" INTEGER NOT NULL,
    "endOrdinal" INTEGER,
    "displayDate" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "locationId" TEXT,
    "canonStatus" "CanonStatus" NOT NULL DEFAULT 'CANON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDependency" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineChange" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "proposalId" TEXT,
    "targetType" "ChangeTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "previousState" JSONB,
    "proposedState" JSONB,
    "appliedToBase" BOOLEAN NOT NULL DEFAULT false,
    "sourceEventId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "ChangeStatus" NOT NULL DEFAULT 'ACCEPTED',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "TimelineChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT,
    "timelineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "patch" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "analyzedVersion" INTEGER,
    "sourceVersion" INTEGER,
    "report" JSONB,
    "committedTimelineId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basis" "ImpactBasis" NOT NULL,
    "strength" TEXT NOT NULL,
    "affected" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "suggestedChange" JSONB,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ImpactItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoreDocument" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'HISTORY',
    "tags" TEXT[],
    "canonStatus" "CanonStatus" NOT NULL DEFAULT 'CANON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoreDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoreLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityId" TEXT,
    "eventId" TEXT,

    CONSTRAINT "LoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldMap" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mapType" TEXT NOT NULL DEFAULT 'IMAGE',
    "coordinateSystem" TEXT NOT NULL DEFAULT 'IMAGE_PIXELS',
    "imageSource" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "layerConfig" JSONB NOT NULL,
    "defaultViewport" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapPlacement" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MapPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapRoute" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ROAD',
    "points" JSONB NOT NULL,

    CONSTRAINT "MapRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapRegion" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factionId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#D6BD8D',
    "polygon" JSONB NOT NULL,

    CONSTRAINT "MapRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'REFERENCE',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLink" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "entityId" TEXT,
    "eventId" TEXT,
    "documentId" TEXT,

    CONSTRAINT "AssetLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsistencyReport" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsistencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniverseActivity" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniverseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "universeId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Universe_slug_key" ON "Universe"("slug");

-- CreateIndex
CREATE INDEX "Universe_ownerId_idx" ON "Universe"("ownerId");

-- CreateIndex
CREATE INDEX "UniverseMember_userId_idx" ON "UniverseMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UniverseMember_universeId_userId_key" ON "UniverseMember"("universeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_universeId_status_idx" ON "Invitation"("universeId", "status");

-- CreateIndex
CREATE INDEX "Timeline_universeId_idx" ON "Timeline"("universeId");

-- CreateIndex
CREATE INDEX "Timeline_parentId_idx" ON "Timeline"("parentId");

-- CreateIndex
CREATE INDEX "Entity_universeId_type_archivedAt_idx" ON "Entity"("universeId", "type", "archivedAt");

-- CreateIndex
CREATE INDEX "Entity_universeId_name_idx" ON "Entity"("universeId", "name");

-- CreateIndex
CREATE INDEX "Entity_timelineId_idx" ON "Entity"("timelineId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_universeId_slug_key" ON "Entity"("universeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipTypeDef_universeId_key_key" ON "RelationshipTypeDef"("universeId", "key");

-- CreateIndex
CREATE INDEX "Relationship_universeId_archivedAt_idx" ON "Relationship"("universeId", "archivedAt");

-- CreateIndex
CREATE INDEX "Relationship_sourceId_idx" ON "Relationship"("sourceId");

-- CreateIndex
CREATE INDEX "Relationship_targetId_idx" ON "Relationship"("targetId");

-- CreateIndex
CREATE INDEX "Relationship_originEventId_idx" ON "Relationship"("originEventId");

-- CreateIndex
CREATE INDEX "Relationship_endEventId_idx" ON "Relationship"("endEventId");

-- CreateIndex
CREATE INDEX "Relationship_timelineId_idx" ON "Relationship"("timelineId");

-- CreateIndex
CREATE INDEX "HistoricalEvent_universeId_startOrdinal_idx" ON "HistoricalEvent"("universeId", "startOrdinal");

-- CreateIndex
CREATE INDEX "HistoricalEvent_timelineId_idx" ON "HistoricalEvent"("timelineId");

-- CreateIndex
CREATE INDEX "HistoricalEvent_locationId_idx" ON "HistoricalEvent"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalEvent_universeId_slug_key" ON "HistoricalEvent"("universeId", "slug");

-- CreateIndex
CREATE INDEX "EventParticipant_entityId_idx" ON "EventParticipant"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_entityId_role_key" ON "EventParticipant"("eventId", "entityId", "role");

-- CreateIndex
CREATE INDEX "EventDependency_universeId_idx" ON "EventDependency"("universeId");

-- CreateIndex
CREATE INDEX "EventDependency_targetId_idx" ON "EventDependency"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "EventDependency_sourceId_targetId_type_key" ON "EventDependency"("sourceId", "targetId", "type");

-- CreateIndex
CREATE INDEX "TimelineChange_timelineId_status_idx" ON "TimelineChange"("timelineId", "status");

-- CreateIndex
CREATE INDEX "TimelineChange_targetType_targetId_idx" ON "TimelineChange"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Revision_recordType_recordId_version_idx" ON "Revision"("recordType", "recordId", "version");

-- CreateIndex
CREATE INDEX "Revision_universeId_createdAt_idx" ON "Revision"("universeId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeProposal_universeId_createdAt_idx" ON "ChangeProposal"("universeId", "createdAt");

-- CreateIndex
CREATE INDEX "ImpactItem_proposalId_idx" ON "ImpactItem"("proposalId");

-- CreateIndex
CREATE INDEX "LoreDocument_universeId_category_idx" ON "LoreDocument"("universeId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LoreDocument_universeId_slug_key" ON "LoreDocument"("universeId", "slug");

-- CreateIndex
CREATE INDEX "LoreLink_entityId_idx" ON "LoreLink"("entityId");

-- CreateIndex
CREATE INDEX "LoreLink_eventId_idx" ON "LoreLink"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "LoreLink_documentId_entityId_eventId_key" ON "LoreLink"("documentId", "entityId", "eventId");

-- CreateIndex
CREATE INDEX "WorldMap_universeId_idx" ON "WorldMap"("universeId");

-- CreateIndex
CREATE UNIQUE INDEX "MapPlacement_mapId_entityId_key" ON "MapPlacement"("mapId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_universeId_kind_idx" ON "MediaAsset"("universeId", "kind");

-- CreateIndex
CREATE INDEX "AssetLink_assetId_idx" ON "AssetLink"("assetId");

-- CreateIndex
CREATE INDEX "AssetLink_entityId_idx" ON "AssetLink"("entityId");

-- CreateIndex
CREATE INDEX "AiSuggestion_userId_createdAt_idx" ON "AiSuggestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSuggestion_universeId_kind_idx" ON "AiSuggestion"("universeId", "kind");

-- CreateIndex
CREATE INDEX "ConsistencyReport_universeId_createdAt_idx" ON "ConsistencyReport"("universeId", "createdAt");

-- CreateIndex
CREATE INDEX "UniverseActivity_universeId_createdAt_idx" ON "UniverseActivity"("universeId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_universeId_createdAt_idx" ON "AuditLog"("universeId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Universe" ADD CONSTRAINT "Universe_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniverseMember" ADD CONSTRAINT "UniverseMember_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniverseMember" ADD CONSTRAINT "UniverseMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Timeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_branchEventId_fkey" FOREIGN KEY ("branchEventId") REFERENCES "HistoricalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipTypeDef" ADD CONSTRAINT "RelationshipTypeDef_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_originEventId_fkey" FOREIGN KEY ("originEventId") REFERENCES "HistoricalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_endEventId_fkey" FOREIGN KEY ("endEventId") REFERENCES "HistoricalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEvent" ADD CONSTRAINT "HistoricalEvent_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEvent" ADD CONSTRAINT "HistoricalEvent_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalEvent" ADD CONSTRAINT "HistoricalEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDependency" ADD CONSTRAINT "EventDependency_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDependency" ADD CONSTRAINT "EventDependency_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDependency" ADD CONSTRAINT "EventDependency_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDependency" ADD CONSTRAINT "EventDependency_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineChange" ADD CONSTRAINT "TimelineChange_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineChange" ADD CONSTRAINT "TimelineChange_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineChange" ADD CONSTRAINT "TimelineChange_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactItem" ADD CONSTRAINT "ImpactItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoreDocument" ADD CONSTRAINT "LoreDocument_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoreLink" ADD CONSTRAINT "LoreLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LoreDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoreLink" ADD CONSTRAINT "LoreLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoreLink" ADD CONSTRAINT "LoreLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldMap" ADD CONSTRAINT "WorldMap_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPlacement" ADD CONSTRAINT "MapPlacement_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WorldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapPlacement" ADD CONSTRAINT "MapPlacement_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapRoute" ADD CONSTRAINT "MapRoute_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WorldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapRegion" ADD CONSTRAINT "MapRegion_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "WorldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapRegion" ADD CONSTRAINT "MapRegion_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLink" ADD CONSTRAINT "AssetLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLink" ADD CONSTRAINT "AssetLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLink" ADD CONSTRAINT "AssetLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoricalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLink" ADD CONSTRAINT "AssetLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LoreDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsistencyReport" ADD CONSTRAINT "ConsistencyReport_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniverseActivity" ADD CONSTRAINT "UniverseActivity_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniverseActivity" ADD CONSTRAINT "UniverseActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
