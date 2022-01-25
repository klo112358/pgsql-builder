const chai = require("chai")
const expect = chai.expect

const sql = require("../index").default

describe("Select", () => {
    function t(stmt, text, values) {
        return () => {
            expect(stmt.toParams()).to.deep.equal({ text, values })
        }
    }
    it("Simple select", t(
        sql.select("*").from("person"),
        "SELECT * FROM person",
        []
    ))
    it("Select with raw query, literal and identifier", t(
        sql.select(sql.val(1), sql("order"), sql`COUNT(${sql("name")})`).from("person"),
        "SELECT $1, \"order\", COUNT(name) FROM person",
        [1]
    ))
    it("Select distinct", t(
        sql.select("id").distinct().from("person"),
        "SELECT DISTINCT id FROM person",
        []
    ))
    it("Select distinct with columns", t(
        sql.select("id").distinct("id").from("person"),
        "SELECT DISTINCT ON (id) id FROM person",
        []
    ))
    it("Select join", t(
        sql.select("*").from("person").join("company", { "company_id": "company.id" }),
        "SELECT * FROM person INNER JOIN company ON company_id = company.id",
        []
    ))
    it("Select where", t(
        sql.select("*").from("person")
            .where({ "name": sql("nickname"), "id": sql.gt(1) }, { "name": "John" }),
        "SELECT * FROM person WHERE name = nickname AND id > $1 AND name = $2",
        [1, "John"]
    ))
    it("Select where with and/or", t(
        sql.select("*").from("person")
            .where(
                sql.and(
                    { "name": "John" },
                    sql.or({ "name": "Mary" }, { "name": sql("nickname") })
                )
            ),
        "SELECT * FROM person WHERE name = $1 AND (name = $2 OR name = nickname)",
        ["John", "Mary"]
    ))
    it("Select where with not", t(
        sql.select("*").from("person")
        .where(
            sql.not(sql.and(
                sql.not({ "name": "John" }),
                sql.or({ "name": "Mary" }, { "name": sql("nickname") })
            ))
        ),
        "SELECT * FROM person WHERE NOT (NOT (name = $1) AND (name = $2 OR name = nickname))",
        ["John", "Mary"]
    ))
    it("Select where with binary", t(
        sql.select("*").from("person")
        .where(
            [sql`(id, name)`, sql.in([[1, "John"]])]
        ),
        "SELECT * FROM person WHERE (id, name) IN (($1, $2))",
        [1, "John"]
    ))
    it("Select cross join with and/or", t(
        sql.select("*").from("person")
            .crossjoin("company"),
        "SELECT * FROM person CROSS JOIN company",
        []
    ))
    it("Select join with and/or", t(
        sql.select("*").from("person")
            .join("company", sql.or(
                { "company_id": "company.id" },
                sql.and({ "company_id": sql.val(null) }, { "company.id": sql.val(null) })
            )),
        "SELECT * FROM person INNER JOIN company ON company_id = company.id OR (company_id IS NULL AND company.id IS NULL)",
        []
    ))
    it("Select join with not", t(
        sql.select("*").from("person")
            .join("company", sql.not(sql.or(
                sql.not({ "company_id": "company.id" }),
                sql.and({ "company_id": sql.val(null) }, { "company.id": sql.val(null) })
            ))),
        "SELECT * FROM person INNER JOIN company ON NOT (NOT (company_id = company.id) OR (company_id IS NULL AND company.id IS NULL))",
        []
    ))
    it("Select from custom", t(
        sql.select("*").from(sql.from("person").crossjoin("company")),
        "SELECT * FROM person CROSS JOIN company",
        []
    ))
    it("Update from join", t(
        sql.update("business").set({ name: "ABC" })
            .from(sql.from("person").crossjoin("company")),
        "UPDATE business SET name = $1 FROM person CROSS JOIN company",
        ["ABC"]
    ))
    it("Delete using join", t(
        sql.delete("business")
            .using(sql.from("person").crossjoin("company")),
        "DELETE FROM business USING person CROSS JOIN company",
        []
    ))
})


