CREATE TYPE "Gender" AS ENUM ('Male', 'Female');
CREATE TYPE "Level" AS ENUM ('L100', 'L200', 'L300', 'L400', 'L500', 'L600', 'POSTGRADUATE');
CREATE TYPE "HeardAbout" AS ENUM ('Friend', 'WhatsApp', 'Instagram', 'Flier', 'Other');
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USHER');
CREATE TYPE "AdminStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
CREATE TYPE "FollowUpStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'VISITED', 'INTEGRATED');
CREATE TYPE "CheckInMethod" AS ENUM ('SELF', 'QR', 'USHER', 'OFFLINE');

CREATE TABLE "members" (
  "id" TEXT NOT NULL, "member_id" TEXT NOT NULL, "first_name" TEXT NOT NULL, "last_name" TEXT NOT NULL,
  "gender" "Gender" NOT NULL, "email" TEXT NOT NULL, "place_of_residence" TEXT NOT NULL,
  "heard_about" "HeardAbout" NOT NULL, "heard_about_other" TEXT, "first_timer" BOOLEAN NOT NULL,
  "phone" TEXT NOT NULL, "level" "Level" NOT NULL, "consent_given_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "admin_users" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "role" "AdminRole" NOT NULL DEFAULT 'USHER',
  "status" "AdminStatus" NOT NULL DEFAULT 'INVITED', "invited_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "last_login_at" TIMESTAMP(3),
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "recurring_events" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "recurrence" TEXT NOT NULL, "weekday" INTEGER,
  "start_time" TEXT NOT NULL, "venue" TEXT NOT NULL DEFAULT 'FAGCOOP Multipurpose Hall', "active" BOOLEAN NOT NULL DEFAULT true,
  "checkInOpensMinutes" INTEGER NOT NULL DEFAULT 60, "checkInClosesMinutes" INTEGER NOT NULL DEFAULT 120,
  CONSTRAINT "recurring_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "sessions" (
  "id" TEXT NOT NULL, "event_id" TEXT, "name" TEXT NOT NULL, "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3), "venue" TEXT NOT NULL DEFAULT 'FAGCOOP Multipurpose Hall', "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "attendance" (
  "id" TEXT NOT NULL, "member_id" TEXT NOT NULL, "session_id" TEXT NOT NULL,
  "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "method" "CheckInMethod" NOT NULL,
  CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "follow_ups" (
  "id" TEXT NOT NULL, "member_id" TEXT NOT NULL, "status" "FollowUpStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
  "notes" TEXT, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL, "admin_id" TEXT, "action" TEXT NOT NULL, "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "members_member_id_key" ON "members"("member_id");
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
CREATE INDEX "members_created_at_idx" ON "members"("created_at");
CREATE INDEX "members_last_name_first_name_idx" ON "members"("last_name", "first_name");
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE UNIQUE INDEX "sessions_event_id_starts_at_key" ON "sessions"("event_id", "starts_at");
CREATE INDEX "sessions_starts_at_active_idx" ON "sessions"("starts_at", "active");
CREATE UNIQUE INDEX "attendance_member_id_session_id_key" ON "attendance"("member_id", "session_id");
CREATE INDEX "attendance_session_id_checked_in_at_idx" ON "attendance"("session_id", "checked_in_at");
CREATE UNIQUE INDEX "follow_ups_member_id_key" ON "follow_ups"("member_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "recurring_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "members" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "place_of_residence" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "heard_about" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "level" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "consent_given_at" DROP NOT NULL;
ALTER TABLE "members" ADD COLUMN "guest" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "rate_limits" ("key" TEXT NOT NULL, "hits" INTEGER NOT NULL DEFAULT 1, "reset_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key"));
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits"("reset_at");
ALTER TABLE "recurring_events" ADD COLUMN "time_tba" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "member_sequences" ("year" INTEGER NOT NULL, "next_value" INTEGER NOT NULL, CONSTRAINT "member_sequences_pkey" PRIMARY KEY ("year"));
