# SQL INSERT Query Generator

Small browser app to generate `INSERT` queries for PostgreSQL or MySQL from:

- table name
- table structure
- row values in plain text (newline/tab format)

## Features

- Generate multi-row `INSERT INTO ... VALUES ...`
- Choose database type: `PostgreSQL` (default) or `MySQL`
- Accept table structure in JSON, `name:type[:pk]` line format, or plain column names (space/newline separated)
- Basic SQL escaping for strings
- PostgreSQL JSON/JSONB value casting support

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

Column names only:

```txt
id email is_active metadata
```

or:

```txt
id
email
is_active
metadata
```

### 3) Row / Rows

Single row (one value per line, in the same order as table structure):

```txt
1
a@example.com
true
```

Multiple rows (add a blank line between row blocks):

```txt
1
a@example.com
true

2
b@example.com
false
```

Tab-separated rows (one row per line) are also supported:

```txt
1	a@example.com	true
2	b@example.com	false
```

## Add to git

From repo root:

```bash
git add tools/sql-query-generator
git commit -m "Add browser app to generate INSERT SQL queries"
```

Then push to your remote branch/repo.
