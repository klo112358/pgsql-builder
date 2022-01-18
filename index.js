"use strict";
Object.defineProperty(exports, '__esModule', { value: true });

const pgf = require("pg-format");

let PREFER_IDENT = false
function mapObject(obj, fn) {
    return Object.keys(obj).map((k) => fn(obj[k], k));
}
function isEmpty(obj) {
    if (!obj) {
        return true;
    }
    if (typeof obj !== "object") {
        return false;
    }
    return Object.keys(obj).length === 0;
}
function isNull(obj) {
    return obj === null || (obj instanceof Literal && obj.val === null)
}
function compact(obj) {
    return Object.keys(obj).reduce((map, k) => {
        const v = obj[k];
        if (v !== undefined) {
            map[k] = v;
        }
        return map;
    }, {});
}
function strPlain(val) {
    if (val instanceof SQLObject) {
        return val.toString();
    }
    else {
        return pgf.string(val);
    }
}
function paramPlain(values, val) {
    if (val instanceof SQLObject) {
        return val._toParams(values);
    }
    else {
        return pgf.string(val);
    }
}
function strValue(val, noArray) {
    if (val instanceof Unknown) {
        if (PREFER_IDENT && typeof val.val === "string") {
            return strIdent(val.val)
        } else {
            return strValue(val.val, noArray)
        }
    }
    if (val instanceof Statement) {
        return "(" + val.toString() + ")";
    }
    else if (val instanceof SQLObject) {
        return val.toString();
    }
    else if (Array.isArray(val)) {
        if (noArray) {
            return "(" + val.map((v) => strValue(v, noArray)).join(", ") + ")";
        }
        else {
            return "ARRAY[" + val.map((v) => strValue(v, noArray)).join(", ") + "]";
        }
    }
    else {
        return pgf.literal(val);
    }
}
function paramValue(values, val, noArray) {
    if (val instanceof Unknown) {
        if (PREFER_IDENT && typeof val.val === "string") {
            return paramIdent(values, val.val)
        } else {
            return paramValue(values, val.val, noArray)
        }
    }
    if (val instanceof Statement) {
        return "(" + val._toParams(values) + ")";
    }
    else if (val instanceof SQLObject) {
        return val._toParams(values);
    }
    else if (Array.isArray(val)) {
        if (noArray) {
            return "(" + val.map((v) => paramValue(values, v, noArray)).join(", ") + ")";
        }
        else {
            return "ARRAY[" + val.map((v) => paramValue(values, v, noArray)).join(", ") + "]";
        }
    }
    else {
        values.push(val);
        return `$${values.length}`;
    }
}
function strIdent(val) {
    if (val instanceof Statement) {
        return "(" + val.toString() + ")";
    }
    else if (val instanceof SQLObject) {
        return val.toString();
    }
    else if (Array.isArray(val)) {
        return "(" + val.map((v) => strIdent(v)).join(", ") + ")";
    }
    else if (typeof val === "string") {
        let prefix = "";
        const dot_ix = val.lastIndexOf(".");
        if (dot_ix > -1) {
            prefix = val.slice(0, dot_ix);
            val = val.slice(dot_ix + 1);
        }
        let suffix = "";
        const space_ix = val.indexOf(" ");
        if (space_ix > -1) {
            suffix = val.slice(space_ix);
            val = val.slice(0, space_ix);
        }
        return ((prefix
            ? prefix === "EXCLUDED"
                ? prefix
                : pgf.ident(prefix) + "."
            : "") +
            (val === "*" ? val : pgf.ident(val)) +
            suffix);
    }
    else {
        return pgf.ident(val);
    }
}
function paramIdent(values, val) {
    if (val instanceof Statement) {
        return "(" + val._toParams(values) + ")";
    }
    else if (val instanceof SQLObject) {
        return val._toParams(values);
    }
    else if (Array.isArray(val)) {
        return "(" + val.map((v) => paramIdent(values, v)).join(", ") + ")";
    }
    else {
        return strIdent(val);
    }
}
function strJsonItem(k, v, prefix) {
    return (strValue(k) + ", " + (prefix ? strIdent(prefix) + "." : "") + strIdent(v));
}
function paramJsonItem(values, k, v, prefix) {
    return (strValue(k) +
        ", " +
        (prefix ? paramIdent(values, prefix) + "." : "") +
        paramIdent(values, v));
}
function sql(first, ...rest) {
    if (first instanceof SQLObject) {
        return first
    }
    if (typeof first === "string") {
        return new Identifier(first);
    }
    return new Plain(first, rest);
}
class SQLObject {
    toParams() {
        const values = [];
        return {
            text: this._toParams(values),
            values,
        };
    }
}
class Aliasable extends SQLObject {
    as(alias) {
        return new As(this, alias);
    }
}
class Plain extends Aliasable {
    parts;
    args;
    constructor(parts, args) {
        super();
        this.parts = parts;
        this.args = args;
    }
    toString() {
        let str = this.parts[0];
        for (let i = 1; i < this.parts.length; i += 1) {
            str += strPlain(this.args[i - 1]) + this.parts[i];
        }
        return pgf.string(str);
    }
    _toParams(values) {
        let str = this.parts[0];
        for (let i = 1; i < this.parts.length; i += 1) {
            str += paramPlain(values, this.args[i - 1]) + this.parts[i];
        }
        return pgf.string(str);
    }
}
class Literal extends Aliasable {
    val;
    _type;
    constructor(val) {
        super();
        this.val = val;
    }
    cast(type) {
        this._type = type;
        return this;
    }
    toString() {
        return strValue(this.val) + (this._type ? "::" + this._type : "");
    }
    _toParams(values) {
        values.push(this.val);
        return `$${values.length}${this._type ? "::" + this._type : ""}`;
    }
}
sql.val = (str) => {
    if (str instanceof SQLObject) {
        return str
    }
    return new Literal(str);
};
class Identifier extends Aliasable {
    text;
    _only = false;
    constructor(text) {
        super();
        this.text = text;
    }
    only() {
        this._only = true;
        return this;
    }
    toString() {
        return (this._only ? "ONLY " : "") + strIdent(this.text);
    }
    _toParams(values) {
        return (this._only ? "ONLY " : "") + paramIdent(values, this.text);
    }
}
class Unknown extends SQLObject {
    val;
    constructor(val) {
        super();
        this.val = val;
    }
    toString() {
        throw new Error();
    }
    _toParams(values) {
        throw new Error();
    }
}
class As extends SQLObject {
    ident;
    alias;
    constructor(ident, alias) {
        super();
        this.ident = ident;
        this.alias = alias;
    }
    toString() {
        return strIdent(this.ident) + " AS " + pgf.ident(this.alias);
    }
    _toParams(values) {
        const r1 = paramIdent(values, this.ident);
        const r2 = paramIdent(values, this.alias);
        return r1 + " AS " + r2;
    }
}
class Join extends SQLObject {
    type;
    tbl;
    expr;
    constructor(type, tbl, on) {
        super();
        this.type = type;
        this.tbl = tbl;
        this.expr = on ? parseWhereClause(on) : undefined;
    }
    toString() {
        const text = this.type + " " + strIdent(this.tbl);
        if (!this.expr) {
            return text;
        }
        try {
            PREFER_IDENT = true;
            return text + " ON " + this.expr.toString();
        } finally {
            PREFER_IDENT = false;
        }
    }
    _toParams(values) {
        const r1 = paramIdent(values, this.tbl);
        const text = this.type + " " + r1;
        if (!this.expr) {
            return text
        }
        try {
            PREFER_IDENT = true;
            return text + " ON " + this.expr._toParams(values);
        } finally {
            PREFER_IDENT = false;
        }
    }
}
class Statement extends Aliasable {
}
class Values extends SQLObject {
    _values = [];
    _alias;
    values(...values) {
        this._values.push(...values);
        return this;
    }
    as(alias) {
        this._alias = alias;
        return this;
    }
    toString() {
        if (!this._alias) {
            throw new Error("values must have an alias");
        }
        if (!this._values[0]) {
            throw new Error("must have at least one value");
        }
        const keys = Object.keys(this._values[0]);
        return ("(VALUES " +
            this._values
                .map((vs) => {
                return "(" + keys.map((key) => strValue(vs[key])).join(", ") + ")";
            })
                .join(", ") +
            ") " +
            pgf.ident(this._alias) +
            "(" +
            keys.map((key) => pgf.ident(key)).join(", ") +
            ")");
    }
    _toParams(values) {
        if (!this._alias) {
            throw new Error("values must have an alias");
        }
        if (!this._values[0]) {
            throw new Error("must have at least one value");
        }
        const keys = Object.keys(this._values[0]);
        return ("(VALUES " +
            this._values
                .map((vs) => {
                return ("(" +
                    keys.map((key) => paramValue(values, vs[key])).join(", ") +
                    ")");
            })
                .join(", ") +
            ") " +
            pgf.ident(this._alias) +
            "(" +
            keys.map((key) => pgf.ident(key)).join(", ") +
            ")");
    }
}
sql.values = (...values) => {
    const v = new Values();
    v.values(...values);
    return v;
};
class SelectStatement extends Statement {
    _columns = [];
    _from = [];
    _group = [];
    _order = [];
    _joins = [];
    _where;
    _having;
    _distinct;
    _into = "";
    _limit;
    _offset;
    select(...columns) {
        this._columns.push(...columns);
        return this;
    }
    distinct(...cols) {
        this._distinct = cols;
        return this;
    }
    into(tbl) {
        this._into = tbl;
        return this;
    }
    from(...args) {
        this._from.push(...args);
        return this;
    }
    join(tbl, on) {
        return this._join("INNER JOIN", tbl, on);
    }
    leftjoin(tbl, on) {
        return this._join("LEFT JOIN", tbl, on);
    }
    rightjoin(tbl, on) {
        return this._join("RIGHT JOIN", tbl, on);
    }
    fulljoin(tbl, on) {
        return this._join("FULL JOIN", tbl, on);
    }
    crossjoin(tbl) {
        return this._join("CROSS JOIN", tbl);
    }
    _join(type, tbl, on) {
        if (this._from.length === 0) {
            throw new Error("cannot call join before from");
        }
        this._joins.push([this._from.length - 1, new Join(type, tbl, on)]);
        return this;
    }
    where(...clauses) {
        this._where = sql.and(this._where, ...clauses);
        return this;
    }
    having(...clauses) {
        this._having = sql.and(this._having, ...clauses);
        return this;
    }
    group(...columns) {
        this._group.push(...columns);
        return this;
    }
    order(...columns) {
        this._order.push(...columns);
        return this;
    }
    limit(limit) {
        this._limit = limit;
        return this;
    }
    offset(offset) {
        this._offset = offset;
        return this;
    }
    toString() {
        let str = "SELECT ";
        if (this._distinct) {
            str += "DISTINCT ";
            if (this._distinct.length > 0) {
                str += "ON (" + this._distinct.map((c) => strIdent(c)).join(", ") + ") ";
            }
        }
        str += this._columns.map((c) => strIdent(c)).join(", ");
        if (this._into) {
            str += " INTO " + strIdent(this._into);
        }
        if (this._from.length > 0) {
            str +=
                " FROM " +
                    this._from
                        .map((f, i) => {
                        let s = strIdent(f);
                        for (const [index, join] of this._joins) {
                            if (index === i) {
                                s += " " + join.toString();
                            }
                        }
                        return s;
                    })
                        .join(", ");
        }
        if (this._where) {
            const s = this._where.toString();
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._group.length > 0) {
            str += " GROUP BY " + this._group.map((f) => strIdent(f)).join(", ");
        }
        if (this._having) {
            const s = this._having.toString();
            if (s) {
                str += " HAVING " + s;
            }
        }
        if (this._order.length > 0) {
            str +=
                " ORDER BY " +
                    this._order.map(([by, dir]) => strIdent(by) + " " + dir).join(", ");
        }
        if (this._limit !== undefined) {
            str += " LIMIT " + Math.floor(this._limit);
        }
        if (this._offset !== undefined) {
            str += " OFFSET " + Math.floor(this._offset);
        }
        return str;
    }
    _toParams(values) {
        let str = "SELECT ";
        if (this._distinct) {
            str += "DISTINCT ";
            if (this._distinct.length > 0) {
                str +=
                    "ON (" +
                        this._distinct.map((c) => paramIdent(values, c)).join(", ") +
                        ") ";
            }
        }
        str += this._columns.map((c) => paramIdent(values, c)).join(", ");
        if (this._into) {
            str += " INTO " + paramIdent(values, this._into);
        }
        if (this._from.length > 0) {
            str +=
                " FROM " +
                    this._from
                        .map((f, i) => {
                        let s = paramIdent(values, f);
                        for (const [index, join] of this._joins) {
                            if (index === i) {
                                s += " " + join._toParams(values);
                            }
                        }
                        return s;
                    })
                        .join(", ");
        }
        if (this._where) {
            const s = this._where._toParams(values);
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._group.length > 0) {
            str +=
                " GROUP BY " + this._group.map((f) => paramIdent(values, f)).join(", ");
        }
        if (this._having) {
            const s = this._having._toParams(values);
            if (s) {
                str += " HAVING " + s;
            }
        }
        if (this._order.length > 0) {
            str +=
                " ORDER BY " +
                    this._order
                        .map(([by, dir]) => paramIdent(values, by) + " " + dir)
                        .join(", ");
        }
        if (this._limit !== undefined) {
            str += " LIMIT " + Math.floor(this._limit);
        }
        if (this._offset !== undefined) {
            str += " OFFSET " + Math.floor(this._offset);
        }
        return str;
    }
}
sql.select = (...columns) => {
    const stmt = new SelectStatement();
    stmt.select(...columns);
    return stmt;
};
class WriteStatement extends Statement {
    _returning = [];
    table;
    constructor(table) {
        super();
        this.table = strIdent(table);
    }
    returning(...columns) {
        this._returning.push(...columns);
        return this;
    }
}
class InsertStatement extends WriteStatement {
    _values = [];
    _columns = [];
    _subquery;
    _conflict;
    _constraint;
    _update = {};
    values(...values) {
        if (this._subquery) {
            throw new Error("a select statement already exists");
        }
        this._values.push(...values);
        return this;
    }
    columns(...columns) {
        this._columns.push(...columns);
        return this;
    }
    select(subquery) {
        if (this._subquery) {
            throw new Error("a select statement already exists");
        }
        if (this._values.length) {
            throw new Error("insert values already exists");
        }
        this._subquery = subquery;
        return this;
    }
    onConflict(...columns) {
        this._conflict = columns;
        return this;
    }
    constraint(constraint) {
        this._constraint = constraint;
        return this;
    }
    doNothing() {
        return this;
    }
    doUpdate(...values) {
        for (const value of values) {
            if (typeof value === "string") {
                this._update[value] = sql`EXCLUDED.${sql(value)}`
            } else {
                mapObject(value, (v, k) => {
                    if (v !== undefined && this._update[k] === undefined) {
                        this._update[k] = v;
                    }
                });
            }
        }
        return this;
    }
    toString() {
        let str = "INSERT INTO " + this.table;
        if (this._subquery) {
            if (this._columns.length) {
                str += "(" + this._columns.map((c) => strIdent(c)).join(", ") + ")";
            }
            str += " " + strPlain(this._subquery);
        }
        else if (this._values[0]) {
            const keys = Object.keys(this._values[0]);
            str += "(" + keys.map((key) => pgf.ident(key)).join(", ") + ") VALUES ";
            str += this._values
                .map((vs) => {
                return ("(" +
                    keys
                        .map((key) => vs[key] === undefined ? "DEFAULT" : strValue(vs[key]))
                        .join(", ") +
                    ")");
            })
                .join(", ");
        }
        else {
            throw new Error("insert empty rows");
        }
        if (this._conflict || this._constraint) {
            str += " ON CONFLICT";
            if (this._constraint) {
                str += " ON CONSTRAINT " + strIdent(this._constraint);
            }
            else if (this._conflict?.length) {
                str += " (" + this._conflict.map((c) => strIdent(c)).join(", ") + ")";
            }
            if (isEmpty(this._update)) {
                str += " DO NOTHING";
            }
            else {
                str += " DO UPDATE SET ";
                str += mapObject(this._update, (value, key) => {
                    return strIdent(key) + " = " + strValue(value);
                }).join(", ");
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => strIdent(c));
        }
        return str;
    }
    _toParams(values) {
        let str = "INSERT INTO " + this.table;
        if (this._subquery) {
            if (this._columns.length) {
                str +=
                    "(" + this._columns.map((c) => paramIdent(values, c)).join(", ") + ")";
            }
            str += " " + paramPlain(values, this._subquery);
        }
        else if (this._values[0]) {
            const keys = Object.keys(this._values[0]);
            str += "(" + keys.map((key) => pgf.ident(key)).join(", ") + ") VALUES ";
            str += this._values
                .map((vs) => {
                return ("(" +
                    keys
                        .map((key) => vs[key] === undefined ? "DEFAULT" : paramValue(values, vs[key]))
                        .join(", ") +
                    ")");
            })
                .join(", ");
        }
        else {
            throw new Error("insert empty rows");
        }
        if (this._conflict || this._constraint) {
            str += " ON CONFLICT";
            if (this._constraint) {
                str += " ON CONSTRAINT " + paramIdent(values, this._constraint);
            }
            else if (this._conflict?.length) {
                str +=
                    " (" +
                        this._conflict.map((c) => paramIdent(values, c)).join(", ") +
                        ")";
            }
            if (isEmpty(this._update)) {
                str += " DO NOTHING";
            }
            else {
                str += " DO UPDATE SET ";
                str += mapObject(this._update, (value, key) => {
                    return paramIdent(values, key) + " = " + paramValue(values, value);
                }).join(", ");
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => paramIdent(values, c));
        }
        return str;
    }
}
sql.insert = (tbl) => {
    return new InsertStatement(tbl);
};
class UpdateStatement extends WriteStatement {
    _values = {};
    _from = [];
    _where;
    set(...values) {
        for (const value of values) {
            mapObject(value, (v, k) => {
                if (v !== undefined && this._values[k] === undefined) {
                    this._values[k] = v;
                }
            });
        }
        return this;
    }
    from(...args) {
        this._from.push(...args);
        return this;
    }
    where(...clauses) {
        this._where = sql.and(this._where, ...clauses);
        return this;
    }
    toString() {
        if (isEmpty(this._values)) {
            throw new Error("update statment has empty values");
        }
        let str = "UPDATE " + this.table + " SET ";
        str += mapObject(this._values, (value, key) => {
            return strIdent(key) + " = " + strValue(value);
        }).join(", ");
        if (this._from.length > 0) {
            str += " FROM " + this._from.map((f) => strIdent(f)).join(", ");
        }
        if (this._where) {
            const s = this._where.toString();
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => strIdent(c));
        }
        return str;
    }
    _toParams(values) {
        if (isEmpty(this._values)) {
            throw new Error("update statment has empty values");
        }
        let str = "UPDATE " + this.table + " SET ";
        str += mapObject(this._values, (value, key) => {
            return paramIdent(values, key) + " = " + paramValue(values, value);
        }).join(", ");
        if (this._from.length > 0) {
            str += " FROM " + this._from.map((f) => paramIdent(values, f)).join(", ");
        }
        if (this._where) {
            const s = this._where._toParams(values);
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => paramIdent(values, c));
        }
        return str;
    }
}
sql.update = (tbl) => {
    return new UpdateStatement(tbl);
};
class DeleteStatement extends WriteStatement {
    _where;
    _using = [];
    where(...clauses) {
        this._where = sql.and(this._where, ...clauses);
        return this;
    }
    using(...args) {
        this._using.push(...args);
        return this;
    }
    toString() {
        let str = "DELETE FROM " + this.table;
        if (this._using.length > 0) {
            str += " USING " + this._using.map((f) => strIdent(f)).join(", ");
        }
        if (this._where) {
            const s = this._where.toString();
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => strIdent(c));
        }
        return str;
    }
    _toParams(values) {
        let str = "DELETE FROM " + this.table;
        if (this._using.length > 0) {
            str +=
                " USING " + this._using.map((f) => paramIdent(values, f)).join(", ");
        }
        if (this._where) {
            const s = this._where._toParams(values);
            if (s) {
                str += " WHERE " + s;
            }
        }
        if (this._returning.length) {
            str += " RETURNING " + this._returning.map((c) => paramIdent(values, c));
        }
        return str;
    }
}
sql.delete = (tbl) => {
    return new DeleteStatement(tbl);
};
class Expression extends SQLObject {
}
class RawExpression extends Expression {
    _raw;
    constructor(_raw) {
        super();
        this._raw = _raw;
    }
    toString() {
        return this._raw.toString();
    }
    _toParams(values) {
        return this._raw._toParams(values);
    }
}
class Group extends Expression {
    expressions;
    constructor(expressions) {
        super();
        this.expressions = expressions;
    }
    toString() {
        return this.expressions
            .map((expr) => {
                const str = expr.toString();
                if (!str) {
                    return "";
                }
                else if (expr instanceof Group) {
                    return "(" + str + ")";
                }
                else {
                    return str;
                }
            })
            .filter((x) => x)
            .join(this.op);
    }
    _toParams(values) {
        return this.expressions
            .map((expr) => {
                const str = expr._toParams(values);
                if (!str) {
                    return "";
                }
                else if (expr instanceof Group) {
                    return "(" + str + ")";
                }
                else {
                    return str;
                }
            })
            .filter((x) => x)
            .join(this.op);
    }
}
class And extends Group {
    op = " AND ";
    constructor(expressions) {
        super(expressions.flatMap((expr) => {
            if (expr instanceof And || (expr instanceof Group && expr.expressions.length <= 1)) {
                return expr.expressions;
            }
            return [expr];
        }));
    }
}
class Or extends Group {
    op = " OR ";
    constructor(expressions) {
        super(expressions.flatMap((expr) => {
            if (expr instanceof Or || (expr instanceof Group && expr.expressions.length <= 1)) {
                return expr.expressions;
            }
            return [expr];
        }));
    }
}
class Not extends Expression {
    expression;
    constructor(expression) {
        super();
        this.expression = expression;
    }
    toString() {
        if (this.expression instanceof Not) {
            return this.expression.expression.toString();
        }
        return "NOT (" + this.expression.toString() + ")";
    }
    _toParams(values) {
        if (this.expression instanceof Not) {
            return this.expression.expression._toParams(values);
        }
        return "NOT (" + this.expression._toParams(values) + ")";
    }
}
sql.not = (...clauses) => {
    const exprs = clauses.map((c) => parseWhereClause(c))
    return new Not(exprs.length === 1 ? exprs[0] : new And(exprs));
};
class Exists extends Expression {
    subquery;
    constructor(subquery) {
        super();
        this.subquery = subquery;
    }
    toString() {
        return "EXISTS (" + strPlain(this.subquery) + ")";
    }
    _toParams(values) {
        return "EXISTS (" + paramPlain(values, this.subquery) + ")";
    }
}
sql.exists = (subquery) => {
    return new Exists(subquery);
};
class OpExpression extends Expression {
    column;
    operation;
    constructor(column, operation) {
        super();
        this.column = column;
        this.operation = operation;
    }
    toString() {
        if (!this.operation.isValid()) {
            return "";
        }
        return strIdent(this.column) + " " + this.operation.toString();
    }
    _toParams(values) {
        if (!this.operation.isValid()) {
            return "";
        }
        const r1 = paramIdent(values, this.column);
        const r2 = this.operation._toParams(values);
        return r1 + " " + r2;
    }
}
class Operation extends SQLObject {
    isValid() {
        return true;
    }
}
class BinaryOp extends Operation {
    op;
    val;
    quantifier;
    constructor(op, val, quantifier) {
        super();
        this.op = op;
        this.val = val;
        this.quantifier = quantifier;
    }
    toString() {
        return (this.op +
            " " +
            (this.quantifier ? this.quantifier + " " : "") +
            strValue(this.val));
    }
    _toParams(values) {
        return (this.op +
            " " +
            (this.quantifier ? this.quantifier + " " : "") +
            paramValue(values, this.val));
    }
}
function binary(toOp) {
    return (...args) => {
        if (args.length === 1) {
            return toOp(args[0]);
        }
        else {
            return toOp(args[1], args[0]);
        }
    };
}
sql.eq = binary((val, quantifier) => {
    if (isNull(val)) {
        return new UnaryOp("IS NULL");
    }
    return new BinaryOp("=", val, quantifier);
});
sql.ne = binary((val, quantifier) => {
    if (isNull(val)) {
        return new UnaryOp("IS NOT NULL");
    }
    return new BinaryOp("<>", val, quantifier);
});
sql.lt = binary((val, quantifier) => {
    return new BinaryOp("<", val, quantifier);
});
sql.le = binary((val, quantifier) => {
    return new BinaryOp("<=", val, quantifier);
});
sql.gt = binary((val, quantifier) => {
    return new BinaryOp(">", val, quantifier);
});
sql.ge = binary((val, quantifier) => {
    return new BinaryOp(">=", val, quantifier);
});
class LikeOp extends Operation {
    val;
    insensitive;
    constructor(val, insensitive = false) {
        super();
        this.val = val;
        this.insensitive = insensitive;
    }
    toString() {
        return (this.insensitive ? "ILIKE " : "LIKE ") + strValue(this.val);
    }
    _toParams(values) {
        return ((this.insensitive ? "ILIKE " : "LIKE ") + paramValue(values, this.val));
    }
}
sql.like = (val) => {
    return new LikeOp(val);
};
sql.ilike = (val) => {
    return new LikeOp(val, true);
};
class BetweenOp extends Operation {
    val1;
    val2;
    constructor(val1, val2) {
        super();
        this.val1 = val1;
        this.val2 = val2;
    }
    toString() {
        return "BETWEEN " + strValue(this.val1) + " AND " + strValue(this.val2);
    }
    _toParams(values) {
        const r1 = paramValue(values, this.val1);
        const r2 = paramValue(values, this.val2);
        return "BETWEEN " + r1 + " AND " + r2;
    }
}
sql.between = (val1, val2) => {
    return new BetweenOp(val1, val2);
};
class UnaryOp extends Operation {
    op;
    constructor(op) {
        super();
        this.op = op;
    }
    toString() {
        return this.op;
    }
    _toParams(_values) {
        return this.op;
    }
}
class InOp extends Operation {
    vals;
    not;
    constructor(vals, not = false) {
        super();
        this.vals = vals;
        this.not = not;
    }
    isValid() {
        return !Array.isArray(this.vals) || this.vals.length > 0;
    }
    toString() {
        return ((this.not ? "NOT " : "") +
            "IN " +
            (Array.isArray(this.vals)
                ? strValue(this.vals, true)
                : "(" + this.vals.toString() + ")"));
    }
    _toParams(values) {
        return ((this.not ? "NOT " : "") +
            "IN " +
            (Array.isArray(this.vals)
                ? paramValue(values, this.vals, true)
                : "(" + this.vals._toParams(values) + ")"));
    }
}
sql.in = (vals) => {
    return new InOp(vals);
};
sql.nin = (vals) => {
    return new InOp(vals, true);
};
function parseWhereClause(clause, options) {
    if (!clause) {
        return new And([]);
    }
    if (clause instanceof Expression) {
        return clause;
    }
    if (clause instanceof SQLObject) {
        return new RawExpression(clause);
    }
    const or = options?.or || false;
    if (Array.isArray(clause)) {
        if (clause.length === 2 && clause[1] instanceof Operation) {
            return new OpExpression(clause[0], clause[1]);
        }
        const exprs = clause.map((c) => {
            return c instanceof Expression ? c : parseWhereClause(c, options);
        });
        return or ? new Or(exprs) : new And(exprs);
    }
    return new And(mapObject(compact(clause), (val, col) => {
        if (val instanceof Operation) {
            return new OpExpression(col, val);
        }
        else if (isNull(val)) {
            return new OpExpression(col, new UnaryOp("IS NULL"));
        }
        else {
            return new OpExpression(col, new BinaryOp("=", new Unknown(val)));
        }
    }));
}
sql.and = (...clauses) => {
    return new And(clauses.map((c) => parseWhereClause(c)));
};
sql.or = (...clauses) => {
    return new Or(clauses.map((c) => parseWhereClause(c, { or: true })));
};
sql.default = () => new Plain(["DEFAULT"], []);
class JsonObject extends Aliasable {
    obj;
    _prefix;
    constructor(obj) {
        super();
        this.obj = obj;
    }
    json(...data) {
        this.obj.push(...data);
        return this;
    }
    prefix(prefix) {
        this._prefix = prefix;
        return this;
    }
    toString() {
        return ("jsonb_build_object(" +
            this.obj
                .flatMap((v) => {
                if (typeof v === "string") {
                    return [strJsonItem(v, v, this._prefix)];
                }
                else if (Array.isArray(v)) {
                    return v.map((t) => strJsonItem(t, t, this._prefix));
                }
                else {
                    return mapObject(v, (val, key) => strJsonItem(key, val));
                }
            })
                .join(", ") +
            ")");
    }
    _toParams(values) {
        return ("jsonb_build_object(" +
            this.obj
                .flatMap((v) => {
                if (typeof v === "string") {
                    return [paramJsonItem(values, v, v, this._prefix)];
                }
                else if (Array.isArray(v)) {
                    return v.map((t) => paramJsonItem(values, t, t, this._prefix));
                }
                else {
                    return mapObject(v, (val, key) => paramJsonItem(values, key, val));
                }
            })
                .join(", ") +
            ")");
    }
}
sql.json = (...data) => {
    return new JsonObject(data);
};
sql.escapePattern = (val) => {
    return val.replace(/(\\|%|_)/g, "\\$1");
};
exports.default = sql;
