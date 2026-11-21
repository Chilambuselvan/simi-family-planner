import { describe, expect, it } from "vitest";
import { parseCsv, parseInventoryCsv } from "./inventory-import";

describe("parseCsv", () => {
  it("splits simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const rows = parseCsv('Name,Notes\n"Dishwasher, Bosch","Model ""SMS46"""');
    expect(rows[1]).toEqual(["Dishwasher, Bosch", 'Model "SMS46"']);
  });

  it("strips a leading BOM", () => {
    expect(parseCsv("﻿name\nLamp")).toEqual([["name"], ["Lamp"]]);
  });

  it("drops fully blank rows", () => {
    expect(parseCsv("name\nLamp\n\n")).toEqual([["name"], ["Lamp"]]);
  });
});

describe("parseInventoryCsv", () => {
  it("imports a well-formed export with aliased headers", () => {
    const csv = [
      "Item,Category,Purchased,Warranty until,Where,Service every (months),Last serviced,Notes,Installer,Phone,Email",
      "Heat pump,Heat pump,15.03.2022,15.03.2032,Garage,12,2025-09-01,Viessmann Vitocal,Mueller Heizung,030 1234567,info@mueller.example",
    ].join("\n");
    const { drafts, errors } = parseInventoryCsv(csv);
    expect(errors).toEqual([]);
    expect(drafts).toEqual([{
      name: "Heat pump", category: "Heat pump", purchase_date: "2022-03-15", warranty_expiry: "2032-03-15",
      location: "Garage", maintenance_interval_months: 12, last_serviced: "2025-09-01", notes: "Viessmann Vitocal",
      contact_name: "Mueller Heizung", contact_phone: "030 1234567", contact_email: "info@mueller.example",
    }]);
  });

  it("defaults missing optional columns and category", () => {
    const { drafts } = parseInventoryCsv("name\nLamp");
    expect(drafts).toEqual([{
      name: "Lamp", category: "Other", purchase_date: null, warranty_expiry: null, location: null,
      maintenance_interval_months: null, last_serviced: null, notes: null, contact_name: null, contact_phone: null, contact_email: null,
    }]);
  });

  it("accepts ISO dates as-is", () => {
    const { drafts } = parseInventoryCsv("name,purchase_date\nFridge,2020-01-05");
    expect(drafts[0]?.purchase_date).toBe("2020-01-05");
  });

  it("skips rows with no name and reports them", () => {
    const { drafts, errors } = parseInventoryCsv("name,location\nSofa,Living room\n,Garage");
    expect(drafts).toHaveLength(1);
    expect(errors).toEqual(["Row 3: skipped, no name."]);
  });

  it("ignores an unparseable date rather than throwing", () => {
    const { drafts } = parseInventoryCsv("name,purchase_date\nTV,not-a-date");
    expect(drafts[0]?.purchase_date).toBeNull();
  });

  it("errors out when there is no name column at all", () => {
    const { drafts, errors } = parseInventoryCsv("category,location\nFoo,Bar");
    expect(drafts).toEqual([]);
    expect(errors[0]).toMatch(/no "name" column/i);
  });

  it("reports an empty file", () => {
    expect(parseInventoryCsv("").errors).toEqual(["The file is empty."]);
  });
});
