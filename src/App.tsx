import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type EnhancementResult = {
  output_wav: string;
  exit_code: number;
  stdout: string;
  stderr: string;
};

type FormState = {
  python: string;
  model_dir: string;
  input_wav: string;
  output_wav: string;
};

const defaultFormState: FormState = {
  python: "localfiles/runtime/macos-arm64/bin/python3",
  model_dir: "localfiles/models/resemble-enhance/enhancer_stage2",
  input_wav: "localfiles/samples/low_quality_voice_sample_1.wav",
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
      const result = await invoke<EnhancementResult>("enhance_wav_command", {
        request: {
          ...form,
          device: "cpu",
        },
      });

      setStatus("done");
      setMessage(
        `Wrote ${result.output_wav}. Exit ${result.exit_code}.\n${result.stderr || result.stdout}`,
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
            Input WAV
            <input
              value={form.input_wav}
              onChange={(event) => updateField("input_wav", event.target.value)}
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
          Run WAV Enhancement
        </button>

        <pre className="message-panel">{message || "Ready."}</pre>
      </section>
    </main>
  );
}
