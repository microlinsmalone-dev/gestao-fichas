# Project: SistemaFichas_Web

## Architecture
- **Framework**: Next.js 15 (App Router with `output: 'export'`), React 19, TypeScript 5, Tailwind CSS 3.4.
- **Backend & Database**: Supabase (`https://apfcbkucxjcleqxarlmv.supabase.co`) with PostgreSQL schema, RLS policies for `anon, authenticated`, and direct client-side SDK integration (`@supabase/supabase-js`).
- **Data Migration**: Automated migration script converting SQLite (`D:\Malone\CriaFichas\sistema_fichas.db`) with 280 students, 105 courses, and 717 enrollment records into Supabase, with complete date normalization for Excel serial numbers.
- **UI & Layout**: Modern, responsive SPA matching `Gestão de Apostilas` design system with Lucide icons, toast notifications, and modal dialogs.
- **Print Engine**: Dedicated A4 print component reproducing `ModeloFicha.xlsx` Frente (Page 1) and Verso (Page 2) with calibrated OpenXML-equivalent scaling (`65%` Frente, `67%` Verso), schedule dialog (days/hours), and individual or batch printing.
- **Excel Module**: Client-side `.xlsx` parsing and generation via `xlsx` / `xlsx-js-style` for blank template generation, student import with upsert, and list export.
- **Deployment**: GitHub Pages static hosting via `.github/workflows/deploy.yml` with dynamic `basePath`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Supabase Relational Schema & RLS | PostgreSQL tables `fichas`, `cursos`, `fichas_cursos` with explicit `ordem` (1..18), unique constraints, foreign keys ON DELETE CASCADE, indexes, and RLS policies for public/anon access | M1 | ORIGINAL_REQUEST §R2 |
| F2 | SQLite to Supabase Automated Migration | Migration script migrating 280 students and 717 links from `sistema_fichas.db`, normalizing Excel serial dates, 2-digit years, and 105 distinct courses | M1 | ORIGINAL_REQUEST §R2 |
| F3 | Next.js 15 App Shell & Supabase Client | Next.js 15 project setup, `output: 'export'`, Tailwind CSS, Lucide icons, Supabase client initialization, TypeScript types, responsive shell layout | M2 | ORIGINAL_REQUEST §R1 |
| F4 | Student Table & Interactive Filtering | Real-time text search (name, matricula), column sorting, active filters, single selection, and select-all checkboxes | M3 | ORIGINAL_REQUEST §R3 |
| F5 | Student Profile CRUD Modal | Form for cadastral fields (Matrícula, Nome, Email, Nascimento, Telefone, Instrutor) and the 9 pedagogical lifecycle dates with validation and feedback | M3 | ORIGINAL_REQUEST §R3 |
| F6 | Course Management & Interactive Reordering | Course assignment with autocomplete against the 105-course catalog, adding up to 18 courses, interactive reordering (up/down or drag), and persistence in `fichas_cursos.ordem` | M3 | ORIGINAL_REQUEST §R3 |
| F7 | A4 Frente & Verso Pedagogical Sheet Print Engine | Web print layout replicating `ModeloFicha.xlsx` Frente & Verso, schedule configuration modal (hours & days of week), calibrated CSS @media print | M4 | ORIGINAL_REQUEST §R4 |
| F8 | Batch Printing with Clean Page Breaks | Batch printing of all checked students generating continuous document with clean A4 page breaks (`break-after: page`) | M4 | ORIGINAL_REQUEST §R4 |
| F9 | Client-Side Excel Import/Export & Model Template | Download blank 16-column import template, import filled .xlsx with field parsing and Supabase upsert, export student list to .xlsx | M5 | ORIGINAL_REQUEST §R5 |
| F10 | GitHub Actions CI/CD Deployment | GitHub Actions workflow (`deploy.yml`) for building static export (`npm run build`) and deploying to GitHub Pages with proper `basePath` | M5 | ORIGINAL_REQUEST §R1 |
| F11 | End-to-End Acceptance & Verification | Pass 100% of E2E test suite (Tiers 1-4) and complete forensic audit and adversarial hardening | M6 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema & Data Migration | Supabase DDL SQL, RLS policies, Python/TS migration script, verification of 280 students & 105 courses | none | DONE |
| M2 | App Shell & Base Infrastructure | Next.js 15 configuration, Tailwind CSS, Lucide, Supabase client, TypeScript types, layout & navbar | none | DONE |
| M3 | Student & Course Management (CRUD) | Student table, search/filter/select, student profile modal (cadastral + 9 dates), course selector & reordering UI | M1, M2 | DONE |
| M4 | Pedagogical Sheet Print Engine (A4) | Schedule dialog, Frente & Verso visual layout faithful to ModeloFicha.xlsx, @media print CSS, batch printing | M2, M3 | DONE |
| M5 | Excel Integration & CI/CD | 16-column Excel template generator, client-side .xlsx importer with upsert, .xlsx exporter, GitHub Actions workflow | M2, M3 | DONE |
| M6 | Final E2E Test Pass & Acceptance | Verification of 100% E2E tests, build validation, static export check, and forensic audit | M1, M2, M3, M4, M5 | DONE |

## Interface Contracts

### M1 ↔ M2/M3: Supabase Database Contract
- Table `fichas`:
  - `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
  - `matricula VARCHAR(50) UNIQUE NOT NULL`
  - `nome VARCHAR(255) NOT NULL`
  - `email VARCHAR(255)`
  - `telefone VARCHAR(50)`
  - `instrutor VARCHAR(255)`
  - `data_nascimento DATE`
  - `data_inicio_curso DATE`
  - `data_termino_curso DATE`
  - `data_linha_vida DATE`
  - `data_form1 DATE`
  - `data_form2 DATE`
  - `data_dreamday DATE`
  - `data_fechamento1 DATE`
  - `data_fechamento2 DATE`
  - `data_fechamento3 DATE`
  - `dia_semana VARCHAR(50)` (optional schedule persistence)
  - `horario_inicio VARCHAR(20)` (optional schedule persistence)
  - `horario_fim VARCHAR(20)` (optional schedule persistence)
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- Table `cursos`:
  - `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
  - `nome VARCHAR(255) UNIQUE NOT NULL`
  - `ativo BOOLEAN DEFAULT TRUE`
- Table `fichas_cursos`:
  - `id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
  - `ficha_id BIGINT REFERENCES fichas(id) ON DELETE CASCADE NOT NULL`
  - `curso_id BIGINT REFERENCES cursos(id) ON DELETE RESTRICT NOT NULL`
  - `ordem INTEGER NOT NULL CHECK (ordem >= 1 AND ordem <= 18)`
  - `UNIQUE (ficha_id, ordem)`

### M3 ↔ M4: Student & Print Engine Contract
- Print component receives `students: StudentWithCourses[]`, `scheduleConfig: { horarioInicio: string, horarioFim: string, diasSemana: string[] }`.
- `StudentWithCourses` includes all `fichas` fields plus ordered list of courses: `{ id: number, nome: string, ordem: number }[]` (max 18 items).

### M3 ↔ M5: Excel Import/Export Contract
- 16-Column Template:
  1. Matrícula (text/number)
  2. Nome (text)
  3. Email (text)
  4. Nascimento (DD/MM/YYYY or serial)
  5. Telefone (text)
  6. Instrutor (text)
  7. Início do Curso (DD/MM/YYYY)
  8. Término do Curso (DD/MM/YYYY)
  9. Linha da Vida (DD/MM/YYYY)
  10. Form 1 (DD/MM/YYYY)
  11. Form 2 (DD/MM/YYYY)
  12. Dreamday (DD/MM/YYYY)
  13. Fechamento 1 (DD/MM/YYYY)
  14. Fechamento 2 (DD/MM/YYYY)
  15. Fechamento 3 (DD/MM/YYYY)
  16. Cursos Contratados (Separados por vírgula)

## Code Layout
```
SistemaFichas_Web/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── print/
│       └── page.tsx
├── components/
│   ├── ui/               # Button, Input, Modal, Table, Badge, Checkbox
│   ├── students/         # StudentTable, StudentForm, StudentFilters
│   ├── courses/          # CourseSelector, CourseReorderList
│   ├── print/            # SheetPreview, SheetFrente, SheetVerso, ScheduleDialog
│   └── excel/            # ExcelImportModal, ExcelExportButton
├── lib/
│   ├── supabase/         # client.ts, types.ts
│   ├── utils/            # date-utils.ts, excel-utils.ts, cn.ts
│   └── hooks/            # useStudents.ts, useCourses.ts
├── supabase/
│   ├── migrations/       # 20261015_initial_schema.sql
│   └── migrate_sqlite.py # Automated migration script
└── tests/
    ├── e2e/
    └── unit/
```
