use chrono::{Local, SecondsFormat};
use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

const MAX_LOG_FILE_BYTES: u64 = 500 * 1024;
const MAX_ROTATED_LOG_FILES: usize = 3;

#[derive(Debug, Clone)]
pub struct AppLog {
    path: PathBuf,
    state: Arc<Mutex<AppLogState>>,
}

#[derive(Debug, Default)]
struct AppLogState {
    session_text: String,
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

        Ok(Self {
            path,
            state: Arc::new(Mutex::new(AppLogState::default())),
        })
    }

    pub fn snapshot(&self) -> AppLogSnapshot {
        let state = self.state.lock().expect("app log lock");
        AppLogSnapshot {
            path: self.path.clone(),
            text: state.session_text.clone(),
        }
    }

    pub fn info(&self, event: &str, message: impl AsRef<str>) {
        self.write_fields("INFO", event, &[("message", message.as_ref().to_string())]);
    }

    pub fn warn(&self, event: &str, message: impl AsRef<str>) {
        self.write_fields("WARN", event, &[("message", message.as_ref().to_string())]);
    }

    pub fn error(&self, event: &str, message: impl AsRef<str>) {
        self.write_fields("ERROR", event, &[("message", message.as_ref().to_string())]);
    }

    pub fn info_fields(&self, event: &str, fields: &[(&str, String)]) {
        self.write_fields("INFO", event, fields);
    }

    pub fn warn_fields(&self, event: &str, fields: &[(&str, String)]) {
        self.write_fields("WARN", event, fields);
    }

    pub fn error_fields(&self, event: &str, fields: &[(&str, String)]) {
        self.write_fields("ERROR", event, fields);
    }

    fn write_fields(&self, level: &str, event: &str, fields: &[(&str, String)]) {
        let mut state = self.state.lock().expect("app log lock");
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let line = format_log_line(level, event, fields);
        let rotated = rotate_log_file_if_needed(&self.path, line.len() + 1).unwrap_or(false);
        let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        else {
            return;
        };

        if rotated {
            let rotation_line = format_log_line(
                "INFO",
                "log_file_rotated",
                &[
                    ("path", self.path.display().to_string()),
                    ("max_bytes", MAX_LOG_FILE_BYTES.to_string()),
                    ("history_files", MAX_ROTATED_LOG_FILES.to_string()),
                ],
            );
            let _ = writeln!(file, "{rotation_line}");
            state.session_text.push_str(&rotation_line);
            state.session_text.push('\n');
        }

        let _ = writeln!(file, "{line}");
        state.session_text.push_str(&line);
        state.session_text.push('\n');
    }
}

fn rotate_log_file_if_needed(path: &Path, pending_bytes: usize) -> Result<bool, std::io::Error> {
    if fs::metadata(path)
        .map(|metadata| metadata.len().saturating_add(pending_bytes as u64) <= MAX_LOG_FILE_BYTES)
        .unwrap_or(true)
    {
        return Ok(false);
    }

    let oldest = rotated_log_path(path, MAX_ROTATED_LOG_FILES);
    let _ = fs::remove_file(oldest);

    for index in (1..MAX_ROTATED_LOG_FILES).rev() {
        let source = rotated_log_path(path, index);
        let destination = rotated_log_path(path, index + 1);
        if source.exists() {
            let _ = fs::remove_file(&destination);
            fs::rename(source, destination)?;
        }
    }

    fs::rename(path, rotated_log_path(path, 1))?;
    Ok(true)
}

fn rotated_log_path(path: &Path, index: usize) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("clearpodcast.log");
    path.with_file_name(format!("{file_name}.{index}"))
}

fn format_log_line(level: &str, event: &str, fields: &[(&str, String)]) -> String {
    let timestamp = Local::now().to_rfc3339_opts(SecondsFormat::Millis, false);
    let mut parts = vec![
        format!("ts={}", format_log_value(&timestamp)),
        format!("level={}", sanitize_log_token(level)),
        format!("event={}", sanitize_log_token(event)),
    ];

    for (key, value) in fields {
        if value.is_empty() {
            continue;
        }
        parts.push(format!(
            "{}={}",
            sanitize_log_token(key),
            format_log_value(value)
        ));
    }

    parts.join(" ")
}

fn sanitize_log_token(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    if sanitized.is_empty() {
        "unknown".to_string()
    } else {
        sanitized
    }
}

fn format_log_value(value: &str) -> String {
    let safe_unquoted = !value.is_empty()
        && value.chars().all(|character| {
            !character.is_whitespace()
                && !matches!(character, '"' | '\\' | '=')
                && !character.is_control()
        });

    if safe_unquoted {
        return value.to_string();
    }

    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            character if character.is_control() => output.push(' '),
            character => output.push(character),
        }
    }
    output.push('"');
    output
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
    use tempfile::tempdir;

    #[test]
    fn snapshot_only_contains_current_session_lines() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("clearpodcast.log");
        fs::write(&path, "old session\n").expect("write old log");

        let log = AppLog::new(path).expect("create log");
        log.info_fields("app_started", &[("version", "0.1.0".to_string())]);

        let snapshot = log.snapshot();
        assert!(snapshot.text.contains("event=app_started"));
        assert!(!snapshot.text.contains("old session"));
    }

    #[test]
    fn log_lines_escape_fields_without_breaking_plain_text() {
        let line = format_log_line(
            "INFO",
            "preview prepared",
            &[
                ("input path", "/tmp/input file.wav".to_string()),
                ("message", "line one\nline two".to_string()),
            ],
        );

        assert!(line.contains("level=INFO"));
        assert!(line.contains("event=preview_prepared"));
        assert!(line.contains("input_path=\"/tmp/input file.wav\""));
        assert!(line.contains("message=\"line one\\nline two\""));
    }

    #[test]
    fn writing_rotates_when_the_next_line_would_exceed_the_limit() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("clearpodcast.log");
        fs::write(&path, "x".repeat(MAX_LOG_FILE_BYTES as usize - 5)).expect("write active log");
        for index in 1..=MAX_ROTATED_LOG_FILES {
            fs::write(rotated_log_path(&path, index), format!("old {index}"))
                .expect("write rotated log");
        }

        let log = AppLog::new(path.clone()).expect("create log");
        log.info("app_started", "ClearPodcast started");

        assert!(fs::read_to_string(&path)
            .expect("read active log")
            .contains("event=app_started"));
        assert_eq!(
            fs::read_to_string(rotated_log_path(&path, 1))
                .expect("read .1")
                .len() as u64,
            MAX_LOG_FILE_BYTES - 5
        );
        assert_eq!(
            fs::read_to_string(rotated_log_path(&path, 2)).expect("read .2"),
            "old 1"
        );
        assert_eq!(
            fs::read_to_string(rotated_log_path(&path, 3)).expect("read .3"),
            "old 2"
        );
    }

    #[test]
    fn truncate_log_field_keeps_utf8_boundaries() {
        let value = format!("{}音", "a".repeat(3999));
        let truncated = truncate_log_field(&value);

        assert!(truncated.starts_with(&"a".repeat(3999)));
        assert!(truncated.contains("<truncated 3 bytes>"));
    }
}
