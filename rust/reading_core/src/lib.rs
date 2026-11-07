//! Deterministic reading rules shared by native/wasm integrations.
//! The Next.js service remains the persistence boundary; these pure rules are
//! intentionally free of database and network dependencies.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
}
