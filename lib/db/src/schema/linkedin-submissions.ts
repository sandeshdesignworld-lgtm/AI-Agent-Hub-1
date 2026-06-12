import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const linkedinSubmissionsTable = pgTable("linkedin_submissions", {
  id: serial("id").primaryKey(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  topic: text("topic").notNull(),
  category: text("category").notNull().default("General Professional"),
  audience: text("audience").notNull().default(""),
  status: text("status").notNull().default("pending"),
});

export type LinkedinSubmission = typeof linkedinSubmissionsTable.$inferSelect;
