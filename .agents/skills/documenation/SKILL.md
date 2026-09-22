---
name: product-doc-generator
description: Generates comprehensive product documentation for any application following the Skole documentation standard. Creates module docs, API specs, data-schema references, and all supporting sections in fumadocs-compatible MDX format with meta.json navigation files.
---

# Product Documentation Generator

You are a **Product Documentation Architect**. When the user asks you to generate documentation for an application, you follow this skill to produce a complete, professional documentation suite modeled on a proven 16-section structure.

## Prerequisites

Before generating documentation, you MUST gather the following from the user or from the codebase:

1. **Product Name** — the short name used as prefix (e.g., `SKOLE`, `TRACK`, `NEER`)
2. **Product Description** — one-paragraph summary of what the product does
3. **Component Inventory** — all applications and their tech stacks (backend API, mobile apps, web apps, admin portals)
4. **Module List** — every functional module (e.g., Auth, Dashboard, Attendance, Payments)
5. **Database Schema** — access to the Prisma schema, SQL migrations, or a schema description
6. **API Routes** — access to the route definitions, controllers, or Swagger/OpenAPI specs
7. **Multi-tenancy key** — the primary tenant isolation field (e.g., `skole_id`, `org_id`, `tenant_id`)

If the user has a codebase open, **read the code** to extract this information automatically. If not, ask clarifying questions.

---

## Output Structure

All documentation goes into `content/<product-slug>/` (lowercase, hyphenated). Each top-level section is a directory containing an `index.mdx` and a `meta.json`.

### Directory Layout

```
content/<product-slug>/
├── introduction/
│   ├── index.mdx
│   └── meta.json
├── modules/
│   ├── index.mdx          # Module Registry & Numbering Convention
│   ├── 01-<module>.mdx
│   ├── 02-<module>.mdx
│   ├── ...
│   └── meta.json
├── api/
│   ├── index.mdx          # API Overview & Global Conventions
│   ├── 03-<module>.mdx
│   ├── ...
│   └── meta.json
├── data-schema/
│   ├── index.mdx          # Full database table reference
│   └── meta.json
├── system-design/
│   ├── index.mdx
│   └── meta.json
├── user-guide/
│   ├── index.mdx
│   └── meta.json
├── infrastructure-modules/
│   ├── index.mdx
│   └── meta.json
├── integrations/
│   ├── index.mdx
│   └── meta.json
├── events/
│   ├── index.mdx
│   └── meta.json
├── changelog/
│   ├── index.mdx
│   └── meta.json
├── release-notes/
│   ├── index.mdx
│   └── meta.json
├── roadmap/
│   ├── index.mdx
│   └── meta.json
├── issues/
│   ├── index.mdx
│   └── meta.json
├── recipes/
│   ├── index.mdx
│   └── meta.json
├── docs/
│   └── meta.json
└── documentation/
    └── meta.json
```

---

## File Formats

### meta.json

Every directory needs a `meta.json` for fumadocs navigation. Format:

```json
{
    "title": "Section Title",
    "description": "Brief description of this section",
    "root": true,
    "pages": [
        "index",
        "01-module-name",
        "02-module-name"
    ]
}
```

- Use `"root": true` for top-level sections.
- The `pages` array controls sidebar ordering.
- Simple sections (no child pages) only need `"title"`.

### MDX Frontmatter

Every `.mdx` file starts with YAML frontmatter:

```yaml
---
title: Page Title
description: One-line description of this page's content.
---
```

---

## Section Templates

### 1. Introduction (`introduction/index.mdx`)

```mdx
---
title: Introduction
description: Welcome to the <Product Name> documentation portal.
---

Welcome to the **<Product Name>** documentation portal. Dive straight into our centralized hubs to explore product modules, API interfaces, user guides, internal infrastructure, and much more.
```

---

### 2. Module Index (`modules/index.mdx`)

```mdx
---
title: Module Documentation Index
description: <PRODUCT> Platform — Module Documentation Index
---

**Version:** 1.0 | **Date:** <YYYY-MM-DD> | **Status:** Active

## Platform Overview

<Product Name> is a **<one-line description>** connecting <user types> through <N> coordinated applications backed by a single REST API.

| Component | Technology | Purpose |
|---|---|---|
| `<repo-name>` | <Tech Stack> | <Purpose> |
| ... | ... | ... |

### <Tenant Key> (`<tenant_field>`)
Every entity in the platform is scoped to a **`<tenant_field>`** — a unique identifier for <tenant type>. This is the fundamental multi-tenancy key across all tables.

---

## Module Registry

| Module Code | Module Name | Apps | File |
|---|---|---|---|
| `<PROD>-<MOD>` | <Module Name> | <App List> | [<NN>-<slug>](./<NN>-<slug>) |

---

## Numbering Convention

```
[PROD]-[MOD]-[SUB]-[TYPE][NUM]

<PROD>-AUTH-OAU-FR001
│     │    │   │
│     │    │   └── Item type + number
│     │    └────── Sub-module (3–4 uppercase letters)
│     └─────────── Module (3–4 uppercase letters)
└──────────────────Product = <PROD>
```

### Item Type Suffixes

| Code | Type |
|---|---|
| FR | Functional Requirement |
| NF | Non-Functional Requirement |
| SM | Sub-module / Backlog item |
| CE | Conditional Expression |
| UI | UI Screen |
| UC | UI Component |
| TB | Database Table |
| EP | API Endpoint |
| EX | External Service |

---

## Database Tables Quick Reference

| Table | Module | Description |
|---|---|---|
| `<table_name>` | <MOD> | <Description> |
```

---

### 3. Individual Module (`modules/<NN>-<module>.mdx`)

Each module doc follows this **10-section structure**:

```mdx
---
title: <Module Name> Module
description: <PROD>-<MOD> — <Module Name> Module
---

# <PROD>-<MOD> — <Module Name> Module

**Module ID:** `<PROD>-<MOD>` | **Version:** 1.0 | **Status:** Active
**Products:** <App 1> · <App 2> · <App 3>

---

## 1. Overview

| Field | Value |
|---|---|
| **Module Name** | <Name> |
| **Module Code** | <MOD> |
| **Business Value** | <Why this module exists — business justification> |

### Scope In
- <What IS included>

### Scope Out
- <What is NOT included>

---

## 2. Requirements

### Functional Requirements (FR)
*What the module must DO — actions, behaviors, and outcomes.*

- **<PROD>-<MOD>-FR001:** The module shall <action>.
- **<PROD>-<MOD>-FR002:** The module shall <action>.

### Non-Functional Requirements (NFR)
*How well the module must do it — performance, security, and reliability.*

- **<PROD>-<MOD>-NFR001:** The module shall <quality attribute>.

### Constraints
*Rules and boundaries — tech choices and platform restrictions.*

- **C001:** We must <constraint> because <reason>.

---

## 3. Sub-modules / Backlog

| ID | Sub-module | Priority | Status | Estimate | Linked Requirement |
|---|---|---|---|---|---|
| `<PROD>-<MOD>-SM001` | <Name> | P0 | Done | 3d | FR001–FR003 |

---

## 4. Logical Implementation

### <Flow Name>

```
<HTTP Method> /<route>
  ├─ Input: { <fields> }
  ├─ Step 1: <action>
  │    └─ If <condition> → <result>
  ├─ Step 2: <action>
  └─ Return <output>
```

### Error Handling

| Scenario | HTTP Code | Message |
|---|---|---|
| <scenario> | <code> | "<message>" |

---

## 5. UI Requirements

### <App Name> — <Screen Group>

| ID | Screen | Route | Description |
|---|---|---|---|
| `<PROD>-<MOD>-UI001` | <ScreenName> | `/<route>` | <Description> |

**Components:**

| ID | Component | Props |
|---|---|---|
| `<PROD>-<MOD>-UC001` | `<ComponentName>` | `<prop1>`, `<prop2>` |

### UI States

| Screen | Loading | Empty / First Time | Error |
|---|---|---|---|
| <Screen> | <Loading behavior> | <Empty state> | <Error behavior> |

---

## 6. Conditional Expressions

| ID | Expression | Trigger | True Action | False Action |
|---|---|---|---|---|
| `<PROD>-<MOD>-CE001` | `<expression>` | <When> | <True> | <False> |

---

## 7. Internal Module Connections

| Direction | Module | Data / Event | Condition |
|---|---|---|---|
| <MOD> → <OTHER> | <Module Name> | <Data exchanged> | <When> |

---

## 8. External Connections

| ID | Service | Purpose | Auth Method | Failure Behavior |
|---|---|---|---|---|
| `<PROD>-<MOD>-EX001` | <Service> | <Purpose> | <Auth> | <Failure> |

---

## 9. Database Tables

| ID | Table | Role |
|---|---|---|
| `<PROD>-<MOD>-TB001` | `<table>` | <Role> |

### Key Relationships
- `<table.field>` → `<other_table.field>`

---

## 10. API Endpoints Summary

| ID | Method | Route | Auth | Description |
|---|---|---|---|---|
| `<PROD>-<MOD>-EP001` | <METHOD> | `/<route>` | <Auth> | <Description> |
```

For each endpoint listed in the summary, add a **detailed endpoint specification** below the table. Each detailed endpoint follows this sub-template:

```mdx
### EP001: <Endpoint Short Name>

#### Section 1: Endpoint Summary
<One-paragraph description of what this endpoint does.>

#### Section 2: HTTP Details
- **HTTP Method:** <METHOD>
- **Endpoint URL:** `/<route>`
- **Content-Type:** `application/json`
- **Authentication:** <Public | JWT (role)>
- **Rate Limit:** <limit> requests per minute per IP

#### Section 3: Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `<param>` | <type> | Yes/No | <description> |

*(Or "None required" if no path params)*

#### Section 4: Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `<param>` | <type> | Yes/No | <description> |

*(Or "None required" if no query params)*

#### Section 5: Request Body Schema
```json
{
  "<field>*": "<Type> (<validation rules>)",
  "<optional_field>": "<Type> (<description>)"
}
```
*(Fields marked with * are required)*

#### Section 6: Response Schema (Success - <HTTP Code>)
```json
{
  "success": true,
  "message": "<success message>",
  "data": { ... }
}
```

#### Section 7: Error Responses
| HTTP Code | Error Code | When |
|---|---|---|
| <code> | <ERROR_CODE> | <condition> |

#### Section 8: Example (cURL)
```bash
curl -X <METHOD> http://localhost:3000/<route> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{ ... }'
```

#### Section 9: Notes / Special Behaviors
- <Any edge cases, business logic notes, or sibling/tenant-related behavior>
```

---

### 4. API Index (`api/index.mdx`)

The API overview follows a **12-section structure** per API group:

```mdx
---
title: <Product> API — Overview & Authentication
description: Global API conventions and the complete Authentication specification.
---

Welcome to the <Product> API Reference. This documentation provides a comprehensive guide to the endpoints powering the platform, following a strict 12-section professional standard for every module.

## Global Conventions

<Callout title="Base URLs" type="info">
- **<App 1>:** `/<base-path-1>`
- **<App 2>:** `/<base-path-2>`
</Callout>

### Authentication Strategy
<How auth works globally>

### Multi-Tenancy
<How tenant isolation works>
```

Each individual API module doc (`api/<NN>-<module>.mdx`) follows this 12-section structure:

```mdx
---
title: <Module Name>
description: <One-line API description>
---

## 1. API Purpose
<Why this API group exists>

## 2. Endpoint Definition
| Method | Route | Auth | Description |
|---|---|---|---|

## 3. Authentication Flow
<Step-by-step auth flow for this module>

## 4. Request Structure
<Per-endpoint request bodies with JSON examples>

## 5. Response Structure
<Per-endpoint success responses with JSON examples>

## 6. Error Responses
| HTTP Code | Error Code | Description |
|---|---|---|

## 7. Security Considerations
<Security notes specific to this module>

## 8. Token Usage
<How to include auth tokens>

## 9. Token Refresh
<Refresh strategy>

## 10. Logout / Session Invalidation
<Logout behavior>

## 11. Usage Example (cURL)
<Complete cURL example>

## 12. Notes / Special Behaviors
<Edge cases and gotchas>
```

---

### 5. Data Schema (`data-schema/index.mdx`)

Group tables into logical domains:

```mdx
---
title: Data Schema & Technical Specification
description: Comprehensive technical specification of the database schema.
---

## 1. <Domain Name> (e.g., "Core & Institutional Identity")

<Brief description of this domain>

### `<table_name>`
<One-line description>

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `<column>` | `<Type>` | <PK, FK, Unique, Not Null, etc.> | <Description> |

---

## Relational Architecture

### 1. Multi-Tenancy Logic
<Explain tenant isolation>

### 2. <Key Relationship Pattern>
<Explain non-obvious relationships>

### 3. Soft Deletion Policy
<Explain deletion strategy>
```

---

### 6. Release Notes (`release-notes/index.mdx`)

```mdx
---
title: Release Notes
description: Detailed highlights of latest features and improvements.
---

## <App Name>

### v<X.Y.Z>: <Release Title>
*<One-line tagline summarizing the theme>*

- **<Feature Name>**: <User-facing description of what changed and why it matters>
```

---

### 7. Other Sections

For sections that are **stubs awaiting content** (events, integrations, recipes, roadmap, issues, etc.), create a minimal placeholder:

```mdx
---
title: <Section Name>
description: <Brief description of what this section will contain.>
---

# <Section Name>

<Description of what this section will contain when populated.>
```

---

## Execution Workflow

When generating documentation for a new product, follow this order:

1. **Analyze** — Read the codebase (schema, routes, controllers, services) to extract all modules, endpoints, tables, and relationships.
2. **Create directory structure** — Set up all 16 section directories under `content/<product-slug>/`.
3. **Write `meta.json` files** — Create navigation configs for every directory.
4. **Write Introduction** — The welcome page.
5. **Write Module Index** — Platform overview, module registry, numbering convention, and DB quick reference.
6. **Write Individual Modules** — One `.mdx` per module using the 10-section template. Start with Auth, then core modules.
7. **Write API Index** — Global conventions and auth API overview.
8. **Write Individual API Docs** — One `.mdx` per API module using the 12-section template.
9. **Write Data Schema** — Full table reference grouped by domain.
10. **Write Release Notes** — Version history with user-facing descriptions.
11. **Write Remaining Sections** — System design, user guide, infrastructure, integrations, events, changelog, roadmap, issues, recipes, and documentation stubs.
12. **Verify** — Check all `meta.json` page arrays match actual files. Ensure all cross-references link correctly.

---

## Quality Standards

- **Numbering is sacred**: Every requirement, endpoint, screen, component, table, and conditional expression gets a unique ID following the `[PROD]-[MOD]-[TYPE][NUM]` pattern.
- **Tables are king**: Use markdown tables extensively for structured data. Avoid prose where a table is clearer.
- **JSON examples are mandatory**: Every API endpoint must have full request and response JSON examples.
- **Cross-references**: Module docs should link to related API docs and vice versa.
- **Callout components**: Use `<Callout>` for important notes (fumadocs component).
- **Consistent HTTP status codes**: Always document both success and error response codes.
- **cURL examples**: Every API module must include at least one working cURL example.
- **Multi-tenancy awareness**: Every table and endpoint doc must mention the tenant isolation field.

---

## Important Notes

- This skill generates documentation for the **fumadocs** framework (Next.js-based). All files are `.mdx` with YAML frontmatter.
- The documentation site uses `fumadocs-mdx` for content processing and `fumadocs-ui` for the UI.
- Content is defined in `source.config.ts` pointing to the `content/` directory.
- Do NOT generate the Next.js app scaffold — only the `content/` directory files.
- When the user says "generate docs for X", analyze their codebase first, then produce the full documentation suite.
