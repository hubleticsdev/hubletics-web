ALTER TABLE "review" DROP CONSTRAINT "review_bookingId_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "review_booking_reviewer_unique_idx" ON "review" USING btree ("bookingId","reviewerId");