# CONTEXT PROMPT — LouvorIDB Project

## 0. ROLE AND OPERATING RULES

You are working on an existing software project called **LouvorIDB / Repositorio_Igreja**.

Your role at this stage is to act as a **technical project assistant and implementation agent**, but you must respect the existing architecture and decisions documented below.

### Critical rule

**Do not autonomously change the project's architecture, data model, business rules, or user-facing behavior.**

Before implementing a change:

1. Inspect the existing project files.
2. Identify how the current implementation works.
3. Preserve existing functionality.
4. Make the smallest necessary change.
5. Do not rewrite large files unnecessarily.
6. Do not introduce new frameworks or dependencies without explicit approval.
7. Do not assume that a missing feature is a bug.
8. If requirements are ambiguous, stop and ask for clarification.

---

# 1. PROJECT IDENTITY

**Project name:**

`Liturge` (Repositório: `LouvorIDB / Repositorio_Igreja`)

**Official Domain:**
`app.liturge.app.br` (Vercel)

## Purpose

The system is designed to centralize the repertoire, schedules, media and worship organization for churches as a scalable multi-tenant SaaS.

The goal is to provide a web-based interface connected to Supabase and native integrations with projection software like Holyrics.

---

# 2. CURRENT ARCHITECTURE

The current architecture is:

```text
Frontend (HTML/JS/CSS, Vite, PWA) - Hosted on Vercel (app.liturge.app.br)
   |
   | Supabase JS SDK (REST/Realtime via PostgreSQL)
   v
Supabase (PostgreSQL Database + Auth + Storage + Edge Functions)
```

## Frontend

The frontend is hosted through:
**Vercel** (`app.liturge.app.br`)

The project is a PWA developed using Vanilla JS and Vite.

The frontend source files are part of the local project repository.

## Backend

The backend is **Supabase (PostgreSQL)**.
All data is stored relationally with Row Level Security (RLS) for multi-tenancy.
Authentication is handled via Supabase Auth.

---

# 3. CURRENT IMPLEMENTATION STATUS

The project recently completed a full migration from Google Apps Script / Google Sheets to Supabase.
All legacy Google Sheets integrations and `.gs` files have been removed. 

The frontend uses the `@supabase/supabase-js` client to fetch and mutate data directly.

---

# 4. DESIGN PRINCIPLES

The following principles should be maintained:

### Minimal changes

Do not rewrite working systems simply for code style.

### Data consistency

The frontend and backend must agree on the same relational structure.

### Clear separation

The system consists of:

```text
UI (HTML/CSS)
↓
Frontend logic (JS)
↓
Supabase Client
↓
Supabase Backend
```

Changes should respect these boundaries.

### No speculative features

Do not implement future Android/iOS native functionality now, stick to the PWA.
Do not add other databases or major frameworks (like React/Next) without explicit permission.
