# Architecture: {{PROJECT_NAME}}

## System Overview
_High-level description of the system architecture._

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | _e.g., Node.js 20_ | _Why_ |
| Framework | _e.g., Express_ | _Why_ |
| Database | _e.g., PostgreSQL_ | _Why_ |
| Testing | _e.g., Vitest_ | _Why_ |

## Component Architecture

```
┌─────────────┐     ┌─────────────┐
│  Component A │────▶│  Component B │
└─────────────┘     └─────────────┘
        │
        ▼
┌─────────────┐
│  Component C │
└─────────────┘
```

### Component A
- **Responsibility:** _What it does_
- **Interface:** _How other components interact with it_

### Component B
- **Responsibility:** _What it does_
- **Interface:** _How other components interact with it_

## Data Model

### Entity: _Name_
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| _field_ | _type_ | _description_ |

## API Design

### Endpoint: _METHOD /path_
- **Purpose:** _What it does_
- **Input:** _Request body/params_
- **Output:** _Response format_

## Security Considerations
- _Authentication approach_
- _Authorization model_
- _Data encryption_

## Coding Conventions
- _Naming conventions_
- _File organization_
- _Error handling patterns_
- _Testing patterns_

## Deployment
- _How the system is deployed_
- _Environment configuration_
