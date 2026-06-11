import bcrypt from "bcrypt";
import { db, adminsTable, agentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const agents = [
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    shortDescription: "Submit expenses via form, stored in Google Sheets, analyzed by GPT-4.1-mini, and delivered as a weekly email summary via Gmail.",
    description:
      "The Expense Tracker Agent is a Google Forms + Google Sheets + GPT-4.1-mini + Gmail pipeline orchestrated by n8n. Users submit their expenses through a structured form. The data is stored in a connected Google Sheet. On demand or on a weekly schedule, the agent reads all recent entries, passes them to GPT-4.1-mini for categorization and pattern analysis, and sends a formatted spending summary directly to your inbox via Gmail.",
    howItWorks:
      "1. User submits expense entries (amount, category, description, date) via the admin panel.\n2. The n8n workflow receives the data and appends each entry to a connected Google Sheet.\n3. The workflow retrieves this week's expenses from the sheet.\n4. GPT-4.1-mini analyzes the spending data: categorizes entries, identifies patterns, and generates a human-readable summary.\n5. The summary is sent to the configured Gmail address as a formatted email report.\n6. The generated summary is returned to the admin panel for immediate preview.",
    requirements:
      "Admin access to the AgentHub dashboard, expense entries (amount, category, description, date), Google Sheet connected via n8n, Gmail account configured in the n8n workflow.",
    expectedOutput:
      "A categorized weekly expense summary email delivered via Gmail, including total spend, breakdown by category, spending patterns, and any notable observations from GPT-4.1-mini. The summary is also previewed in the admin panel immediately after submission.",
    sampleExamples: [
      {
        title: "Weekly Expense Summary",
        input: "Food: ₹850 (lunch meetings, 3 entries), Transport: ₹1,200 (cab rides, 4 entries), Office Supplies: ₹2,500 (stationery), Utilities: ₹600 (internet bill).",
        output:
          "Weekly Expense Summary\n\nTotal Spend: ₹5,150\n\nBy Category:\n• Office Supplies: ₹2,500 (48.5%) — highest spend this week\n• Transport: ₹1,200 (23.3%) — 4 trips logged\n• Food: ₹850 (16.5%) — 3 lunch meetings\n• Utilities: ₹600 (11.6%) — recurring bill\n\nObservations: Office supplies account for nearly half of this week's spend. Transport costs are consistent with previous weeks. Email sent to configured Gmail address.",
      },
      {
        title: "Multi-Category Entry Run",
        input: "Shopping: ₹3,200 (electronics), Entertainment: ₹900 (team outing), Food: ₹450 (team lunch), Transport: ₹300 (auto rides).",
        output:
          "Weekly Expense Summary\n\nTotal Spend: ₹4,850\n\nBy Category:\n• Shopping: ₹3,200 (66%) — electronics purchase noted\n• Entertainment: ₹900 (18.6%) — team outing\n• Food: ₹450 (9.3%) — team lunch\n• Transport: ₹300 (6.2%) — local commute\n\nObservations: Shopping is the dominant category this week due to an electronics purchase. Discretionary spend (entertainment + shopping) accounts for 84.6% of total. Email sent to configured Gmail address.",
      },
    ],
    webhookUrl: "https://n8n.srv1042888.hstgr.cloud/webhook/expense-tracker",
    order: 1,
  },
  {
    slug: "deadline-tracker",
    name: "Deadline Tracker",
    shortDescription: "Never miss a critical deadline — AI monitors tasks, sends smart alerts, and reprioritizes automatically.",
    description:
      "The Deadline Tracker Agent is your personal project management co-pilot. It monitors all your tasks and commitments across platforms, calculates risk scores for upcoming deadlines, and dynamically adjusts your priorities based on workload, dependencies, and urgency. It proactively notifies you when a deadline is at risk before it becomes a crisis.",
    howItWorks:
      "The agent ingests tasks from integrated tools (Jira, Asana, Notion, email, calendar). It builds a dependency graph, assigns risk scores based on complexity and time remaining, and sends escalating alerts as deadlines approach. When conflicts arise, it suggests re-scheduling options and can auto-delegate low-priority items.",
    requirements:
      "Task list with deadlines and estimated effort, integration with at least one project management tool or calendar, notification preferences (email, Slack, SMS).",
    expectedOutput:
      "Daily priority briefing, real-time deadline risk dashboard, conflict detection reports, automated reminder sequences, workload balance recommendations.",
    sampleExamples: [
      {
        title: "Weekly Priority Briefing",
        input: "What are my most critical deadlines this week?",
        output:
          "CRITICAL (next 24h): Client proposal due tomorrow 9AM — 60% complete, needs 4 more hours. HIGH: Q2 report due Friday — on track. MEDIUM: Team review meeting prep (Thursday). Recommendation: Block 2-3pm today for proposal. You have a scheduling conflict Wednesday — 3 overlapping meetings.",
      },
      {
        title: "Deadline Conflict Resolution",
        input: "I just got a new urgent task due in 2 days but I already have 3 things due then.",
        output:
          "Conflict detected. Current Wednesday load: 14 estimated hours for 4 tasks. Recommendation: (1) Delegate the internal report to Sarah — she has capacity. (2) Request 1-day extension on the vendor response. (3) Start new urgent task immediately. Revised plan reduces Wednesday load to 9 hours. Shall I send the delegation request?",
      },
    ],
    order: 2,
  },
  {
    slug: "hr-agent",
    name: "HR Agent",
    shortDescription: "Streamline HR operations — from onboarding to performance reviews — with intelligent automation.",
    description:
      "The HR Agent is a comprehensive human resources assistant that automates routine HR workflows, answers employee queries 24/7, processes leave requests, assists with onboarding, and provides HR analytics to management. It ensures compliance, reduces administrative burden, and improves employee experience.",
    howItWorks:
      "The agent integrates with your HRIS system, learns your company policies, and handles HR interactions through a conversational interface. It processes requests, routes complex issues to HR staff, generates reports, and maintains an audit trail of all actions.",
    requirements:
      "Company HR policy documents, HRIS integration (BambooHR, Workday, etc.), employee directory, leave policy configuration, and role-based access setup.",
    expectedOutput:
      "Automated leave approvals/rejections, onboarding checklists, policy Q&A responses, HR analytics dashboards, compliance reports, and employee satisfaction metrics.",
    sampleExamples: [
      {
        title: "Leave Request Processing",
        input: "I need to take 5 days off next week for a family emergency.",
        output:
          "Leave request received. Checking your balance: You have 12 remaining PTO days. Checking team calendar: 2 colleagues are already on leave next week but coverage is available. Status: APPROVED. Your manager has been notified. HR record updated. Return date: following Monday. Is there anything else you need help with?",
      },
      {
        title: "Onboarding Assistance",
        input: "I'm starting next Monday. What do I need to do to prepare?",
        output:
          "Welcome! Your onboarding checklist: Pre-start (this week): Complete digital paperwork (link sent), set up 2FA for company email. Day 1: IT orientation 9AM, meet your buddy mentor 11AM, team lunch 12PM. Week 1: 8 required training modules (estimated 4 hours). I've scheduled your first 5 meetings and ordered your equipment. Any questions?",
      },
    ],
    order: 3,
  },
  {
    slug: "appointment-booking",
    name: "Appointment Booking",
    shortDescription: "Intelligent scheduling assistant that books, reschedules, and manages appointments autonomously.",
    description:
      "The Appointment Booking Agent handles all aspects of scheduling — from finding the right time slot across multiple calendars to sending confirmations, reminders, and follow-ups. It understands natural language scheduling requests and optimizes appointments based on location, preferences, and availability.",
    howItWorks:
      "The agent connects to Google Calendar, Outlook, or custom booking systems. When a booking request comes in, it checks all relevant calendars, proposes optimal time slots, sends invites, handles rescheduling and cancellations, and follows up with reminders and post-meeting surveys.",
    requirements:
      "Calendar API access (Google Calendar, Outlook, or Calendly), business hours configuration, service/appointment type definitions, participant contact information.",
    expectedOutput:
      "Confirmed appointment notifications, calendar invites, automated reminder sequences (24h, 1h before), rescheduling confirmations, no-show alerts, and booking analytics.",
    sampleExamples: [
      {
        title: "Multi-Person Meeting Scheduling",
        input: "Schedule a 1-hour strategy meeting with the product and engineering leads next week.",
        output:
          "Found availability: Tuesday 2-3PM and Thursday 10-11AM work for all 3 participants. Recommending Tuesday 2PM (higher energy time, before end-of-week crunch). Invite sent to Sarah (Product) and Marcus (Engineering). Meeting room booked: Conference B. Video link added for remote option. Agenda template shared. Confirm?",
      },
      {
        title: "Patient Appointment Booking",
        input: "Book a follow-up appointment with Dr. Chen, preferably in the morning.",
        output:
          "Dr. Chen's next available morning slots: Wednesday 9:30AM, Thursday 8:45AM, Friday 10:00AM. Your insurance is verified for this visit. Booking Wednesday 9:30AM as requested. Appointment confirmation sent to your email. Reminder set for 24h and 2h before. Do you need directions to the clinic?",
      },
    ],
    order: 4,
  },
  {
    slug: "customer-support",
    name: "Customer Support",
    shortDescription: "24/7 AI support agent that resolves tickets, escalates intelligently, and learns from every interaction.",
    description:
      "The Customer Support Agent provides instant, intelligent customer service across all channels — chat, email, and social media. It resolves common issues autonomously, escalates complex cases to human agents with full context, and continuously improves through feedback loops. It maintains brand voice consistency and tracks satisfaction metrics.",
    howItWorks:
      "The agent monitors all support channels, classifies incoming tickets by urgency and category, resolves tier-1 issues automatically using your knowledge base, and routes tier-2/3 issues to the right human agent with a full context summary. It learns from resolutions to improve future accuracy.",
    requirements:
      "Product knowledge base and FAQ documentation, integration with support platform (Zendesk, Intercom, Freshdesk), escalation workflow definition, brand voice guidelines.",
    expectedOutput:
      "Instant ticket responses, automated issue resolution for common problems, escalation summaries with full context, CSAT scores, resolution time metrics, and knowledge gap reports.",
    sampleExamples: [
      {
        title: "Password Reset Request",
        input: "I can't log into my account, I've forgotten my password.",
        output:
          "No problem! I've sent a password reset link to your registered email (j***@gmail.com). The link expires in 30 minutes. If you don't see it, check spam or let me know. If you no longer have access to that email, I can verify your identity another way. Is there anything else I can help you with today?",
      },
      {
        title: "Complex Billing Dispute",
        input: "I was charged twice for my subscription this month.",
        output:
          "I'm sorry about the double charge. I can see 2 charges of $49.99 on March 15 and March 16 on your account. This appears to be a system error. I'm escalating this to our billing team with HIGH priority. They will process a refund within 2 business days. Reference #: SUP-2024-8847. You'll receive email confirmation once resolved. I've also added a $10 credit to your account for the inconvenience.",
      },
    ],
    order: 5,
  },
  {
    slug: "campus-concierge",
    name: "Campus Concierge Agent",
    shortDescription: "Your intelligent university assistant — schedules, resources, events, and campus navigation in one place.",
    description:
      "The Campus Concierge Agent is a comprehensive assistant for students, faculty, and staff. It helps navigate campus resources, answers questions about policies and procedures, assists with course registration, facility bookings, event discovery, and provides personalized recommendations based on your academic profile.",
    howItWorks:
      "The agent integrates with university systems (SIS, LMS, facility management, event calendars) and provides a unified interface for all campus needs. It understands academic calendars, knows building locations, and can handle complex multi-step tasks like finding study rooms with available equipment near your next class.",
    requirements:
      "University SIS integration, campus map and facility database, event management system access, student/faculty profile data (with privacy controls), academic calendar configuration.",
    expectedOutput:
      "Course schedules and registration assistance, facility and room bookings, event recommendations, campus navigation directions, policy answers, deadline reminders, and resource availability status.",
    sampleExamples: [
      {
        title: "Study Room Booking",
        input: "I need a quiet study room for 4 people with a projector for tomorrow afternoon.",
        output:
          "Found 3 options for tomorrow 12-6PM: (1) Library Room 204 — projector, whiteboard, available 1-5PM. (2) Engineering Building B-12 — 4K display, standing desks, available 2-6PM. (3) Student Union Meeting Room 3 — projector, free coffee station, available 1-4PM. Booking Library Room 204 for 2-5PM? I'll send calendar invites to your group.",
      },
      {
        title: "Course Registration Help",
        input: "What courses can I take next semester that fulfill my CS major requirements?",
        output:
          "Based on your transcript, you still need: 1 algorithms course, 1 systems course, 2 CS electives. Available next semester that fit: CS401 (Advanced Algorithms, MWF 10am — Prof. Lee, 4.8 rating), CS415 (Operating Systems, TTh 2pm), CS450 (Machine Learning, MWF 2pm — HIGHLY recommended for your AI track). Registration opens Nov 1 for your class year. Want me to add these to your watchlist?",
      },
    ],
    order: 6,
  },
  {
    slug: "hospital-receptionist",
    name: "Hospital Receptionist Voice Agent",
    shortDescription: "Conversational voice AI that handles patient intake, scheduling, and triage — 24/7 with human warmth.",
    description:
      "The Hospital Receptionist Voice Agent provides a natural, empathetic voice interface for healthcare facilities. It handles inbound patient calls for appointment booking, prescription refills, test result inquiries, and emergency triage routing. It speaks naturally, handles multiple languages, and escalates appropriately while maintaining HIPAA compliance.",
    howItWorks:
      "The agent uses advanced speech recognition and natural language understanding to handle phone calls. It authenticates patients via voice or DOB, accesses their medical records (with appropriate permissions), schedules appointments with the right specialist, and routes urgent cases to on-call staff immediately.",
    requirements:
      "Voice telephony integration (Twilio or similar), EHR system access (Epic, Cerner), appointment scheduling system, triage protocol configuration, HIPAA compliance setup, multi-language model configuration.",
    expectedOutput:
      "Appointment confirmations via SMS/email, prescription refill requests forwarded to pharmacy, triage assessments with urgency classification, call transcripts and summaries, handoff notes for human staff.",
    sampleExamples: [
      {
        title: "Appointment Scheduling Call",
        input: "[Voice] Hi, I need to see a cardiologist. I've been having chest discomfort for a few days.",
        output:
          "[Voice Response] I'm sorry to hear that. Given your symptoms, I want to make sure you get seen quickly. Are you experiencing any shortness of breath or pain right now? [Patient: No, just mild discomfort] I'm checking cardiologist availability now. Dr. Patel has an opening tomorrow at 10:30 AM — this would be an urgent consultation. I can also connect you to our nurse line right now for initial assessment. Which would you prefer?",
      },
      {
        title: "Prescription Refill Request",
        input: "[Voice] I need a refill for my blood pressure medication. I have about 3 days left.",
        output:
          "[Voice Response] I've pulled up your records. I can see you're on Lisinopril 10mg prescribed by Dr. Johnson. Your last refill was 30 days ago. I'm sending a refill request to the pharmacy now — it should be ready by tomorrow morning. I've also sent Dr. Johnson a note. Your pharmacy on Oak Street will text you when it's ready. Is there anything else I can help you with?",
      },
    ],
    order: 7,
  },
  {
    slug: "linkedin-management",
    name: "LinkedIn Management Multi Agent",
    shortDescription: "Autonomous multi-agent system that grows your LinkedIn presence, generates content, and nurtures your network.",
    description:
      "The LinkedIn Management Multi Agent is a sophisticated system of coordinated AI agents working in concert to maximize your professional presence. One agent analyzes trending content in your industry, another drafts and schedules posts, a third monitors and responds to comments, and a fourth identifies and engages with strategic connections — all autonomously, all in your voice.",
    howItWorks:
      "The orchestrator agent coordinates four specialized sub-agents: (1) Content Intelligence Agent — scans industry news, identifies trending topics, suggests content angles. (2) Content Creator Agent — drafts posts, articles, and comments in your voice. (3) Engagement Agent — monitors notifications, responds to comments, likes relevant posts. (4) Network Growth Agent — identifies ideal connections, sends personalized outreach. All agents report to a central dashboard.",
    requirements:
      "LinkedIn API credentials or browser automation authorization, personal brand guidelines and writing samples (for voice matching), target audience definition, engagement rules and boundaries, posting schedule preferences.",
    expectedOutput:
      "Content calendar with drafted posts, engagement analytics (impressions, comments, connections made), network growth metrics, top-performing content analysis, and monthly personal brand health report.",
    sampleExamples: [
      {
        title: "Weekly Content Generation",
        input: "Generate this week's LinkedIn content plan for a senior product manager in FinTech.",
        output:
          "Week Plan: Monday — Thought leadership post on embedded finance trends (estimated 800 impressions). Wednesday — Short carousel: '5 metrics every PM should track' (high engagement format). Friday — Personal story: Lesson from a failed product launch (authentic content, usually 2-3x normal reach). 3 strategic comments drafted for posts by VCs in your target network. 8 personalized connection requests to FinTech founders. All posts scheduled. Review and approve?",
      },
      {
        title: "Network Growth Campaign",
        input: "I want to connect with 50 CTOs in the healthcare tech space this month.",
        output:
          "Healthcare CTO Network Campaign initiated. Found 143 qualifying CTOs matching your criteria. Strategy: Week 1-2: Connect with 25 (personalized messages referencing their recent posts). Week 3-4: Connect with remaining 25 after warming up with content engagement. Drafted message template: 'Hi [Name], your post on [recent_topic] resonated — we're solving similar challenges at [your_company]. Would love to connect.' Projected acceptance rate: 35-45% based on profile strength. First batch ready for your approval.",
      },
    ],
    order: 8,
  },
];

async function seed() {
  logger.info("Starting seed...");

  const adminUsername = "admin";
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const [existingAdmin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, adminUsername));

  if (!existingAdmin) {
    await db.insert(adminsTable).values({ username: adminUsername, passwordHash });
    logger.info({ username: adminUsername }, "Admin created");
  } else {
    logger.info({ username: adminUsername }, "Admin already exists");
  }

  for (const agent of agents) {
    await db
      .insert(agentsTable)
      .values(agent)
      .onConflictDoUpdate({
        target: agentsTable.slug,
        set: {
          name: sql`excluded.name`,
          shortDescription: sql`excluded.short_description`,
          description: sql`excluded.description`,
          howItWorks: sql`excluded.how_it_works`,
          requirements: sql`excluded.requirements`,
          expectedOutput: sql`excluded.expected_output`,
          sampleExamples: sql`excluded.sample_examples`,
          webhookUrl: sql`excluded.webhook_url`,
          order: sql`excluded.order`,
        },
      });
    logger.info({ slug: agent.slug }, "Agent upserted");
  }

  logger.info("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
