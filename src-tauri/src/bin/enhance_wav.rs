use clearpodcast_app::runtime::{enhance_wav, EnhanceRequest};
use std::{collections::HashMap, env, path::PathBuf, process};

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help();
        return;
    }

    let flags = match parse_flags(&args) {
        Ok(flags) => flags,
        Err(error) => {
            eprintln!("{error}");
            print_help();
            process::exit(2);
        }
    };

    let request = match build_request(&flags) {
        Ok(request) => request,
        Err(error) => {
            eprintln!("{error}");
            print_help();
            process::exit(2);
        }
    };

    match enhance_wav(request) {
        Ok(result) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&result).expect("result should serialize")
            );
        }
        Err(error) => {
            eprintln!("{error}");
            process::exit(1);
        }
    }
}

fn print_help() {
    eprintln!(
        "Usage: cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- \\
  --python localfiles/runtime/macos-arm64/bin/python3 \\
  --model-dir localfiles/models/resemble-enhance/enhancer_stage2 \\
  --input localfiles/samples/low_quality_voice_sample_1.wav \\
  --output localfiles/outputs/low_quality_voice_sample_1.enhanced.wav \\
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6"
    );
}

fn parse_flags(args: &[String]) -> Result<HashMap<String, String>, String> {
    let mut flags = HashMap::new();
    let mut index = 0;

    while index < args.len() {
        let key = &args[index];
        if !key.starts_with("--") {
            return Err(format!("unexpected positional argument {key:?}"));
        }

        let Some(value) = args.get(index + 1) else {
            return Err(format!("missing value for {key}"));
        };

        if value.starts_with("--") {
            return Err(format!("missing value for {key}"));
        }

        flags.insert(key.trim_start_matches("--").to_string(), value.clone());
        index += 2;
    }

    Ok(flags)
}

fn build_request(flags: &HashMap<String, String>) -> Result<EnhanceRequest, String> {
    Ok(EnhanceRequest {
        python: required_path(flags, "python")?,
        model_dir: required_path(flags, "model-dir")?,
        input_wav: required_path(flags, "input")?,
        output_wav: required_path(flags, "output")?,
        sidecar: optional_path(flags, "sidecar"),
        device: flags.get("device").cloned(),
        nfe: optional_parse(flags, "nfe")?,
        solver: flags.get("solver").cloned(),
        lambd: optional_parse(flags, "lambd")?,
        tau: optional_parse(flags, "tau")?,
        expected_checkpoint_sha256: flags.get("expected-checkpoint-sha256").cloned(),
    })
}

fn required_path(flags: &HashMap<String, String>, key: &str) -> Result<PathBuf, String> {
    flags
        .get(key)
        .map(PathBuf::from)
        .ok_or_else(|| format!("missing required --{key}"))
}

fn optional_path(flags: &HashMap<String, String>, key: &str) -> Option<PathBuf> {
    flags.get(key).map(PathBuf::from)
}

fn optional_parse<T>(flags: &HashMap<String, String>, key: &str) -> Result<Option<T>, String>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    flags
        .get(key)
        .map(|value| {
            value
                .parse::<T>()
                .map_err(|error| format!("invalid --{key} value {value:?}: {error}"))
        })
        .transpose()
}
