//! Deterministic reading rules shared by native/wasm integrations.
//! The Next.js service remains the persistence boundary; these pure rules are
//! intentionally free of database and network dependencies.

use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, TS)]
#[ts(export_to = "../../../src/generated/rust/reading_core.ts")]
pub struct ReadingCredit {
    pub pages: i32,
    pub new_current_page: i32,
    pub finished: bool,
}

/// In variable mode, credit only the pages actually read, capped at the book's remainder.
pub fn pages_to_credit(read_today: i32, current_page: i32, total_pages: Option<i32>) -> i32 {
    let requested = read_today.max(1);
    match total_pages {
        Some(total) if total > 0 => {
            let remaining = i64::from(total) - i64::from(current_page.max(0));
            requested.min(remaining.clamp(0, i64::from(i32::MAX)) as i32)
        }
        _ => requested,
    }
}

/// Resolve one reading event without touching persistence.
pub fn credit_reading(
    read_today: i32,
    current_page: i32,
    total_pages: Option<i32>,
) -> ReadingCredit {
    let current = current_page.max(0);
    let pages = pages_to_credit(read_today, current, total_pages);
    let new_current_page = match total_pages {
        Some(total) if total > 0 => current.saturating_add(pages).min(total),
        _ => current.saturating_add(pages),
    };
    ReadingCredit {
        pages,
        new_current_page,
        finished: total_pages.is_some_and(|total| total > 0 && new_current_page >= total),
    }
}

/// Page XP is awarded per complete ten-page block.
pub fn xp_for_pages(pages: i32, xp_per_ten_pages: i32) -> i32 {
    (pages.max(0) / 10).saturating_mul(xp_per_ten_pages.max(0))
}

/// Number of free shields earned at a level, one per ten levels.
pub fn free_shields_for_level(level: i32) -> i32 {
    level.max(0) / 10
}

/// Canonical ISBN representation used by matching and import code.
pub fn normalize_isbn(value: &str) -> Option<String> {
    let cleaned: String = value
        .chars()
        .filter(|c| c.is_ascii_digit() || matches!(c, 'x' | 'X'))
        .map(|c| c.to_ascii_uppercase())
        .collect();
    if cleaned.len() == 10 || cleaned.len() == 13 {
        Some(cleaned)
    } else {
        None
    }
}

/// Stable, case/whitespace/punctuation-insensitive matching key.
pub fn normalize_text(value: &str) -> String {
    value
        .chars()
        .flat_map(|c| c.to_lowercase())
        .filter(|c| c.is_alphanumeric())
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookCandidate<'a> {
    pub id: &'a str,
    pub isbn10: Option<&'a str>,
    pub isbn13: Option<&'a str>,
    pub title: &'a str,
    pub author: Option<&'a str>,
}

/// Scores a candidate without making an ambiguous merge decision.
/// ISBN matches are authoritative; title/author matches are only advisory.
pub fn duplicate_score(input: &BookCandidate<'_>, candidate: &BookCandidate<'_>) -> u8 {
    let isbn_match = [input.isbn10, input.isbn13].iter().flatten().any(|isbn| {
        [candidate.isbn10, candidate.isbn13]
            .iter()
            .flatten()
            .any(|other| normalize_isbn(isbn) == normalize_isbn(other))
    });
    if isbn_match {
        return 100;
    }
    let title_match = normalize_text(input.title) == normalize_text(candidate.title);
    let author_match = match (input.author, candidate.author) {
        (Some(a), Some(b)) => normalize_text(a) == normalize_text(b),
        _ => false,
    };
    match (title_match, author_match) {
        (true, true) => 80,
        (true, false) => 40,
        _ => 0,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FtsRow {
    pub id: String,
    pub content: String,
}

/// Converts metadata into one deterministic FTS document.
pub fn fts_row(id: &str, fields: &[Option<&str>]) -> FtsRow {
    FtsRow {
        id: id.to_owned(),
        content: fields
            .iter()
            .flatten()
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
            .collect::<Vec<_>>()
            .join(" "),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, TS)]
#[ts(export_to = "../../../src/generated/rust/reading_core.ts")]
pub struct StreakSummary {
    pub current: u32,
    pub longest: u32,
}

/// Computes streaks from sorted-or-unsorted UTC day numbers. Shielded days must
/// be represented in `days`; duplicates are ignored.
pub fn calculate_streak(days: &[i64], today: i64) -> StreakSummary {
    let mut unique = days.to_vec();
    unique.sort_unstable();
    unique.dedup();
    if unique.is_empty() {
        return StreakSummary {
            current: 0,
            longest: 0,
        };
    }
    let mut longest = 1u32;
    let mut run = 1u32;
    for pair in unique.windows(2) {
        if pair[1] == pair[0] + 1 {
            run += 1;
            longest = longest.max(run);
        } else {
            run = 1;
        }
    }
    let mut current = 0u32;
    let mut cursor = today;
    while unique.binary_search(&cursor).is_ok() {
        current += 1;
        cursor -= 1;
    }
    StreakSummary {
        current,
        longest: longest.max(current),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variable_pages_never_exceed_remaining_pages() {
        assert_eq!(pages_to_credit(20, 95, Some(100)), 5);
    }

    #[test]
    fn completed_books_receive_no_more_page_credit() {
        assert_eq!(pages_to_credit(20, 100, Some(100)), 0);
        assert_eq!(
            credit_reading(20, 100, Some(100)),
            ReadingCredit {
                pages: 0,
                new_current_page: 100,
                finished: true
            }
        );
    }

    #[test]
    fn credit_is_capped_and_marks_completion() {
        assert_eq!(
            credit_reading(20, 85, Some(100)),
            ReadingCredit {
                pages: 15,
                new_current_page: 100,
                finished: true
            }
        );
        assert_eq!(
            credit_reading(20, 10, Some(100)),
            ReadingCredit {
                pages: 20,
                new_current_page: 30,
                finished: false
            }
        );
    }

    #[test]
    fn page_xp_ignores_partial_blocks_and_invalid_values() {
        assert_eq!(xp_for_pages(29, 5), 10);
        assert_eq!(xp_for_pages(-1, 5), 0);
        assert_eq!(xp_for_pages(100, -5), 0);
    }

    #[test]
    fn large_values_are_processed_without_overflow_or_data_loss() {
        assert_eq!(pages_to_credit(i32::MAX, 0, Some(i32::MAX)), i32::MAX);
        assert_eq!(
            credit_reading(i32::MAX, i32::MAX - 1, None).new_current_page,
            i32::MAX
        );
        assert_eq!(xp_for_pages(i32::MAX, i32::MAX), i32::MAX);
    }

    #[test]
    fn every_ten_levels_awards_one_free_shield() {
        assert_eq!(free_shields_for_level(9), 0);
        assert_eq!(free_shields_for_level(20), 2);
    }

    #[test]
    fn matching_isbn_wins_and_text_is_normalized() {
        let a = BookCandidate {
            id: "a",
            isbn10: None,
            isbn13: Some("978-0-306-40615-7"),
            title: "Dune!",
            author: Some("Frank Herbert"),
        };
        let b = BookCandidate {
            id: "b",
            isbn10: None,
            isbn13: Some("9780306406157"),
            title: "Other",
            author: None,
        };
        assert_eq!(duplicate_score(&a, &b), 100);
        assert_eq!(normalize_text("The Sea, 2026"), "thesea2026");
    }

    #[test]
    fn streak_ignores_duplicates_and_counts_shields() {
        assert_eq!(
            calculate_streak(&[1, 2, 2, 3], 3),
            StreakSummary {
                current: 3,
                longest: 3
            }
        );
        assert_eq!(
            calculate_streak(&[1, 3], 3),
            StreakSummary {
                current: 1,
                longest: 1
            }
        );
    }

    #[test]
    fn fts_rows_are_deterministic() {
        assert_eq!(
            fts_row("b1", &[Some(" Dune "), None, Some("Frank")]).content,
            "Dune Frank"
        );
        ReadingCredit::export().expect("export ReadingCredit TypeScript contract");
        StreakSummary::export().expect("export StreakSummary TypeScript contract");
    }
}
