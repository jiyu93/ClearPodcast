use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

pub const RESOURCE_ROOT_DIR: &str = "clearpodcast";
pub const MACOS_CPU_RUNTIME_DIR: &str = "runtimes/macos-arm64-cpu";
pub const RESEMBLE_SIDECAR_PATH: &str = "sidecars/resemble/clearpodcast_resemble.py";
pub const RESEMBLE_MODEL_DIR: &str = "models/resemble-enhance/enhancer_stage2";
pub const THIRD_PARTY_NOTICES_PATH: &str = "licenses/THIRD_PARTY_NOTICES.txt";
pub const ARTIFACT_MANIFEST_PATH: &str = "manifests/artifacts.json";

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
    pub fn from_resource_dir(resource_dir: impl AsRef<Path>) -> Self {
        let resource_dir = resource_dir.as_ref().to_path_buf();
        let resource_root = resource_dir.join(RESOURCE_ROOT_DIR);
        let runtime_dir = resource_root.join(MACOS_CPU_RUNTIME_DIR);

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn packaged_paths_follow_the_resource_layout_contract() {
        let resource_dir = PathBuf::from("/Applications/ClearPodcast.app/Contents/Resources");
        let paths = PackagedResourcePaths::from_resource_dir(&resource_dir);

        assert_eq!(
            paths.python,
            resource_dir
                .join(RESOURCE_ROOT_DIR)
                .join(MACOS_CPU_RUNTIME_DIR)
                .join(python_executable_relpath())
        );
        assert_eq!(
            paths.sidecar,
            resource_dir.join(RESOURCE_ROOT_DIR).join(RESEMBLE_SIDECAR_PATH)
        );
        assert_eq!(
            paths.model_dir,
            resource_dir.join(RESOURCE_ROOT_DIR).join(RESEMBLE_MODEL_DIR)
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
