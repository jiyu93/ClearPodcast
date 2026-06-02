import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type AudioMetadata = {
  format: "wav" | "mp3" | "m4a";
  source_sample_rate: number;
  channels: number;
  frame_count?: number;
  duration_seconds?: number;
};

type EnhancementResult = {
  output_wav: string;
  input_metadata: AudioMetadata;
  output_metadata: AudioMetadata;
  exit_code: number;
  stdout: string;
  stderr: string;
};

type FormState = {
  python: string;
  model_dir: string;
  input_audio: string;
  output_wav: string;
};

const defaultFormState: FormState = {
  python: "localfiles/runtime/macos-arm64/bin/python3",
  model_dir: "localfiles/models/resemble-enhance/enhancer_stage2",
  input_audio: "localfiles/samples/low_quality_voice_sample_1.wav",
  output_wav: "localfiles/outputs/low_quality_voice_sample_1.enhanced.wav",
};

export default function App() {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function runEnhancement() {
    setStatus("running");
    setMessage("Launching local Resemble Enhance sidecar...");

    try {
      const result = await invoke<EnhancementResult>("enhance_audio_command", {
        request: {
          ...form,
          device: "cpu",
        },
      });

      setStatus("done");
      setMessage(
        `Wrote ${result.output_wav}. Exit ${result.exit_code}.\nInput: ${formatMetadata(result.input_metadata)}\nOutput: ${formatMetadata(result.output_metadata)}\n${result.stderr || result.stdout}`,
      );
    } catch (error) {
      setStatus("failed");
      setMessage(String(error));
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="title-row">
          <div>
            <p className="eyebrow">Runtime Spine</p>
            <h1>ClearPodcast</h1>
          </div>
          <span className={`status-pill ${status}`}>{status}</span>
        </header>

        <div className="form-grid">
          <label>
            Local Python runtime
            <input
              value={form.python}
              onChange={(event) => updateField("python", event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Resemble model directory
            <input
              value={form.model_dir}
              onChange={(event) => updateField("model_dir", event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Input audio
            <input
              value={form.input_audio}
              onChange={(event) => updateField("input_audio", event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Output WAV
            <input
              value={form.output_wav}
              onChange={(event) => updateField("output_wav", event.target.value)}
              spellCheck={false}
            />
          </label>
        </div>

        <button
          className="primary-action"
          onClick={runEnhancement}
          disabled={status === "running"}
        >
          Run Enhancement
        </button>

        <pre className="message-panel">{message || "Ready."}</pre>
      </section>
    </main>
  );
}

function formatMetadata(metadata: AudioMetadata) {
  const duration =
    typeof metadata.duration_seconds === "number"
      ? `${metadata.duration_seconds.toFixed(2)}s`
      : "unknown duration";

  return `${metadata.format.toUpperCase()}, ${metadata.source_sample_rate} Hz, ${metadata.channels} channel(s), ${duration}`;
}
