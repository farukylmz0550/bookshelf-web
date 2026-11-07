use std::io::{self, Read};

fn csv_rows(input: &str) -> Vec<Vec<String>> {
    let input = input.strip_prefix('\u{feff}').unwrap_or(input);
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if quoted {
            if c == '"' && chars.get(i + 1) == Some(&'"') {
                field.push('"');
                i += 2;
                continue;
            }
            if c == '"' {
                quoted = false;
            } else {
                field.push(c);
            }
        } else {
            match c {
                '"' => quoted = true,
                ',' => {
                    row.push(std::mem::take(&mut field));
                }
                '\n' => {
                    row.push(std::mem::take(&mut field));
                    rows.push(std::mem::take(&mut row));
                }
                '\r' => {}
                _ => field.push(c),
            }
        }
        i += 1;
    }
    row.push(field);
    if row.iter().any(|value| !value.trim().is_empty()) {
        rows.push(row);
    }
    rows
}

fn column(headers: &[String], names: &[&str]) -> Option<usize> {
    headers.iter().position(|header| {
        names
            .iter()
            .any(|name| header.trim().eq_ignore_ascii_case(name))
    })
}

fn cell(row: &[String], index: Option<usize>) -> String {
    index
        .and_then(|i| row.get(i))
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}

fn clean_isbn(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .strip_prefix("=\"")
        .and_then(|v| v.strip_suffix('"'))
        .unwrap_or(value.trim().trim_matches('"'))
        .trim_end_matches(".0")
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == 'X' || *c == 'x')
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn valid_isbn10(value: &str) -> bool {
    if value.len() != 10 || !value[..9].chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    let sum: u32 = value
        .chars()
        .enumerate()
        .map(|(i, c)| {
            let digit = if c == 'X' || c == 'x' {
                10
            } else {
                c.to_digit(10).unwrap_or(99)
            };
            (10 - i as u32) * digit
        })
        .sum();
    sum % 11 == 0
}

fn valid_isbn13(value: &str) -> bool {
    if value.len() != 13 || !value.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    let sum: u32 = value
        .chars()
        .enumerate()
        .map(|(i, c)| c.to_digit(10).unwrap() * if i % 2 == 0 { 1 } else { 3 })
        .sum();
    sum % 10 == 0
}

fn normalized_isbn(isbn13: &str, isbn10: &str) -> (Option<String>, Option<String>) {
    let thirteen = clean_isbn(isbn13);
    let ten = clean_isbn(isbn10);
    if valid_isbn13(&thirteen) {
        return (Some(thirteen.clone()), Some(thirteen));
    }
    if valid_isbn10(&ten) {
        return (Some(ten), None);
    }
    (None, None)
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn json_string(value: &str) -> String {
    format!("\"{}\"", json_escape(value))
}

fn json_opt(value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|v| json_string(v))
        .unwrap_or_else(|| "null".into())
}

fn parse_date(value: &str) -> Option<String> {
    let parts: Vec<&str> = value.split(['/', '-', '.']).collect();
    if parts.len() < 2 {
        return None;
    }
    let year = parts[0].parse::<u32>().ok()?;
    let month = parts[1].parse::<u32>().ok()?;
    let day = parts
        .get(2)
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(1);
    if !(1..=12).contains(&month) {
        return None;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        2 if leap => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if day == 0 || day > days {
        return None;
    }
    Some(format!("{year:04}-{month:02}-{day:02}T00:00:00.000Z"))
}

fn parse_shelves(value: &str) -> (Option<&'static str>, Vec<String>) {
    let mut status = None;
    let mut tags = Vec::new();
    for item in value
        .split(',')
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty())
    {
        match item.as_str() {
            "read" => status = Some("FINISHED"),
            "currently-reading" => {
                if status.is_none() {
                    status = Some("READING")
                }
            }
            "to-read" => {
                if status.is_none() {
                    status = Some("TO_READ")
                }
            }
            _ => {
                if tags.len() < 30 {
                    tags.push(item)
                }
            }
        }
    }
    (status, tags)
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("read CSV");
    let rows = csv_rows(&input);
    if rows.is_empty() {
        println!("{{\"error\":\"empty\"}}");
        return;
    }
    let headers = &rows[0];
    let title = column(headers, &["Title"]);
    if title.is_none() {
        println!("{{\"error\":\"missing_title\"}}");
        return;
    }
    let author = column(headers, &["Author", "Author l-f"]);
    let isbn = column(headers, &["ISBN"]);
    let isbn13 = column(headers, &["ISBN13"]);
    let rating = column(headers, &["My Rating"]);
    let date_read = column(headers, &["Date Read"]);
    let shelves = column(headers, &["Bookshelves"]);
    let notes = column(headers, &["Private Notes"]);
    let mut output_rows = Vec::new();
    let mut errors = Vec::new();

    for (line, row) in rows.iter().skip(1).enumerate() {
        let title_value = cell(row, title);
        if title_value.is_empty() {
            errors.push(format!("Row {}: missing Title", line + 2));
            continue;
        }
        if title_value.chars().count() > 500 {
            errors.push(format!(
                "Row {}: Title must be 500 characters or fewer",
                line + 2
            ));
            continue;
        }
        let author_value = cell(row, author);
        if author_value.chars().count() > 300 {
            errors.push(format!(
                "Row {}: Author must be 300 characters or fewer",
                line + 2
            ));
            continue;
        }
        let notes_value = cell(row, notes);
        if notes_value.chars().count() > 1000 {
            errors.push(format!(
                "Row {}: Private Notes must be 1000 characters or fewer",
                line + 2
            ));
            continue;
        }
        let (normalized, normalized_13) = normalized_isbn(&cell(row, isbn13), &cell(row, isbn));
        let rating_value = cell(row, rating)
            .parse::<f64>()
            .unwrap_or(0.0)
            .floor()
            .clamp(0.0, 5.0) as i32;
        let date = parse_date(&cell(row, date_read));
        let (status, tags) = parse_shelves(&cell(row, shelves));
        if tags.iter().any(|tag| tag.chars().count() > 100) {
            errors.push(format!(
                "Row {}: shelf tag must be 100 characters or fewer",
                line + 2
            ));
            continue;
        }
        let tags_json = format!(
            "[{}]",
            tags.iter()
                .map(|v| json_string(v))
                .collect::<Vec<_>>()
                .join(",")
        );
        output_rows.push(format!(
            "{{\"title\":{},\"author\":{},\"isbn\":{},\"isbn13\":{},\"rating\":{},\"dateRead\":{},\"tags\":{},\"notes\":{},\"status\":{}}}",
            json_string(&title_value), json_opt(&non_empty(author_value)), json_opt(&normalized),
            json_opt(&normalized_13), rating_value, json_opt(&date), tags_json,
            json_opt(&non_empty(notes_value)), json_opt(&status.map(String::from))
        ));
    }
    println!(
        "{{\"rows\":[{}],\"invalidRows\":[{}]}}",
        output_rows.join(","),
        errors
            .iter()
            .map(|v| json_string(v))
            .collect::<Vec<_>>()
            .join(",")
    );
}

fn non_empty(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}
