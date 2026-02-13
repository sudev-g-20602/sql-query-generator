# SQL / PSQL Query Generator

Small browser app to generate PostgreSQL-friendly `INSERT` or `UPDATE` queries from:

- table name
- table structure
- row or rows JSON

## Features

- Generate multi-row `INSERT INTO ... VALUES ...`
- Generate one or many `UPDATE ... SET ... WHERE ...`
- Accept table structure in JSON or line format
- Basic SQL escaping for strings
- JSON/JSONB value casting support

## Run locally

No install required.

1. Open `index.html` directly in your browser
2. Fill input fields
3. Click **Generate query**

## Input format

### 1) Table Name

Examples:

- `users`
- `public.users`

### 2) Table Structure

Recommended JSON format:

```json
[
  { "name": "id", "type": "bigint", "primaryKey": true },
  { "name": "email", "type": "text" },
  { "name": "is_active", "type": "boolean" },
  { "name": "metadata", "type": "jsonb" }
]
```

Alternative line format:

```txt
id:bigint:pk
email:text
is_active:boolean
metadata:jsonb
```

### 3) Row / Rows

Single row:

```json
{ "id": 1, "email": "a@example.com", "is_active": true }
```

Multiple rows:

```json
[
  { "id": 1, "email": "a@example.com", "is_active": true },
  { "id": 2, "email": "b@example.com", "is_active": false }
]
```

## Notes for UPDATE

- If `primaryKey: true` is set in table structure, those columns are used in `WHERE`.
- If no primary key is marked, it tries to use `id`.
- At least one non-key column must be present for `SET`.

## Add to git

From repo root:

```bash
git add tools/sql-query-generator
git commit -m "Add browser app to generate INSERT/UPDATE SQL queries"
```

Then push to your remote branch/repo.
