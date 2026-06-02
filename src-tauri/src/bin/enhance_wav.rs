use clearpodcast_app::{
    packaging::PackagedResourcePaths,
    runtime::{enhance_audio, EnhanceRequest},
};
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

    match enhance_audio(request) {
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
  --resource-dir localfiles/releases/extracted/ClearPodcast \\
  --input localfiles/samples/low_quality_voice_sample_1.wav|.mp3|.m4a \\
  --output localfiles/outputs/low_quality_voice_sample_1.enhanced.wav \\
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6

Explicit developer paths are still supported with --python, --model-dir, and optional --sidecar."
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
    let packaged_resources = optional_path(flags, "resource-dir")
        .map(PackagedResourcePaths::from_resource_dir)
        .map(|paths| {
            paths
                .validate_packaged_lookup()
                .map_err(|error| error.to_string())?;
            Ok::<_, String>(paths)
        })
        .transpose()?;
    let python = match optional_path(flags, "python") {
        Some(path) => path,
        None => packaged_resources
            .as_ref()
            .map(|paths| paths.python.clone())
            .ok_or_else(|| "missing required --python or --resource-dir".to_string())?,
    };
    let model_dir = match optional_path(flags, "model-dir") {
        Some(path) => path,
        None => packaged_resources
            .as_ref()
            .map(|paths| paths.model_dir.clone())
            .ok_or_else(|| "missing required --model-dir or --resource-dir".to_string())?,
    };
    let sidecar = optional_path(flags, "sidecar").or_else(|| {
        packaged_resources
            .as_ref()
            .map(|paths| paths.sidecar.clone())
    });

    Ok(EnhanceRequest {
        python,
        model_dir,
        input_audio: required_path(flags, "input")?,
        output_wav: required_path(flags, "output")?,
        sidecar,
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
