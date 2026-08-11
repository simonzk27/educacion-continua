# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript (frontend), Node + Express + TypeScript (backend). Tailwind v4 for styling. Chosen by the user at project setup, not delegated.

## Users

- **Admin**: administrator of a course library — manages courses, enrollments, and grades.
- **Usuario**: standard user — consults/participates in courses and grades (exact permissions undecided).

## Product Purpose

Sistema Gestion Educativa: a course/grade management system. Admins manage the course catalog; users interact with courses and their own records.

## Positioning

Undecided — not yet confirmed with the user.

## Operating Context

Two-role login gate (Admin / Usuario) is the current entry point. No SSO or real auth yet — role selection only, no credentials enforced.

## Capabilities and Constraints

- Confirmed scope: course and grade management (cursos/notas) — enrollment, grading, course catalog implied but not yet itemized into features.
- Undecided: exact permission boundaries between Admin and Usuario; whether "Usuario" further splits into e.g. profesor/alumno.
- No backend auth wired to the frontend login yet (backend has only a health-check endpoint).

## Brand Commitments

None yet. No institution name, logo, or brand palette committed.

## Evidence on Hand

None. No real course/user data, assets, or content provided yet — future work must not fabricate institution names, testimonials, or sample data presented as real.

## Product Principles

1. Role clarity: Admin and Usuario are distinct, and the UI should always make the active role legible.
2. Course/grade data is the core object — screens should orient around courses, enrollments, and grades rather than generic CRUD.
3. Keep the system approachable for non-technical staff and students (educational context, not a power-user admin tool).

## Accessibility & Inclusion

No specific requirement established yet.
