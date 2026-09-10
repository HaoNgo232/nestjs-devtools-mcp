# 04: Paginated Observability Tools (nestjs_get_logs, nestjs_get_request_history, nestjs_get_errors)

**What to build:**
Deliver standardized runtime observability tools (`nestjs_get_logs`, `nestjs_get_request_history`, `nestjs_get_errors`) equipped with robust pagination to protect agent context windows. Responses include standard pagination metadata (`total_count`, `has_more`, `next_offset`), rich Markdown views (color-coded HTTP status badges, formatted log streams), and full structured data.

**Blocked by:** 01: Core Migration to McpServer & Modular Architecture

**Status:** completed

- [x] Tools registered as `nestjs_get_logs`, `nestjs_get_request_history`, and `nestjs_get_errors`
- [x] Strict Zod schemas with pagination parameters (`limit`, `offset`) and filtering options
- [x] Pagination response envelope implemented with `total_count`, `has_more`, and `next_offset`
- [x] Tool annotations declared (`readOnlyHint: true`, `idempotentHint: true`)
- [x] Output formatted as clean Markdown summaries highlighting key diagnostic signals (status code classes, error origins)
- [x] Full structured data provided via `structuredContent`
- [x] Unit tests verify pagination bounds, offset slicing, filter propagation, and output formatting
