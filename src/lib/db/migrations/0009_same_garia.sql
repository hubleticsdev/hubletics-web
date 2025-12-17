CREATE TABLE "coach_allowed_durations" (
	"id" text PRIMARY KEY NOT NULL,
	"coachId" text NOT NULL,
	"durationMinutes" integer NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_allowed_durations" ADD CONSTRAINT "coach_allowed_durations_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_allowed_durations_coach_idx" ON "coach_allowed_durations" USING btree ("coachId");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_allowed_durations_unique_idx" ON "coach_allowed_durations" USING btree ("coachId","durationMinutes");