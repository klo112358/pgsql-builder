export interface Params {
    text: string;
    values: unknown[];
}

export interface SQLObject {
    toString(): string
    toParams(): Params
}

export interface Aliasable extends SQLObject {
    as(alias: string): SQLObject
}

export interface Plain extends Aliasable {}

export interface Literal extends Aliasable {
    cast(type: string): this
}

export interface Identifier extends Aliasable {
    only(): this
}

export type Table = string | SQLObject;

export interface Values extends SQLObject {
    values(...values: Record<string, any>[]): this;
    as(alias: string): this;
}

export interface Statement extends Aliasable {}

export interface SelectStatement extends Statement {
    select(...columns: any[]): this;
    distinct(...cols: string[]): this;
    into(tbl: string): this;
    from(...args: any[]): this;
    join(tbl: any, on: WhereClause): this;
    leftjoin(tbl: any, on: WhereClause): this;
    rightjoin(tbl: any, on: WhereClause): this;
    fulljoin(tbl: any, on: WhereClause): this;
    where(...clauses: WhereClause[]): this;
    having(...clauses: WhereClause[]): this;
    group(...columns: any[]): this;
    order(...columns: [any, "ASC" | "DESC"][]): this;
    limit(limit: number): this;
    offset(offset: number): this;
}

interface WriteStatement extends Statement {
    returning(...columns: any[]): this;
}

export interface InsertStatement extends WriteStatement {
    values(...values: Record<string, any>[]): this;
    columns(...columns: any[]): this;
    select(subquery: any): this;
    onConflict(...columns: any[]): this;
    constraint(constraint?: any): this;
    doNothing(): this;
    doUpdate(...values: Record<string, any>[]): this;
}

export interface UpdateStatement extends WriteStatement {
    set(...values: Record<string, any>[]): this;
    from(...args: any[]): this;
    where(...clauses: WhereClause[]): this;
}

export interface DeleteStatement extends WriteStatement {
    where(...clauses: WhereClause[]): this;
    using(...args: any[]): this;
}

export interface Expression extends SQLObject {}

type BinaryQuantifier = "ALL" | "ANY";
interface BinaryFn {
    (val: any): Operation;
    (quantifier: BinaryQuantifier, val: any): Operation;
    (col: any, val: any): Expression;
    (col: any, quantifier: BinaryQuantifier, val: any): Expression;
}

export interface Operation extends SQLObject {}

export type SingleWhereClause = SQLObject | Record<string, any> | [any, Operation] | null | undefined;
export type WhereClause = WhereClause[] | SingleWhereClause;

export interface JsonObject extends Aliasable {
    json(...data: (string | string[] | Record<string, any>)[]): this;
    prefix(prefix: string): this;
}

declare function sql(str: string): Identifier
declare function sql(parts: TemplateStringsArray, ...args: unknown[]): Plain
declare namespace sql {
    export const val: (str: any) => Literal;
    export const values: (...values: Record<string, any>[]) => Values;
    export const select: (...columns: any[]) => SelectStatement;
    export const insert: (tbl: Table) => InsertStatement;
    export const update: (tbl: Table) => UpdateStatement;
    const _delete: (tbl: Table) => DeleteStatement;
    export const not: (...clauses: WhereClause[]) => Expression;
    export const exists: (subquery: any) => Expression;
    export const eq: BinaryFn;
    export const ne: BinaryFn;
    export const lt: BinaryFn;
    export const le: BinaryFn;
    export const gt: BinaryFn;
    export const ge: BinaryFn;
    export const like: (val: any) => Operation;
    export const ilike: (val: any) => Operation;
    export const between: (val1: any, val2: any) => Operation;
    const _in: (vals: any[] | SQLObject) => Operation;
    export const nin: (vals: any[] | SQLObject) => Operation;
    export const and: (...clauses: WhereClause[]) => Expression;
    export const or: (...clauses: WhereClause[]) => Expression;
    const _default: () => SQLObject;
    export const json: (...data: (string | string[] | Record<string, any>)[]) => JsonObject;
    export const escapePattern: (val: string) => string;
    export { _delete as delete, _in as in, _default as default };
}

export default sql
