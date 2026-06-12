import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const hospitalCallLogTable = pgTable("hospital_call_log", {
  id: serial("id").primaryKey(),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  patientPhone: text("patient_phone"),
  intent: text("intent").notNull(),
  outcome: text("outcome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HospitalCallLog = typeof hospitalCallLogTable.$inferSelect;
