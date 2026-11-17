// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { parseDublinCoreCatalog, parseInternetArchiveCatalog, parseMarcCatalog } from "./open-catalogs";

describe("open catalog parsers", () => {
  it("maps Dublin Core records from an open university catalog", () => {
    const result = parseDublinCoreCatalog(
      `<record><recordData><dc:title>Crime &amp; Punishment</dc:title><dc:creator>Fyodor Dostoyevsky</dc:creator><dc:publisher>Penguin</dc:publisher><dc:date>2003</dc:date><dc:identifier>ISBN 9780140449136</dc:identifier><dc:subject>Fiction</dc:subject></recordData></record>`,
      "9780140449136",
      "University Library",
    );

    expect(result).toMatchObject({
      title: "Crime & Punishment",
      author: "Fyodor Dostoyevsky",
      publishers: "Penguin",
      isbn13: "9780140449136",
      source: "University Library",
    });
  });

  it("maps MARCXML records from Alma university catalogs", () => {
    const result = parseMarcCatalog(
      `<record>
        <datafield tag="020"><subfield code="a">9780140449136 (paperback)</subfield></datafield>
        <datafield tag="100"><subfield code="a">Dostoyevsky, Fyodor</subfield></datafield>
        <datafield tag="245"><subfield code="a">Crime and punishment :</subfield><subfield code="b">a novel /</subfield></datafield>
        <datafield tag="264"><subfield code="a">London :</subfield><subfield code="b">Penguin,</subfield><subfield code="c">2003.</subfield></datafield>
        <datafield tag="300"><subfield code="a">718 pages</subfield></datafield>
      </record>`,
      "9780140449136",
      "Alma University",
    );

    expect(result).toMatchObject({
      title: "Crime and punishment: a novel",
      author: "Dostoyevsky, Fyodor",
      publishPlaces: "London",
      publishers: "Penguin",
      numberOfPages: "718 pages",
    });
  });

  it("maps and validates Internet Archive ISBN results", () => {
    const result = parseInternetArchiveCatalog(
      {
        response: {
          docs: [
            {
              identifier: "crimepunishment00dost_0",
              title: "Crime and punishment",
              creator: "Fyodor Mikhailovich Dostoyevsky",
              publisher: "Penguin",
              date: "2003-01-01T00:00:00Z",
              isbn: ["9780140449136", "0140449132"],
            },
          ],
        },
      },
      "9780140449136",
    );

    expect(result).toMatchObject({
      title: "Crime and punishment",
      isbn10: "0140449132",
      isbn13: "9780140449136",
      source: "Internet Archive",
    });
  });

  it("rejects a result whose ISBN does not match", () => {
    expect(
      parseInternetArchiveCatalog(
        { response: { docs: [{ title: "Wrong book", isbn: ["9780000000000"] }] } },
        "9780140449136",
      ),
    ).toBeNull();
  });
});
