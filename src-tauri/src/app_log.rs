use chrono::{Local, TimeZone};
use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Arc, Mutex},
};

#[derive(Debug, Clone)]
pub struct AppLog {
    path: PathBuf,
    lock: Arc<Mutex<()>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppLogSnapshot {
    pub path: PathBuf,
    pub text: String,
}

impl AppLog {
    pub fn new(path: PathBuf) -> Result<Self, std::io::Error> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let log = Self {
            path,
            lock: Arc::new(Mutex::new(())),
        };
        log.info("app_log_ready", "persistent log file is ready");
        Ok(log)
    }

    pub fn snapshot(&self) -> AppLogSnapshot {
        let text = fs::read_to_string(&self.path).unwrap_or_default();
        AppLogSnapshot {
            path: self.path.clone(),
            text: humanize_log_timestamps(&text),
        }
    }

    pub fn info(&self, event: &str, message: impl AsRef<str>) {
        self.write("INFO", event, message.as_ref());
    }

    pub fn warn(&self, event: &str, message: impl AsRef<str>) {
        self.write("WARN", event, message.as_ref());
    }

    pub fn error(&self, event: &str, message: impl AsRef<str>) {
        self.write("ERROR", event, message.as_ref());
    }

    fn write(&self, level: &str, event: &str, message: &str) {
        let _guard = self.lock.lock().expect("app log lock");
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        else {
            return;
        };

        let timestamp = Local::now().format("%Y/%m/%d %H:%M:%S");
        let clean_message = message.replace('\n', "\\n");
        let _ = writeln!(file, "{timestamp} {level} {event} {clean_message}");
    }
}

fn humanize_log_timestamps(text: &str) -> String {
    let mut output = text
        .lines()
        .map(humanize_log_line_timestamp)
        .collect::<Vec<_>>()
        .join("\n");

    if text.ends_with('\n') {
        output.push('\n');
    }

    output
}

fn humanize_log_line_timestamp(line: &str) -> String {
    let Some((timestamp, rest)) = line.split_once(' ') else {
        return line.to_string();
    };

    if timestamp.len() != 13 || !timestamp.bytes().all(|byte| byte.is_ascii_digit()) {
        return line.to_string();
    }

    let Ok(timestamp_ms) = timestamp.parse::<i64>() else {
        return line.to_string();
    };

    let Some(datetime) = Local.timestamp_millis_opt(timestamp_ms).single() else {
        return line.to_string();
    };

    format!("{} {}", datetime.format("%Y/%m/%d %H:%M:%S"), rest)
}

pub fn truncate_log_field(value: &str) -> String {
    const LIMIT: usize = 4000;
    if value.len() <= LIMIT {
        return value.to_string();
    }

    let mut end = LIMIT;
    while !value.is_char_boundary(end) {
        end -= 1;
    }

    format!(
        "{}...<truncated {} bytes>",
        &value[..end],
        value.len() - end
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_text_formats_existing_millisecond_timestamps() {
        let text = "1780637984588 INFO app_start ClearPodcast started\nalready formatted\n";
        let formatted = humanize_log_timestamps(text);

        assert!(formatted.contains("/"));
        assert!(formatted.contains(" INFO app_start ClearPodcast started"));
        assert!(formatted.contains("already formatted"));
        assert!(formatted.ends_with('\n'));
        assert!(!formatted.contains("1780637984588"));
    }

    #[test]
    fn truncate_log_field_keeps_utf8_boundaries() {
        let value = format!("{}音", "a".repeat(3999));
        let truncated = truncate_log_field(&value);

        assert!(truncated.starts_with(&"a".repeat(3999)));
        assert!(truncated.contains("<truncated 3 bytes>"));
    }
}
