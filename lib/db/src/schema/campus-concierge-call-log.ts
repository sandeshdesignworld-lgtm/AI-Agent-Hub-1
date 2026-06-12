import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const campusConciergeCallLogTable = pgTable("campus_concierge_call_log", {
  id: serial("id").primaryKey(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  phoneNumber: text("phone_number"),
  executionId: text("execution_id"),
  status: text("status").notNull().default("triggered"),
  duration: integer("duration"),
  summary: text("summary"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CampusConciergeCallLog = typeof campusConciergeCallLogTable.$inferSelect;
