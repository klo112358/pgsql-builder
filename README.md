# pgsql-builder

A SQL builder for PostgreSQL.

## Usage

```javascript
const sql = require("pgsql-builder")
```

### Basic

#### sql

The `sql` function can be called to insert an identifier into somewhere a value is expected (e.g. the right-hand side of a where criteria)

```javascript
sql.select("*").from("person").where({ name: sql("nickname") })
// {"text": "SELECT * FROM person WHERE name = nickname", "values": [] }
```

The `sql` function can also be used as a tag for template literals to generate raw SQL.

```javascript
sql.select(sql`COUNT(*)`.as("count")).from("person")
// {"text": "SELECT COUNT(*) AS count FROM person", "values": [] }
```

#### sql.val

The `sql.val` function can be called to insert a value into somewhere a value is not expected (e.g. in raw sql, or in join condition)

```javascript
sql`SELECT * FROM person WHERE name = ${sql.val("John")}`
// {"text": "SELECT * FROM person WHERE name = $1", "values": ["John"] }
```

#### toString, toParams

Most object generated by this library will have two function: `toString` and `toParams`. `toString` returns the non-parameterized SQL for the object, while `toParams` returns an object with two properties: a parameterized `text` string and a `values` array.

In theory, `toString` should be safe and should not cause any SQL injection. However, it is recommended to use `toParams` instead.

### Select Statement

```javascript
sql.select("*").from("person")
// {"text": "SELECT * FROM person", "values": [] }
```

#### select
```javascript
stmt.select(...columns)
```
Appends additional columns to an existing query.

#### distinct
```javascript
stmt.distinct(...columns)
```
Add `DISTINCT` to the query. If columns are provided, the query becomes a `DISTINCT ON (...columns)` query.

#### into
```javascript
stmt.into(table)
```
Makes the query a `SELECT ... INTO` query.

#### from
```javascript
stmt.from(table)
```

#### join, leftjoin, rightjoin, fulljoin
```javascript
stmt.join(table, criteria)
```
Add the specified join to the query.

#### where

#### having