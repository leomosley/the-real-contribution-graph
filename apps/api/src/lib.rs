// Parser for GitHub's undocumented, cookieless contributions HTML fragment
// (https://github.com/users/<username>/contributions). Parsing is deliberately
// separated from fetching: this stays pure and testable.

use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Day {
    pub date: String,
    pub level: u8,
    pub count: u32,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Contributions {
    pub total: u32,
    pub days: Vec<Day>,
}

fn day_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>"#)
            .expect("valid day regex")
    })
}

fn tooltip_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)</tool-tip>"#)
            .expect("valid tooltip regex")
    })
}

// Pull the value of an HTML attribute out of a single tag string.
fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let key = format!("{name}=\"");
    let start = tag.find(&key)? + key.len();
    let rest = &tag[start..];
    let end = rest.find('"')?;
    Some(&rest[..end])
}

// Tooltip text is either "N contribution(s) on <date>." or "No contributions on <date>.".
fn parse_count(text: &str) -> u32 {
    text.split_whitespace()
        .next()
        .unwrap_or("")
        .replace(',', "")
        .parse()
        .unwrap_or(0)
}

pub fn parse_contributions(html: &str) -> Contributions {
    let counts: HashMap<&str, u32> = tooltip_re()
        .captures_iter(html)
        .filter_map(|c| Some((c.get(1)?.as_str(), parse_count(c.get(2)?.as_str()))))
        .collect();

    let days: Vec<Day> = day_re()
        .find_iter(html)
        .filter_map(|m| {
            let tag = m.as_str();
            let date = attr(tag, "data-date")?;
            let id = attr(tag, "id")?;
            let level = attr(tag, "data-level")
                .and_then(|l| l.parse().ok())
                .unwrap_or(0);
            let count = counts.get(id).copied().unwrap_or(0);
            Some(Day {
                date: date.to_string(),
                level,
                count,
            })
        })
        .collect();

    let total = days.iter().map(|d| d.count).sum();
    Contributions { total, days }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FRAGMENT: &str = r#"
      <td data-date="2025-07-20" id="contribution-day-component-0-0" data-level="0" class="ContributionCalendar-day">
      <td data-date="2025-11-30" id="contribution-day-component-0-19" data-level="1" class="ContributionCalendar-day">
      <td data-date="2025-01-11" id="contribution-day-component-0-25" data-level="2" class="ContributionCalendar-day">
      <td style="width: 10px" class="ContributionCalendar-day">
      <tool-tip for="contribution-day-component-0-0" class="sr-only">No contributions on July 20th.</tool-tip>
      <tool-tip for="contribution-day-component-0-19" class="sr-only">1 contribution on November 30th.</tool-tip>
      <tool-tip for="contribution-day-component-0-25" class="sr-only">2 contributions on January 11th.</tool-tip>
    "#;

    #[test]
    fn parses_days_levels_and_total() {
        let c = parse_contributions(FRAGMENT);
        // Padding cell without data-date is ignored.
        assert_eq!(c.days.len(), 3);
        assert_eq!(c.total, 3);
        assert_eq!(
            c.days[1],
            Day {
                date: "2025-11-30".to_string(),
                level: 1,
                count: 1
            }
        );
    }

    #[test]
    fn handles_thousands_separator() {
        assert_eq!(parse_count("1,436 contributions on May 1st."), 1436);
        assert_eq!(parse_count("No contributions on May 1st."), 0);
    }
}
