CREATE INDEX "individual_booking_details_client_id_idx" ON "individual_booking_details" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "individual_booking_details_payment_status_idx" ON "individual_booking_details" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "individual_booking_details_payment_due_at_idx" ON "individual_booking_details" USING btree ("paymentDueAt");--> statement-breakpoint
CREATE INDEX "private_group_booking_details_organizer_id_idx" ON "private_group_booking_details" USING btree ("organizerId");--> statement-breakpoint
CREATE INDEX "private_group_booking_details_payment_status_idx" ON "private_group_booking_details" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "private_group_booking_details_payment_due_at_idx" ON "private_group_booking_details" USING btree ("paymentDueAt");