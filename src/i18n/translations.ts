import type { EnhancementJobState, EnhancementSolver } from "../domain/types";

export type AppLanguage = "en" | "zh-CN" | "ja" | "ko";

export type LanguageOption = {
  code: AppLanguage;
  nativeName: string;
  shortName: string;
  htmlLang: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", nativeName: "English", shortName: "EN", htmlLang: "en" },
  { code: "zh-CN", nativeName: "简体中文", shortName: "中", htmlLang: "zh-CN" },
  { code: "ja", nativeName: "日本語", shortName: "日", htmlLang: "ja" },
  { code: "ko", nativeName: "한국어", shortName: "한", htmlLang: "ko" },
];

export const DEFAULT_LANGUAGE: AppLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "clearpodcast.language";

const english = {
  common: {
    loading: "Loading...",
    metadataUnavailable: "--",
    channels: "ch",
  },
  language: {
    label: "Language",
    ariaLabel: "Change language",
  },
  app: {
    workspaceAriaLabel: "ClearPodcast workspace",
  },
  controls: {
    sourceLabel: "Filename",
    emptySource: "Open or drop a WAV, MP3, or M4A file",
    panelAriaLabel: "Workspace controls",
    toolsAriaLabel: "Workspace tools",
    openModelParametersAriaLabel: "Open model parameters",
    modelParametersTitle: "Model parameters",
    openLogAriaLabel: "Open log",
    logTitle: "Log",
    backToAudioWorkspaceAriaLabel: "Back to audio workspace",
    backTitle: "Back",
    back: "Back",
  },
  workspace: {
    audioAriaLabel: "Audio workspace",
    original: "Original",
    enhanced: "Enhanced",
    open: "Open",
    enhance: "Clarify",
    cancel: "Cancel",
    save: "Save",
  },
  audio: {
    seek: (title: string) => `Seek ${title} audio`,
    playbackTime: (title: string) => `${title} playback time`,
    transportControls: (title: string) => `${title} transport controls`,
    playAriaLabel: (title: string) => `Play ${title}`,
    pauseAriaLabel: (title: string) => `Pause ${title}`,
    muteAriaLabel: (title: string) => `Mute ${title}`,
    unmuteAriaLabel: (title: string) => `Unmute ${title}`,
    playTitle: "Play",
    pauseTitle: "Pause",
    muteTitle: "Mute",
    unmuteTitle: "Unmute",
  },
  log: {
    tauriUnavailablePath: "Tauri runtime unavailable",
    tauriUnavailableText: "Persistent logs are available in the desktop app.",
    fileLabel: "Log file",
    refresh: "Refresh",
    noEntries: "No log entries yet.",
  },
  model: {
    title: "Model Parameters",
    reset: "Reset",
    solver: "Solver",
    settings: "Enhancement Settings",
    solverHelp: "Chooses the numerical solver used inside Resemble Enhance.",
    solverOptions: {
      midpoint: {
        label: "Midpoint",
        help: "Recommended balance for most files.",
      },
      rk4: {
        label: "RK4",
        help: "More cautious solver; can be slower on CPU.",
      },
      euler: {
        label: "Euler",
        help: "Simpler and often faster; less refinement.",
      },
    } satisfies Record<EnhancementSolver, { label: string; help: string }>,
    parameters: {
      nfe: {
        label: "CFM steps",
        help: "Higher values can improve quality and usually take longer to run.",
      },
      tau: {
        label: "Prior temperature",
        help: "Higher values can add more variation and fullness, with less stability.",
      },
      lambd: {
        label: "Denoising",
        help: "Higher values apply stronger denoising before enhancement.",
      },
    },
  },
  device: {
    detecting: "Detecting",
    gpuMode: "GPU Mode",
    cpuMode: "CPU Mode",
    cudaAvailable: "CUDA available",
    cudaCpuSelected: "CUDA available; CPU selected",
    cudaUnavailable: "CUDA unavailable",
  },
  status: {
    queued: "Preparing",
    running: "Processing",
    completed: "Done",
    failed: "Needs attention",
    cancelled: "Cancelled",
    idle: "Ready",
  } satisfies Record<EnhancementJobState | "idle", string>,
  notices: {
    chooseFile: "Choose a WAV, MP3, or M4A file",
    readingSourceAudio: "Reading source audio",
    readyToEnhance: "Ready to enhance",
    chooseAudioFirst: "Choose an audio file first",
    preparingEnhancement: "Preparing enhancement",
    enhancingSpeech: "Enhancing speech",
    enhancedReady: "Enhanced WAV is ready",
    enhancementNeedsAttention: "Enhancement needs attention",
    enhancementCancelled: "Enhancement cancelled",
    cancellingEnhancement: "Cancelling enhancement",
  },
  errors: {
    unknown: "Unknown error",
    cancelled: "Enhancement was cancelled.",
    deviceDetection: "Processing device could not be checked.",
    unsupportedInput: "Choose a WAV, MP3, or M4A file.",
    missingInput: "The selected audio file could not be found.",
    unreadableAudio: "ClearPodcast could not read this audio file.",
    missingRuntime: "The local enhancement runtime is missing.",
    missingModel: "The bundled speech enhancement model is missing or incomplete.",
    sidecarFailure: "Enhancement failed inside the local AI runtime.",
    exportNeedsWav: "Choose a .wav export location.",
    exportFailure: "The enhanced WAV could not be exported.",
    inputFailure: "The selected file could not be imported.",
    generic: "ClearPodcast hit a local processing error.",
  },
};

export type Translation = typeof english;

const chinese: Translation = {
  common: {
    loading: "正在加载...",
    metadataUnavailable: "--",
    channels: "声道",
  },
  language: {
    label: "语言",
    ariaLabel: "切换语言",
  },
  app: {
    workspaceAriaLabel: "ClearPodcast 工作区",
  },
  controls: {
    sourceLabel: "文件名",
    emptySource: "打开或拖入 WAV、MP3、M4A 文件",
    panelAriaLabel: "工作区控制",
    toolsAriaLabel: "工作区工具",
    openModelParametersAriaLabel: "打开模型参数",
    modelParametersTitle: "模型参数",
    openLogAriaLabel: "打开日志",
    logTitle: "日志",
    backToAudioWorkspaceAriaLabel: "返回音频工作区",
    backTitle: "返回",
    back: "返回",
  },
  workspace: {
    audioAriaLabel: "音频工作区",
    original: "原始音频",
    enhanced: "增强音频",
    open: "打开",
    enhance: "清晰化",
    cancel: "取消",
    save: "保存",
  },
  audio: {
    seek: (title) => `定位${title}`,
    playbackTime: (title) => `${title}播放时间`,
    transportControls: (title) => `${title}播放控制`,
    playAriaLabel: (title) => `播放${title}`,
    pauseAriaLabel: (title) => `暂停${title}`,
    muteAriaLabel: (title) => `静音${title}`,
    unmuteAriaLabel: (title) => `取消${title}静音`,
    playTitle: "播放",
    pauseTitle: "暂停",
    muteTitle: "静音",
    unmuteTitle: "取消静音",
  },
  log: {
    tauriUnavailablePath: "Tauri 运行时不可用",
    tauriUnavailableText: "持久日志仅在桌面应用中可用。",
    fileLabel: "日志文件",
    refresh: "刷新",
    noEntries: "暂无日志条目。",
  },
  model: {
    title: "模型参数",
    reset: "重置",
    solver: "求解器",
    settings: "增强设置",
    solverHelp: "选择 Resemble Enhance 内部使用的数值求解器。",
    solverOptions: {
      midpoint: {
        label: "Midpoint",
        help: "适合大多数文件的推荐平衡选项。",
      },
      rk4: {
        label: "RK4",
        help: "更谨慎的求解器；在 CPU 上可能更慢。",
      },
      euler: {
        label: "Euler",
        help: "更简单也通常更快；细化程度较低。",
      },
    },
    parameters: {
      nfe: {
        label: "CFM 步数",
        help: "数值越高，音质可能越好，通常也需要更长时间。",
      },
      tau: {
        label: "先验温度",
        help: "数值越高，声音可能更丰满、更有变化，但稳定性更低。",
      },
      lambd: {
        label: "降噪强度",
        help: "数值越高，增强前应用的降噪越强。",
      },
    },
  },
  device: {
    detecting: "检测中",
    gpuMode: "GPU 模式",
    cpuMode: "CPU 模式",
    cudaAvailable: "CUDA 可用",
    cudaCpuSelected: "CUDA 可用；当前选择 CPU",
    cudaUnavailable: "CUDA 不可用",
  },
  status: {
    queued: "准备中",
    running: "处理中",
    completed: "已完成",
    failed: "需要处理",
    cancelled: "已取消",
    idle: "就绪",
  },
  notices: {
    chooseFile: "选择 WAV、MP3 或 M4A 文件",
    readingSourceAudio: "正在读取源音频",
    readyToEnhance: "可以开始增强",
    chooseAudioFirst: "请先选择音频文件",
    preparingEnhancement: "正在准备增强",
    enhancingSpeech: "正在增强语音",
    enhancedReady: "增强后的 WAV 已就绪",
    enhancementNeedsAttention: "增强过程需要处理",
    enhancementCancelled: "增强已取消",
    cancellingEnhancement: "正在取消增强",
  },
  errors: {
    unknown: "未知错误",
    cancelled: "增强已取消。",
    deviceDetection: "无法检查处理设备。",
    unsupportedInput: "请选择 WAV、MP3 或 M4A 文件。",
    missingInput: "找不到所选音频文件。",
    unreadableAudio: "ClearPodcast 无法读取此音频文件。",
    missingRuntime: "本地增强运行时缺失。",
    missingModel: "内置语音增强模型缺失或不完整。",
    sidecarFailure: "本地 AI 运行时中的增强过程失败。",
    exportNeedsWav: "请选择 .wav 导出位置。",
    exportFailure: "无法导出增强后的 WAV。",
    inputFailure: "无法导入所选文件。",
    generic: "ClearPodcast 遇到了本地处理错误。",
  },
};

const japanese: Translation = {
  common: {
    loading: "読み込み中...",
    metadataUnavailable: "--",
    channels: "ch",
  },
  language: {
    label: "言語",
    ariaLabel: "言語を切り替える",
  },
  app: {
    workspaceAriaLabel: "ClearPodcast ワークスペース",
  },
  controls: {
    sourceLabel: "ファイル名",
    emptySource: "WAV、MP3、M4A ファイルを開くかドロップ",
    panelAriaLabel: "ワークスペース操作",
    toolsAriaLabel: "ワークスペースツール",
    openModelParametersAriaLabel: "モデルパラメータを開く",
    modelParametersTitle: "モデルパラメータ",
    openLogAriaLabel: "ログを開く",
    logTitle: "ログ",
    backToAudioWorkspaceAriaLabel: "音声ワークスペースに戻る",
    backTitle: "戻る",
    back: "戻る",
  },
  workspace: {
    audioAriaLabel: "音声ワークスペース",
    original: "元の音声",
    enhanced: "強化後",
    open: "開く",
    enhance: "クリアにする",
    cancel: "キャンセル",
    save: "保存",
  },
  audio: {
    seek: (title) => `${title}をシーク`,
    playbackTime: (title) => `${title}の再生時間`,
    transportControls: (title) => `${title}の再生操作`,
    playAriaLabel: (title) => `${title}を再生`,
    pauseAriaLabel: (title) => `${title}を一時停止`,
    muteAriaLabel: (title) => `${title}をミュート`,
    unmuteAriaLabel: (title) => `${title}のミュートを解除`,
    playTitle: "再生",
    pauseTitle: "一時停止",
    muteTitle: "ミュート",
    unmuteTitle: "ミュート解除",
  },
  log: {
    tauriUnavailablePath: "Tauri ランタイムを利用できません",
    tauriUnavailableText: "永続ログはデスクトップアプリで利用できます。",
    fileLabel: "ログファイル",
    refresh: "更新",
    noEntries: "ログはまだありません。",
  },
  model: {
    title: "モデルパラメータ",
    reset: "リセット",
    solver: "ソルバー",
    settings: "強化設定",
    solverHelp: "Resemble Enhance 内部で使う数値ソルバーを選択します。",
    solverOptions: {
      midpoint: {
        label: "Midpoint",
        help: "ほとんどのファイルに適した推奨バランスです。",
      },
      rk4: {
        label: "RK4",
        help: "より慎重なソルバーです。CPU では遅くなる場合があります。",
      },
      euler: {
        label: "Euler",
        help: "より単純で多くの場合高速ですが、調整は控えめです。",
      },
    },
    parameters: {
      nfe: {
        label: "CFM ステップ",
        help: "値を高くすると品質が向上する場合がありますが、通常は処理時間も長くなります。",
      },
      tau: {
        label: "事前温度",
        help: "値を高くすると変化や厚みが増す場合がありますが、安定性は下がります。",
      },
      lambd: {
        label: "ノイズ除去",
        help: "値を高くすると、強化前のノイズ除去が強くなります。",
      },
    },
  },
  device: {
    detecting: "検出中",
    gpuMode: "GPU モード",
    cpuMode: "CPU モード",
    cudaAvailable: "CUDA 利用可能",
    cudaCpuSelected: "CUDA 利用可能、CPU を選択中",
    cudaUnavailable: "CUDA 利用不可",
  },
  status: {
    queued: "準備中",
    running: "処理中",
    completed: "完了",
    failed: "確認が必要",
    cancelled: "キャンセル済み",
    idle: "準備完了",
  },
  notices: {
    chooseFile: "WAV、MP3、M4A ファイルを選択してください",
    readingSourceAudio: "元の音声を読み込んでいます",
    readyToEnhance: "強化できます",
    chooseAudioFirst: "先に音声ファイルを選択してください",
    preparingEnhancement: "強化を準備しています",
    enhancingSpeech: "音声を強化しています",
    enhancedReady: "強化後の WAV が準備できました",
    enhancementNeedsAttention: "強化処理の確認が必要です",
    enhancementCancelled: "強化はキャンセルされました",
    cancellingEnhancement: "強化をキャンセルしています",
  },
  errors: {
    unknown: "不明なエラー",
    cancelled: "強化はキャンセルされました。",
    deviceDetection: "処理デバイスを確認できませんでした。",
    unsupportedInput: "WAV、MP3、M4A ファイルを選択してください。",
    missingInput: "選択した音声ファイルが見つかりません。",
    unreadableAudio: "ClearPodcast はこの音声ファイルを読み取れませんでした。",
    missingRuntime: "ローカル強化ランタイムが見つかりません。",
    missingModel: "同梱の音声強化モデルが見つからないか不完全です。",
    sidecarFailure: "ローカル AI ランタイム内で強化に失敗しました。",
    exportNeedsWav: ".wav のエクスポート先を選択してください。",
    exportFailure: "強化後の WAV をエクスポートできませんでした。",
    inputFailure: "選択したファイルをインポートできませんでした。",
    generic: "ClearPodcast でローカル処理エラーが発生しました。",
  },
};

const korean: Translation = {
  common: {
    loading: "불러오는 중...",
    metadataUnavailable: "--",
    channels: "ch",
  },
  language: {
    label: "언어",
    ariaLabel: "언어 변경",
  },
  app: {
    workspaceAriaLabel: "ClearPodcast 작업 영역",
  },
  controls: {
    sourceLabel: "파일 이름",
    emptySource: "WAV, MP3, M4A 파일을 열거나 끌어 놓기",
    panelAriaLabel: "작업 영역 제어",
    toolsAriaLabel: "작업 영역 도구",
    openModelParametersAriaLabel: "모델 매개변수 열기",
    modelParametersTitle: "모델 매개변수",
    openLogAriaLabel: "로그 열기",
    logTitle: "로그",
    backToAudioWorkspaceAriaLabel: "오디오 작업 영역으로 돌아가기",
    backTitle: "뒤로",
    back: "뒤로",
  },
  workspace: {
    audioAriaLabel: "오디오 작업 영역",
    original: "원본",
    enhanced: "향상됨",
    open: "열기",
    enhance: "선명하게",
    cancel: "취소",
    save: "저장",
  },
  audio: {
    seek: (title) => `${title} 오디오 탐색`,
    playbackTime: (title) => `${title} 재생 시간`,
    transportControls: (title) => `${title} 재생 제어`,
    playAriaLabel: (title) => `${title} 재생`,
    pauseAriaLabel: (title) => `${title} 일시 정지`,
    muteAriaLabel: (title) => `${title} 음소거`,
    unmuteAriaLabel: (title) => `${title} 음소거 해제`,
    playTitle: "재생",
    pauseTitle: "일시 정지",
    muteTitle: "음소거",
    unmuteTitle: "음소거 해제",
  },
  log: {
    tauriUnavailablePath: "Tauri 런타임을 사용할 수 없음",
    tauriUnavailableText: "영구 로그는 데스크톱 앱에서 사용할 수 있습니다.",
    fileLabel: "로그 파일",
    refresh: "새로 고침",
    noEntries: "아직 로그 항목이 없습니다.",
  },
  model: {
    title: "모델 매개변수",
    reset: "초기화",
    solver: "솔버",
    settings: "향상 설정",
    solverHelp: "Resemble Enhance 내부에서 사용할 수치 솔버를 선택합니다.",
    solverOptions: {
      midpoint: {
        label: "Midpoint",
        help: "대부분의 파일에 권장되는 균형 옵션입니다.",
      },
      rk4: {
        label: "RK4",
        help: "더 신중한 솔버이며 CPU에서는 느릴 수 있습니다.",
      },
      euler: {
        label: "Euler",
        help: "더 단순하고 보통 더 빠르지만 세밀한 보정은 적습니다.",
      },
    },
    parameters: {
      nfe: {
        label: "CFM 단계",
        help: "값이 높을수록 품질이 좋아질 수 있지만 보통 처리 시간이 길어집니다.",
      },
      tau: {
        label: "사전 온도",
        help: "값이 높을수록 변화와 풍성함이 늘 수 있지만 안정성은 낮아집니다.",
      },
      lambd: {
        label: "노이즈 제거",
        help: "값이 높을수록 향상 전에 더 강한 노이즈 제거를 적용합니다.",
      },
    },
  },
  device: {
    detecting: "감지 중",
    gpuMode: "GPU 모드",
    cpuMode: "CPU 모드",
    cudaAvailable: "CUDA 사용 가능",
    cudaCpuSelected: "CUDA 사용 가능, CPU 선택됨",
    cudaUnavailable: "CUDA 사용 불가",
  },
  status: {
    queued: "준비 중",
    running: "처리 중",
    completed: "완료",
    failed: "확인 필요",
    cancelled: "취소됨",
    idle: "준비됨",
  },
  notices: {
    chooseFile: "WAV, MP3, M4A 파일을 선택하세요",
    readingSourceAudio: "원본 오디오를 읽는 중",
    readyToEnhance: "향상할 준비가 되었습니다",
    chooseAudioFirst: "먼저 오디오 파일을 선택하세요",
    preparingEnhancement: "향상을 준비하는 중",
    enhancingSpeech: "음성을 향상하는 중",
    enhancedReady: "향상된 WAV가 준비되었습니다",
    enhancementNeedsAttention: "향상 작업 확인이 필요합니다",
    enhancementCancelled: "향상이 취소되었습니다",
    cancellingEnhancement: "향상을 취소하는 중",
  },
  errors: {
    unknown: "알 수 없는 오류",
    cancelled: "향상이 취소되었습니다.",
    deviceDetection: "처리 장치를 확인할 수 없습니다.",
    unsupportedInput: "WAV, MP3, M4A 파일을 선택하세요.",
    missingInput: "선택한 오디오 파일을 찾을 수 없습니다.",
    unreadableAudio: "ClearPodcast가 이 오디오 파일을 읽을 수 없습니다.",
    missingRuntime: "로컬 향상 런타임이 없습니다.",
    missingModel: "포함된 음성 향상 모델이 없거나 완전하지 않습니다.",
    sidecarFailure: "로컬 AI 런타임 내부에서 향상에 실패했습니다.",
    exportNeedsWav: ".wav 내보내기 위치를 선택하세요.",
    exportFailure: "향상된 WAV를 내보낼 수 없습니다.",
    inputFailure: "선택한 파일을 가져올 수 없습니다.",
    generic: "ClearPodcast에서 로컬 처리 오류가 발생했습니다.",
  },
};

export const translations: Record<AppLanguage, Translation> = {
  en: english,
  "zh-CN": chinese,
  ja: japanese,
  ko: korean,
};

export function isAppLanguage(value: string): value is AppLanguage {
  return value === "en" || value === "zh-CN" || value === "ja" || value === "ko";
}

export function normalizeLanguage(value?: string | null): AppLanguage | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }
  if (normalized === "ja" || normalized.startsWith("ja-")) {
    return "ja";
  }
  if (normalized === "ko" || normalized.startsWith("ko-")) {
    return "ko";
  }
  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return undefined;
}
