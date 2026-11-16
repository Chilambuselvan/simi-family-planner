# Simi Family Planner

Build a phase-1 MVP of a family household management app called "HomeBase" (working title). This is for a family to share, with persistent data, multiple family members, and views that can be filtered per person.

## Core modules for v1

### 1. Task/To-Do tracker
- Tasks belong to a family (shared workspace) and are assigned to a specific family member
- Fields: title, description, due date, priority (low/medium/high), status (todo/in-progress/done), category/tag, recurring flag (simple daily/weekly/monthly recurrence)
- Users can filter the task list by: assignee, status, due date range, category
- Mark complete, snooze (push due date), reschedule
- "Review mode" view: show everything due or overdue in the current month, grouped by person

### 2. Household inventory
- Track household items/systems: name, category (appliance, furniture, utility system, vehicle, etc.), purchase date, warranty expiry date, location in the house, maintenance interval (e.g. every 6 months), last serviced date, notes, and a photo attachment
- Pre-seed example categories relevant to this household: solar/PV system, heat pump, EV charger, general appliances — but keep the schema generic so any item type fits
- Each item can have an associated contact (installer/service company name, phone, email) for maintenance callouts
- List view + detail view; flag items with upcoming or expired warranties and overdue maintenance

### 3. Calendar view (placeholder for now)
- Build a calendar screen (month/week view) that currently shows tasks with due dates and maintenance due dates pulled from the two modules above
- Design it so an external calendar feed (Google/Microsoft 365) can be plugged in later as an additional event source — but do NOT build the OAuth integration yet, just leave a clearly marked "Connect external calendar (coming soon)" button that does nothing yet

### 4. Review cycle
- A simple weekly/monthly "Review" screen that surfaces: tasks due soon, overdue tasks, items needing maintenance soon, and warranties expiring soon — basically a digest view pulling from the other modules

## Users & sharing
- Multiple family members can sign in (use standard email/password auth)
- One "family" workspace shared by all members of that family
- Each user has a name/avatar so tasks and views can be filtered per person
- Any family member can see all tasks/items, not just their own (shared visibility), but can filter to "just mine"

## Explicitly out of scope for this v1 (do not build yet, just leave clean extension points / placeholder UI where natural)
- Google Calendar / Microsoft 365 calendar sync (needs OAuth credentials I don't have yet)
- Viessmann heat pump API integration
- Enpal PV/solar API integration
- Tesla vehicle API integration
- TV display / smart display casting
- Push notifications (just build in-app notification/reminder indicators for now)
- Native iPhone app (this is a responsive web app for now, works on phone browser and laptop)

## Design
- Clean, simple, modern — should feel comfortable for all family members including less technical ones
- Mobile-responsive since it'll mostly be used on phones
- Dashboard/home screen showing: today's/this week's tasks at a glance, anything overdue, upcoming maintenance/warranty alerts

Please set up the database (Supabase) with proper tables for families, members, tasks, and household items, with row-level security scoped to each family's data.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://simi-family-planner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/40445ab0-27cc-4da3-a5c4-633866f7d04d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
