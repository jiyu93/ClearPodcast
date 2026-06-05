# ClearPodcast

[English](README.md) | 简体中文

ClearPodcast 是一款离线桌面应用，用于修复受损的播客人声录音。

它面向已经拿到低质量音频的播客创作者：这些音频可能来自蓝牙耳机、
会议软件、远程通话、手机录音或普通电脑麦克风。应用会把第一个产品
工作流保持得很窄：导入一段录音，在本地修复，对比结果，然后导出可
发布的 WAV。

ClearPodcast 不是 DAW、多轨编辑器、云处理服务，也不是音乐母带工具。

## 产品能力

- 一次修复一个 WAV、MP3 或 M4A 格式的播客人声录音。
- 通过打包的 Python + PyTorch sidecar 在本地运行 Resemble Enhance。
- 音频解码和最终 WAV 写入由 Rust 负责。
- 桌面应用中显示源文件元数据、当前运行状态、修复前后播放对比、导出、
  模型设置和本地诊断信息。
- 仅导出标准 WAV。
- 解压自包含发布包后，可离线运行。

## 平台与格式支持

| 范围 | 当前支持 |
| --- | --- |
| 桌面平台 | macOS 和 Windows |
| 开发基线 | macOS arm64 |
| Windows 加速目标 | Windows 11 x64，支持 NVIDIA CUDA 和 CPU fallback |
| 输入格式 | WAV、MP3、M4A |
| 导出格式 | WAV |
| 分发方式 | 便携优先的压缩包 |

macOS 打包产物是一个包含自包含 `ClearPodcast.app` 的 zip。Windows 打包
产物是一个 x64 便携 zip：CUDA 可用时自动使用 CUDA，否则回退到 CPU。

## 从源码快速开始

安装 JavaScript 依赖：

```sh
npm install
```

在 macOS 上开发或烟测时，先引导本地 macOS CPU runtime：

```sh
PYTHON_BIN=/path/to/python3.12 scripts/bootstrap-macos-cpu-runtime.sh
```

模型权重和本地 runtime 是 `localfiles/` 下的私有本地输入，不提交到仓库。
本地 runtime 设置、模型目录结构、smoke 命令、Windows 说明和视觉 fixture
见 [开发文档](docs/development.md)。

启动 Tauri 桌面开发应用：

```sh
npm run tauri dev
```

运行常规源码检查：

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

发布打包和普通开发刻意分开。只有在需要构建便携产物时，才使用
[发布工作流](docs/release-workflow.md)。

## 仓库结构

- `src/`：React + TypeScript 桌面 UI。
- `src-tauri/`：Tauri shell、Rust commands、任务管理、音频 I/O、应用日志
  和打包资源查找。
- `sidecars/resemble/`：ClearPodcast 自己维护的 Resemble Enhance 推理
  sidecar。
- `packaging/`：产物 manifest、license notice 生成和发布打包元数据。
- `scripts/`：开发、验证、staging 和便携打包脚本。
- `docs/`：roadmap、implementation plan、release workflow、ADR、开发说明
  和里程碑记录。
- `localfiles/`：私有样本、runtime、模型权重、实验、发布 zip、解压产物和
  生成的 smoke 输出。

## 文档

- [领域上下文](CONTEXT.md)：产品问题、用户、语言、约束、非目标和质量标准。
- [路线图](docs/roadmap.md)：当前产品化阶段和未来主题。
- [实现计划](docs/implementation-plan.md)：可执行里程碑范围、架构和验证预期。
- [开发文档](docs/development.md)：本地设置、smoke 测试、fixture 和生成文件卫生。
- [发布工作流](docs/release-workflow.md)：macOS 和 Windows 便携发布命令与验证。
- [架构决策](docs/adr/)：已接受的技术和产品权衡。
- [里程碑记录](docs/milestone-records/)：已完成里程碑的历史记录。

## Issues 与贡献

Issues 和 PRD 通过本仓库的 GitHub Issues 跟踪。

当用户可见的产品行为、打包方式、架构决策或发布工作流改变当前项目形态时，
请同步更新相关文档。

## 许可证

ClearPodcast 使用 [Apache License 2.0](LICENSE) 授权。项目归属声明见
[NOTICE](NOTICE)，第三方依赖和 runtime notice 会作为单独文件打包在
`packaging/licenses/` 下。
