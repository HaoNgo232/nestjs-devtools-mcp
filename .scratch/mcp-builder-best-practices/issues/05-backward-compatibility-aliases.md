# 05: Backward Compatibility & Deprecation Aliases

**What to build:**
Ensure non-breaking upgrade experience for existing clients by exposing legacy tool names (`discover_servers`, `get_logs`, `get_routes`, `get_request_history`, `get_config`, `get_errors`) as compatibility aliases. Each legacy tool redirects execution to the new standardized tool handler while marking the tool as deprecated in its description.

**Blocked by:** 
- 02: Standardize Discovery & Runtime Tools (nestjs_discover_servers)
- 03: Modernize Routes and Configuration Inspection Tools
- 04: Paginated Observability Tools (nestjs_get_logs, nestjs_get_request_history, nestjs_get_errors)

**Status:** completed

- [x] Legacy tool aliases are registered and point to their modern handler counterparts
- [x] Tool descriptions clearly flag legacy names as deprecated and recommend the `nestjs_*` variants
- [x] Existing client calls using legacy parameter names continue to function transparently
- [x] Unit tests verify that calling legacy tool names yields the same results as standardized tools
