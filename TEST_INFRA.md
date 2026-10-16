# Test Infrastructure Specification: SistemaFichas_Web

**Project:** Sistema de Gestão e Emissão de Fichas Pedagógicas Web (`SistemaFichas_Web`)  
**Document Version:** 1.0.0  
**Date:** 2026-10-15  
**Author:** E2E Test Writer (`test_writer_e2e`)  
**Target Standard:** 100% Coverage of Requirements R1–R5, Features F1–F10, Acceptance Criteria

---

## 1. Test Philosophy

The testing infrastructure for **SistemaFichas_Web** is constructed around four core testing principles:

1. **Opaque-Box & Requirement-Driven**:
   Tests evaluate strictly observable system behaviors, interface contracts, data integrity, and domain specifications derived directly from `ORIGINAL_REQUEST.md`, `PROJECT.md`, `ModeloFicha.xlsx`, and `sistema_fichas.db`. Tests do not couple to internal implementation details, private component variables, or ephemeral framework state.

2. **Progressive Testability & Deterministic Oracles**:
   Every test has an explicit, authoritative source of expected truth:
   - For database schema, constraints, and RLS: PostgreSQL/Supabase DDL specifications.
   - For migration and data fidelity: The 280 real student records, 105 courses, and 717 enrollment links in `D:\Malone\CriaFichas\sistema_fichas.db`.
   - For print page layout, scaling, and dimensions: The exact cell geometry, margins (2-3mm), paper size (A4, 210x297mm), and print scaling factors (65% Frente, 67% Verso) of `ModeloFicha.xlsx`.
   - For Excel import/export: The canonical 16-column layout with date normalization algorithms.

3. **Complete Isolation & Idempotency**:
   Each test is self-contained. It establishes its required fixtures, operates in an isolated context, makes zero destructive side-effects on external production services, and cleans up temporary state.

4. **Adversarial Verification & Hardening**:
   Tests actively probe failure boundaries, encoding challenges (UTF-8 Brazilian Portuguese characters: `Antônio`, `Diéssica`), malformed inputs (Excel float matriculas like `5056188.0`, dirty CSV courses), boundary limits (0 to 18 courses, 33 class log rows), and edge dates (Excel serial numbers, 2-digit years, leap years).

---

## 2. Four-Tier Feature Inventory

The test suite is structured across 4 hierarchical tiers:

```
+-------------------------------------------------------------------------+
|                  TIER 4: Real-World User Scenarios (>=5)                 |
|  - SQLite Migration -> Web Inspection -> Reorder -> A4 Print -> Export |
+-------------------------------------------------------------------------+
|               TIER 3: Cross-Feature Interactions (>=10)                 |
|  - Excel Import x Reorder x Print  - Filter x Batch Select x Batch Print|
+-------------------------------------------------------------------------+
|            TIER 2: Boundary & Corner Cases (>=50, >=5/feat)             |
|  - Empty states, 18-course cap, serial dates, float matricula, UTF-8    |
+-------------------------------------------------------------------------+
|              TIER 1: Feature Coverage (>=50, >=5/feat)                  |
|  - F1..F10 Core Happy Path & Functional Verifications                   |
+-------------------------------------------------------------------------+
```

### Feature Mapping (F1 to F10)

| Feature ID | Feature Name | Tier 1 Tests | Tier 2 Tests | Relevant Contracts |
|:----------:|:-------------|:------------:|:------------:|:-------------------|
| **F1** | Supabase Relational Schema & RLS | 5 | 5 | PostgreSQL DDL, foreign keys, cascade delete, RLS policies |
| **F2** | SQLite to Supabase Automated Migration | 5 | 5 | 280 students, 105 courses, 717 links, serial date normalization |
| **F3** | Next.js 15 App Shell & Supabase Client | 5 | 5 | `output: 'export'`, `basePath` resolution, client env fallback, types |
| **F4** | Student Table & Interactive Filtering | 5 | 5 | Real-time search, sorting, status filter, single & batch selection |
| **F5** | Student Profile CRUD Modal | 5 | 5 | Required fields (matricula, nome), 9 lifecycle dates, ISO formatting |
| **F6** | Course Management & Interactive Reordering | 5 | 5 | 96/105 course catalog, 18-course slots, reordering persistence |
| **F7** | A4 Frente & Verso Sheet Print Engine | 5 | 5 | A4 layout, scale 65%/67%, 33 log rows, career block, schedule modal |
| **F8** | Batch Printing with Clean Page Breaks | 5 | 5 | `break-after: page`, multi-student continuity, verso toggle, no blank pages |
| **F9** | Client-Side Excel Import/Export & Template | 5 | 5 | 16-column template, CSV course splitting, float-to-int matricula, upsert |
| **F10** | GitHub Actions CI/CD Deployment | 5 | 5 | `deploy.yml`, build triggers, pages permissions, static `out/` artifact |

---

## 3. Test Architecture & Directory Layout

The E2E test harness is organized as follows:

```
tests/
├── run_tests.py                    # Standalone test runner with per-tier statistics and exit codes
├── e2e/
│   ├── test_tier1_features.py      # Tier 1: Feature Coverage (F1..F10 >=50 tests)
│   ├── test_tier2_boundaries.py    # Tier 2: Boundary & Corner Cases (F1..F10 >=50 tests)
│   ├── test_tier3_interactions.py  # Tier 3: Cross-Feature Interactions (>=10 tests)
│   └── test_tier4_scenarios.py     # Tier 4: Real-World Application Scenarios (>=5 tests)
└── fixtures/
    ├── sample_sheets/              # Generated Excel test workbooks
    └── mock_data.py                # Normalized mock student and course fixtures
```

### Execution & Runner Invocation

The test suite is fully self-contained and requires no external network calls or running servers to execute:

```bash
# Run all tiers with full summary report
python tests/run_tests.py

# Run specific tier
python tests/run_tests.py --tier 1
python tests/run_tests.py --tier 2
python tests/run_tests.py --tier 3
python tests/run_tests.py --tier 4

# Run with verbose test case listing
python tests/run_tests.py -v
```

### Exit Code Contract
- Exit Code `0`: 100% of tests passed across all tiers.
- Exit Code `1`: One or more tests failed or encountered errors.

---

## 4. Coverage Thresholds

| Metric | Minimum Threshold | Target |
|:-------|:-----------------:|:------:|
| **Tier 1 (Feature Coverage)** | 50 tests (5 per F1..F10) | 50 tests |
| **Tier 2 (Boundary & Corner Cases)** | 50 tests (5 per F1..F10) | 50 tests |
| **Tier 3 (Cross-Feature Interactions)** | 10 tests | 10 tests |
| **Tier 4 (Real-World Scenarios)** | 5 tests | 5 tests |
| **Total Test Count** | **>= 115 tests** | **115+ tests** |
| **Pass Rate Required** | **100%** | **100%** |

---

## 5. Test Case Inventory Summary

### Tier 1: Feature Coverage (F1 to F10)
- **F1 (Schema & RLS)**:
  - `test_f1_01_schema_tables_and_columns_definition`: Validates tables `fichas`, `cursos`, `fichas_cursos`.
  - `test_f1_02_foreign_key_and_cascade_constraints`: Validates `ON DELETE CASCADE` from `fichas` to `fichas_cursos`.
  - `test_f1_03_ordem_check_constraint_range_1_to_18`: Validates `CHECK (ordem >= 1 AND ordem <= 18)`.
  - `test_f1_04_unique_constraints_matricula_and_slot`: Validates unique matricula and unique `(ficha_id, ordem)`.
  - `test_f1_05_rls_policies_allow_anon_authenticated`: Validates public RLS policy structure for anon access.

- **F2 (Migration)**:
  - `test_f2_01_sqlite_database_census_280_students`: Verifies exactly 280 distinct students in legacy DB.
  - `test_f2_02_sqlite_enrollment_census_717_links`: Verifies exactly 717 course links in `fichas_cursos`.
  - `test_f2_03_unified_catalog_census_105_distinct_courses`: Verifies 101 cataloged + 4 orphan courses = 105 courses.
  - `test_f2_04_excel_serial_date_conversion_accuracy`: Verifies serial dates (e.g. 41591 -> 2013-11-13) with 0 errors.
  - `test_f2_05_course_ordering_preservation_from_rowid`: Verifies sequential `ordem` 1..N matches legacy order.

- **F3 (App Shell & Client)**:
  - `test_f3_01_nextjs_export_configuration_static_output`: Verifies `output: 'export'` and `trailingSlash: true`.
  - `test_f3_02_github_pages_basepath_auto_resolution`: Verifies dynamic repository `basePath` extraction.
  - `test_f3_03_supabase_client_fallback_credentials`: Verifies URL and anon key fallbacks without missing env crashes.
  - `test_f3_04_typescript_database_types_definition`: Verifies domain types matching Supabase schema.
  - `test_f3_05_shell_layout_microlins_styling_and_nav`: Verifies institutional theme colors and no-print classes.

- **F4 (Student Table & Filters)**:
  - `test_f4_01_realtime_search_by_name`: Searches student by name substring.
  - `test_f4_02_realtime_search_by_matricula`: Searches student by exact or partial matricula.
  - `test_f4_03_column_sorting_by_name_and_matricula`: Sorts student table ascending and descending.
  - `test_f4_04_single_student_selection_toggle`: Selects and deselects individual student rows.
  - `test_f4_05_batch_select_all_and_clear_toggle`: Selects all students and unselects all in one action.

- **F5 (Student Profile CRUD)**:
  - `test_f5_01_required_fields_validation_matricula_and_name`: Rejects missing matricula or missing nome.
  - `test_f5_02_cadastral_profile_data_persistence`: Validates email, telephone, instructor fields.
  - `test_f5_03_nine_pedagogical_lifecycle_dates_handling`: Validates all 9 career cycle dates.
  - `test_f5_04_date_iso_normalization_for_input_fields`: Normalizes date inputs to `YYYY-MM-DD`.
  - `test_f5_05_feedback_notifications_on_success_and_error`: Validates toast notifications contract.

- **F6 (Course Management & Reordering)**:
  - `test_f6_01_catalog_autocomplete_filtering`: Matches course search query against 96/105 courses.
  - `test_f6_02_add_multiple_courses_up_to_18_limit`: Adds up to 18 courses to student profile.
  - `test_f6_03_interactive_reordering_shift_up_and_down`: Reorders courses swapping adjacent positions.
  - `test_f6_04_course_removal_and_slot_compaction`: Removes course and compacts subsequent ordens.
  - `test_f6_05_catalog_auto_expansion_for_new_courses`: Automatically adds novel courses to catalog.

- **F7 (Print Engine A4 Frente & Verso)**:
  - `test_f7_01_frente_layout_conformance_to_model`: Validates 6 blocks of Frente sheet matching `ModeloFicha.xlsx`.
  - `test_f7_02_verso_layout_conformance_to_model`: Validates 3 blocks of Verso sheet matching `ModeloFicha.xlsx`.
  - `test_f7_03_schedule_dialog_and_day_hours_injection`: Verifies injection of schedule into week grid.
  - `test_f7_04_exact_33_log_rows_and_notes_pauled_lines`: Verifies 33 log rows + 5 front / 12 back paged lines.
  - `test_f7_05_print_scale_and_css_media_print_rules`: Validates `@page`, `size: A4 portrait`, margins and scale.

- **F8 (Batch Printing & Page Breaks)**:
  - `test_f8_01_continuous_document_generation_for_selected`: Renders all selected students in single doc.
  - `test_f8_02_page_break_after_page_rule_enforcement`: Verifies `.a4-page` and `break-after: page`.
  - `test_f8_03_include_verso_toggle_behavior`: Switches between 1 page (Frente only) and 2 pages (Frente + Verso).
  - `test_f8_04_last_page_break_avoidance`: Omits unnecessary page break on terminal page.
  - `test_f8_05_batch_schedule_propagation`: Propagates shared schedule config to all batch students.

- **F9 (Client-Side Excel Import/Export)**:
  - `test_f9_01_download_16_column_blank_model_template`: Generates canonical 16-column `.xlsx` template.
  - `test_f9_02_parse_and_validate_populated_excel`: Reads `.xlsx`, parses rows, maps fields.
  - `test_f9_03_csv_courses_splitting_and_trimming`: Splits column 16 by comma, trims, maps to courses.
  - `test_f9_04_upsert_logic_for_existing_matriculas`: Updates existing student data and refreshes courses.
  - `test_f9_05_export_student_list_to_canonical_excel`: Exports students in matching 16-column format.

- **F10 (GitHub Actions CI/CD)**:
  - `test_f10_01_workflow_trigger_branches_main_and_dispatch`: Verifies `push` to main/master & `workflow_dispatch`.
  - `test_f10_02_runner_environment_and_node_version`: Verifies `ubuntu-latest` and Node 22/24 setup.
  - `test_f10_03_build_command_and_required_env_secrets`: Verifies `npm run build` with Supabase secrets.
  - `test_f10_04_pages_artifact_upload_and_deployment`: Verifies `upload-pages-artifact` from `./out`.
  - `test_f10_05_github_pages_permissions_configuration`: Verifies `pages: write` and `id-token: write`.

---

### Tier 2: Boundary & Corner Cases (F1 to F10)
- **F1 Boundaries**:
  - `test_f1_b01_matricula_max_length_boundary_50`: Accepts 50 chars, rejects 51 chars.
  - `test_f1_b02_ordem_boundary_rejection_below_1_and_above_18`: Rejects ordem = 0 and ordem = 19.
  - `test_f1_b03_empty_string_versus_null_handling`: Ensures empty strings convert to NULL for dates.
  - `test_f1_b04_duplicate_matricula_rejection_integrity`: Rejects duplicate matricula insertion.
  - `test_f1_b05_duplicate_course_slot_rejection`: Rejects duplicate `(ficha_id, ordem)` pair.

- **F2 Boundaries**:
  - `test_f2_b01_excel_serial_epoch_boundary_dates`: Validates serial `1` (1900-01-01) and serial `41591` (2013-11-13).
  - `test_f2_b02_two_digit_year_expansion_boundary`: Expands `26` to `2026` and `99` to `1999`.
  - `test_f2_b03_student_with_zero_enrolled_courses`: Migrates students with 0 courses without error (188 students).
  - `test_f2_b04_student_with_maximum_enrolled_courses_15`: Migrates student with 15 courses without truncation.
  - `test_f2_b05_utf8_portuguese_accent_preservation`: Validates raw UTF-8 byte fidelity for `Antônio`, `Diéssica`.

- **F3 Boundaries**:
  - `test_f3_b01_empty_github_actions_env_sets_empty_basepath`: Local development sets basePath `''`.
  - `test_f3_b02_missing_repository_env_handles_gracefully`: Handles malformed `GITHUB_REPOSITORY`.
  - `test_f3_b03_supabase_client_empty_anon_key_falls_back`: Uses default fallback key when env is unset.
  - `test_f3_b04_static_export_trailing_slash_route_mapping`: Verifies `/fichas` translates to `/fichas/index.html`.
  - `test_f3_b05_css_print_media_styles_isolation`: Ensures print styles don't pollute screen display.

- **F4 Boundaries**:
  - `test_f4_b01_search_with_empty_and_whitespace_only_query`: Returns complete list of 280 students.
  - `test_f4_b02_search_with_special_regex_characters`: Handles `[`, `*`, `+`, `?`, `(` without regex crash.
  - `test_f4_b03_search_case_and_accent_insensitive`: Query `antonio` matches `Antônio`.
  - `test_f4_b04_search_non_matching_query_returns_empty`: Query `XYZ999_NON_EXISTENT` returns empty list.
  - `test_f4_b05_batch_selection_state_toggle_interleaving`: Select all -> deselect 1 -> verify indeterminate state.

- **F5 Boundaries**:
  - `test_f5_b01_matricula_empty_or_whitespace_rejection`: Rejects whitespace-only matricula.
  - `test_f5_b02_nome_empty_or_whitespace_rejection`: Rejects whitespace-only nome.
  - `test_f5_b03_leap_year_february_29_handling`: Accepts `2024-02-29`, rejects `2023-02-29`.
  - `test_f5_b04_all_nine_dates_null_acceptable`: Allows saving student with 0 dates filled.
  - `test_f5_b05_telephone_various_formatting_masks`: Handles `(17) 98819-8252` and `17988198252`.

- **F6 Boundaries**:
  - `test_f6_b01_course_reorder_top_item_up_no_op`: Moving item 1 up stays at position 1.
  - `test_f6_b02_course_reorder_bottom_item_down_no_op`: Moving item N down stays at position N.
  - `test_f6_b03_course_slot_exceeding_18_blocked`: Attempting to add 19th course is prevented.
  - `test_f6_b04_course_autocomplete_special_symbols`: Autocomplete handles `C#`, `2D/3D`, `SQL`.
  - `test_f6_b05_remove_middle_course_maintains_contiguous_ordem`: Removing slot 2 of 3 updates 3 to 2.

- **F7 Boundaries**:
  - `test_f7_b01_frente_with_zero_courses_renders_blank_numbered_slots`: Renders 1..18 with empty labels.
  - `test_f7_b02_frente_with_exact_18_courses_fits_geometry`: Renders exactly 18 courses with no overflow.
  - `test_f7_b03_schedule_with_no_days_selected_renders_empty_grid`: Leaves schedule cells blank.
  - `test_f7_b04_time_formatting_edge_variations`: Formats `14` -> `14h00`, `14:30` -> `14h30`, `8` -> `08h00`.
  - `test_f7_b05_missing_optional_cadastral_fields_render_blank`: Null email, tel, instructor render blank.

- **F8 Boundaries**:
  - `test_f8_b01_batch_print_single_student_no_trailing_page`: 1 student generates exactly 1 (or 2) pages.
  - `test_f8_b02_batch_print_large_volume_50_students_continuity`: 50 students generate exactly 100 pages.
  - `test_f8_b03_batch_print_empty_selection_guard`: Attempting batch print with 0 students alerts user.
  - `test_f8_b04_verso_disabled_halves_total_page_count`: 10 students with verso disabled = 10 pages.
  - `test_f8_b05_different_individual_schedules_batch_preservation`: Preserves student-specific schedules.

- **F9 Boundaries**:
  - `test_f9_b01_excel_import_float_formatted_matricula`: Handles `5056188.0` converting to `5056188`.
  - `test_f9_b02_excel_import_dirty_courses_commas_and_spaces`: Cleans ` Excel 2021 , , Power BI `.
  - `test_f9_b03_excel_import_empty_file_or_missing_headers`: Rejects files without 16 required columns.
  - `test_f9_b04_excel_import_row_skips_on_missing_matricula_or_nome`: Skips empty rows with warning log.
  - `test_f9_b05_excel_export_special_characters_escaping`: Escapes quotes, ampersands, commas in export.

- **F10 Boundaries**:
  - `test_f10_b01_workflow_ignores_pull_requests`: Ignores non-main PRs to prevent unnecessary deploys.
  - `test_f10_b02_missing_env_secrets_build_graceful_fallback`: Client fallbacks allow build even if secrets unset.
  - `test_f10_b03_custom_branch_push_does_not_deploy_to_production`: Only main branch triggers deployment.
  - `test_f10_b04_static_build_without_network_dependency`: Static build produces valid `out/` bundle.
  - `test_f10_b05_strict_typecheck_and_lint_workflow_steps`: Workflow verifies `tsc --noEmit` and lint.

---

### Tier 3: Cross-Feature Interactions
- `test_t3_01_excel_import_reorder_courses_print_frente`: Import Excel student -> interactive reorder -> print A4 Frente.
- `test_t3_02_search_filter_batch_select_batch_print`: Filter by instructor -> batch select -> batch print A4.
- `test_t3_03_sqlite_migration_student_profile_update_rls`: Migrate student -> update profile in CRUD -> persist.
- `test_t3_04_course_catalog_add_student_assignment_excel_export`: Add custom course -> assign to student -> export Excel.
- `test_t3_05_student_modal_lifecycle_dates_career_milestones_render`: Update 7 career dates -> verify Frente career block.
- `test_t3_06_excel_template_generation_roundtrip_reimport_table_refresh`: Download template -> fill -> import -> verify in table.
- `test_t3_07_batch_schedule_dialog_batch_print_multi_student`: Configure batch schedule -> batch print -> verify headers.
- `test_t3_08_sqlite_migration_185_serial_dates_modal_display_export`: Migrate serial dates -> verify display -> verify export.
- `test_t3_09_app_shell_navigation_filter_persistence_individual_print`: Navigate -> filter -> open print preview -> verify.
- `test_t3_10_migration_orphan_courses_catalog_autocomplete_student_link`: Orphan courses migrated -> available in autocomplete.

---

### Tier 4: Real-World Application Scenarios
- `test_t4_01_complete_migration_workflow_all_280_students`: Complete legacy migration of 280 students and 717 course links.
- `test_t4_02_end_to_end_pedagogical_lifecycle`: Full student onboarding, 9 dates tracking, 12 courses, print sheet generation.
- `test_t4_03_bulk_administrative_cycle`: Download template -> bulk import 25 students -> filter -> batch print A4.
- `test_t4_04_high_density_student_handling`: Maximum capacity student (18 courses, 6 days schedule, 7 career dates) fits A4.
- `test_t4_05_full_system_data_portability_roundtrip`: SQLite -> Supabase Schema -> Web Table -> Excel Export -> Re-import.

---

## 6. Execution Verification

The E2E Test Suite is executable at any time during development or CI with:
```bash
python tests/run_tests.py
```
This script acts as the definitive quality gate for `SistemaFichas_Web`.
