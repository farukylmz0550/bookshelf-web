//! Small deterministic reading rules shared by native/wasm integrations.
//! The Next.js service remains the persistence boundary; these pure rules are
//! intentionally free of database and network dependencies.

/// In variable mode, credit only the pages actually read, capped at the book's remainder.
pub fn pages_to_credit(read_today: i32, current_page: i32, total_pages: Option<i32>) -> i32 {
    let requested = read_today.max(1);
    match total_pages {
        Some(total) if total > 0 => requested.min((total - current_page.max(0)).max(1)),
        _ => requested,
    }
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
    fn every_ten_levels_awards_one_free_shield() {
        assert_eq!(free_shields_for_level(9), 0);
        assert_eq!(free_shields_for_level(20), 2);
    }
}
