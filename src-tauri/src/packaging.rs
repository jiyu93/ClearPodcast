use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

pub const RESOURCE_ROOT_DIR: &str = "clearpodcast";
pub const MACOS_CPU_RUNTIME_DIR: &str = "runtimes/macos-arm64-cpu";
pub const WINDOWS_RUNTIME_DIR: &str = "runtimes/windows-x64";
pub const RESEMBLE_SIDECAR_PATH: &str = "sidecars/resemble/clearpodcast_resemble.py";
pub const RESEMBLE_MODEL_DIR: &str = "models/resemble-enhance/enhancer_stage2";
pub const THIRD_PARTY_NOTICES_PATH: &str = "licenses/THIRD_PARTY_NOTICES.txt";
pub const ARTIFACT_MANIFEST_PATH: &str = "manifests/artifacts.json";
const LOCAL_MODEL_DIR: &str = "localfiles/models/resemble-enhance/enhancer_stage2";
const LOCAL_RESEMBLE_SIDECAR_PATH: &str = "sidecars/resemble/clearpodcast_resemble.py";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PackagedResourcePaths {
    pub resource_dir: PathBuf,
    pub resource_root: PathBuf,
    pub python: PathBuf,
    pub sidecar: PathBuf,
    pub model_dir: PathBuf,
    pub third_party_notices: PathBuf,
    pub artifact_manifest: PathBuf,
}

#[derive(Debug, Error)]
pub enum PackagedResourceError {
    #[error("packaged Python runtime was not found at {0}")]
    MissingRuntime(PathBuf),
    #[error("packaged Resemble sidecar was not found at {0}")]
    MissingSidecar(PathBuf),
    #[error("packaged Resemble model directory was not found at {0}")]
    MissingModelDirectory(PathBuf),
    #[error("packaged third-party license notices were not found at {0}")]
    MissingThirdPartyNotices(PathBuf),
    #[error("packaged artifact manifest was not found at {0}")]
    MissingArtifactManifest(PathBuf),
}

impl PackagedResourcePaths {
    pub fn from_app_resource_dir(resource_dir: impl AsRef<Path>) -> Self {
        #[cfg(debug_assertions)]
        {
            return Self::from_development_inputs(resource_dir);
        }

        #[cfg(not(debug_assertions))]
        {
            Self::from_resource_dir(resource_dir)
        }
    }

    pub fn from_resource_dir(resource_dir: impl AsRef<Path>) -> Self {
        let resource_dir = resource_dir.as_ref().to_path_buf();
        let resource_root = resource_dir.join(RESOURCE_ROOT_DIR);
        let runtime_dir = resource_root.join(packaged_runtime_dir());

        Self {
            resource_dir,
            resource_root: resource_root.clone(),
            python: runtime_dir.join(python_executable_relpath()),
            sidecar: resource_root.join(RESEMBLE_SIDECAR_PATH),
            model_dir: resource_root.join(RESEMBLE_MODEL_DIR),
            third_party_notices: resource_root.join(THIRD_PARTY_NOTICES_PATH),
            artifact_manifest: resource_root.join(ARTIFACT_MANIFEST_PATH),
        }
    }

    #[cfg(debug_assertions)]
    fn from_development_inputs(resource_dir: impl AsRef<Path>) -> Self {
        let resource_dir = resource_dir.as_ref().to_path_buf();
        let repository_root = repository_root();

        Self {
            resource_dir,
            resource_root: repository_root.clone(),
            python: repository_root
                .join(local_runtime_dir())
                .join(local_python_executable_relpath()),
            sidecar: repository_root.join(LOCAL_RESEMBLE_SIDECAR_PATH),
            model_dir: repository_root.join(LOCAL_MODEL_DIR),
            third_party_notices: repository_root
                .join("packaging")
                .join("licenses")
                .join("THIRD_PARTY_NOTICES.txt"),
            artifact_manifest: repository_root
                .join("packaging")
                .join(packaging_manifest_file()),
        }
    }

    pub fn validate_packaged_lookup(&self) -> Result<(), PackagedResourceError> {
        if !self.python.is_file() {
            return Err(PackagedResourceError::MissingRuntime(self.python.clone()));
        }

        if !self.sidecar.is_file() {
            return Err(PackagedResourceError::MissingSidecar(self.sidecar.clone()));
        }

        if !self.model_dir.is_dir() {
            return Err(PackagedResourceError::MissingModelDirectory(
                self.model_dir.clone(),
            ));
        }

        if !self.third_party_notices.is_file() {
            return Err(PackagedResourceError::MissingThirdPartyNotices(
                self.third_party_notices.clone(),
            ));
        }

        if !self.artifact_manifest.is_file() {
            return Err(PackagedResourceError::MissingArtifactManifest(
                self.artifact_manifest.clone(),
            ));
        }

        Ok(())
    }
}

#[cfg(windows)]
fn python_executable_relpath() -> &'static str {
    "python.exe"
}

#[cfg(not(windows))]
fn python_executable_relpath() -> &'static str {
    "bin/python3"
}

#[cfg(windows)]
fn packaged_runtime_dir() -> &'static str {
    WINDOWS_RUNTIME_DIR
}

#[cfg(not(windows))]
fn packaged_runtime_dir() -> &'static str {
    MACOS_CPU_RUNTIME_DIR
}

#[cfg(windows)]
fn local_runtime_dir() -> &'static str {
    "localfiles/runtime/windows-x64"
}

#[cfg(not(windows))]
fn local_runtime_dir() -> &'static str {
    "localfiles/runtime/macos-arm64"
}

#[cfg(windows)]
fn local_python_executable_relpath() -> &'static str {
    "Scripts/python.exe"
}

#[cfg(not(windows))]
fn local_python_executable_relpath() -> &'static str {
    python_executable_relpath()
}

#[cfg(windows)]
fn packaging_manifest_file() -> &'static str {
    "artifacts.windows-x64.json"
}

#[cfg(not(windows))]
fn packaging_manifest_file() -> &'static str {
    "artifacts.macos-arm64-cpu.json"
}

fn repository_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(&manifest_dir).to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn packaged_paths_follow_the_resource_layout_contract() {
        let resource_dir = PathBuf::from("packaged-resources");
        let paths = PackagedResourcePaths::from_resource_dir(&resource_dir);

        assert_eq!(
            paths.python,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(packaged_runtime_dir())
                .join(python_executable_relpath())
        );
        assert_eq!(
            paths.sidecar,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(RESEMBLE_SIDECAR_PATH)
        );
        assert_eq!(
            paths.model_dir,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(RESEMBLE_MODEL_DIR)
        );
        assert_eq!(
            paths.third_party_notices,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(THIRD_PARTY_NOTICES_PATH)
        );
        assert_eq!(
            paths.artifact_manifest,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(ARTIFACT_MANIFEST_PATH)
        );
    }

    #[cfg(debug_assertions)]
    #[test]
    fn app_resource_paths_use_local_development_inputs_in_debug_builds() {
        let paths = PackagedResourcePaths::from_app_resource_dir("dev-resources");
        let repository_root = repository_root();

        assert_eq!(
            paths.python,
            repository_root
                .join(local_runtime_dir())
                .join(local_python_executable_relpath())
        );
        assert_eq!(
            paths.sidecar,
            repository_root.join(LOCAL_RESEMBLE_SIDECAR_PATH)
        );
        assert_eq!(paths.model_dir, repository_root.join(LOCAL_MODEL_DIR));
    }

    #[cfg(windows)]
    #[test]
    fn windows_packaged_lookup_uses_windows_runtime() {
        let resource_dir = PathBuf::from("resources");
        let paths = PackagedResourcePaths::from_resource_dir(&resource_dir);

        assert_eq!(
            paths.python,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(WINDOWS_RUNTIME_DIR)
                .join("python.exe")
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_packaged_lookup_keeps_macos_cpu_runtime() {
        let resource_dir = PathBuf::from("resources");
        let paths = PackagedResourcePaths::from_resource_dir(&resource_dir);

        assert_eq!(
            paths.python,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(MACOS_CPU_RUNTIME_DIR)
                .join("bin/python3")
        );
    }

    #[test]
    fn packaged_lookup_validation_requires_runtime_model_sidecar_and_notices() {
        let dir = tempdir().expect("tempdir");
        let paths = PackagedResourcePaths::from_resource_dir(dir.path());

        fs::create_dir_all(paths.python.parent().expect("python parent")).expect("runtime dir");
        fs::write(&paths.python, b"fake python").expect("python");
        fs::create_dir_all(paths.sidecar.parent().expect("sidecar parent")).expect("sidecar dir");
        fs::write(&paths.sidecar, b"fake sidecar").expect("sidecar");
        fs::create_dir_all(&paths.model_dir).expect("model dir");
        fs::create_dir_all(paths.third_party_notices.parent().expect("licenses parent"))
            .expect("licenses dir");
        fs::write(&paths.third_party_notices, b"third-party notices").expect("notices");
        fs::create_dir_all(paths.artifact_manifest.parent().expect("manifest parent"))
            .expect("manifest dir");
        fs::write(&paths.artifact_manifest, b"{}").expect("manifest");

        paths
            .validate_packaged_lookup()
            .expect("packaged lookup should validate");
    }
}
