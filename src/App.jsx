import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

const JOB_STATUS = ["queued", "running", "succeeded", "failed"];
const TRANSFORM_TYPES = ["pose2d", "pose3d", "custom_v1"];

// ─── API Client ───────────────────────────────────────────────────────────────

function createClient(baseUrl, subject, apiKey) {
  const h = { "X-WHAM-Subject": subject, "X-WHAM-Api-Key": apiKey };
  const url = (p) => `${baseUrl.replace(/\/$/, "")}${p}`;

  async function req(path, init = {}) {
    const res = await fetch(url(path), {
      ...init,
      headers: { ...h, ...(init.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err?.detail)
        ? err.detail.map((d) => d.msg).join("; ")
        : err?.detail || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.blob();
  }

  return {
    ping: () => fetch(url("/ping")).then((r) => r.json()),
    uploadVideo: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return req("/v1/videos/upload", { method: "POST", body: fd });
    },
    downloadVideo: (id) => req(`/v1/videos/${id}/download`),
    getAssociations: (id) => req(`/v1/videos/${id}/associations`),
    submitPose2d: (id) =>
      req("/v1/pose2d/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_video_id: id }),
      }),
    submitPose3d: (id) =>
      req("/v1/pose3d/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_video_id: id }),
      }),
    submitCustomV1: (id) =>
      req("/v1/custom_v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_video_id: id }),
      }),
    getJob: (id) => req(`/v1/jobs/${id}`),
    listJobs: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, v));
      const qs = q.toString();
      return req(`/v1/jobs${qs ? `?${qs}` : ""}`);
    },
    cancelJob: (id) => req(`/v1/jobs/${id}/cancel`, { method: "POST" }),
    downloadArtifacts: (id) => req(`/v1/jobs/${id}/artifacts/download`),
  };
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(u);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function fmtRelative(d) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colors = {
    queued: "#f59e0b",
    running: "#3b82f6",
    succeeded: "#10b981",
    failed: "#ef4444",
  };
  const icons = { queued: "⏳", running: "⚡", succeeded: "✓", failed: "✗" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: colors[status] + "22",
        color: colors[status],
        border: `1px solid ${colors[status]}44`,
      }}
    >
      <span>{icons[status]}</span>
      {status}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts, remove }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: t.type === "error" ? "#1a0a0a" : "#0a1a10",
            border: `1px solid ${t.type === "error" ? "#ef444466" : "#10b98166"}`,
            color: t.type === "error" ? "#fca5a5" : "#6ee7b7",
            fontSize: 13,
            maxWidth: 360,
            cursor: "pointer",
            animation: "slideIn 0.2s ease",
            boxShadow: "0 4px 24px #0008",
          }}
        >
          <strong>{t.type === "error" ? "⚠ Error" : "✓ Success"}</strong>
          <div style={{ marginTop: 4, opacity: 0.85 }}>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, toast: add, remove };
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid #ffffff22`,
        borderTopColor: "#a78bfa",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

// ─── Input / Button primitives ────────────────────────────────────────────────

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b7cf8" }}>{label}</label>}
      <input
        {...props}
        style={{
          background: "#0f0f1a",
          border: "1px solid #2a2a40",
          borderRadius: 8,
          color: "#e2e0ff",
          padding: "9px 13px",
          fontSize: 13,
          outline: "none",
          transition: "border-color 0.2s",
          width: "100%",
          boxSizing: "border-box",
          ...props.style,
        }}
        onFocus={(e) => { e.target.style.borderColor = "#7c3aed"; }}
        onBlur={(e) => { e.target.style.borderColor = "#2a2a40"; }}
      />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b7cf8" }}>{label}</label>}
      <select
        {...props}
        style={{
          background: "#0f0f1a",
          border: "1px solid #2a2a40",
          borderRadius: 8,
          color: "#e2e0ff",
          padding: "9px 13px",
          fontSize: 13,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          cursor: "pointer",
          ...props.style,
        }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", loading, ...props }) {
  const styles = {
    primary: { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", border: "none" },
    secondary: { background: "#1a1a2e", color: "#a78bfa", border: "1px solid #2a2a50" },
    danger: { background: "#1a0808", color: "#f87171", border: "1px solid #7f1d1d" },
    ghost: { background: "transparent", color: "#8b7cf8", border: "1px solid #2a2a40" },
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 18px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: props.disabled || loading ? "not-allowed" : "pointer",
        opacity: props.disabled || loading ? 0.6 : 1,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        ...styles[variant],
        ...props.style,
      }}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#0d0d1f",
        border: "1px solid #1e1e35",
        borderRadius: 14,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e2e0ff" }}>{title}</h2>
      </div>
      {sub && <p style={{ margin: "6px 0 0 32px", fontSize: 13, color: "#6b6b8a" }}>{sub}</p>}
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({ client, onConnect, toast }) {
  const [baseUrl, setBaseUrl] = useState(client?.baseUrl || "");
  const [subject, setSubject] = useState(client?.subject || "");
  const [apiKey, setApiKey] = useState(client?.apiKey || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleConnect() {
    if (!baseUrl || !subject || !apiKey) {
      toast("Please fill in all fields", "error");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const c = createClient(baseUrl.trim(), subject.trim(), apiKey.trim());
      const res = await c.ping();
      setStatus({ ok: true, msg: JSON.stringify(res) });
      onConnect(c, { baseUrl: baseUrl.trim(), subject: subject.trim(), apiKey: apiKey.trim() });
      toast("Connected successfully!");
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 540 }}>
      <SectionTitle icon="⚙️" title="API Configuration" sub="Connect to your WHAM backend" />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Base URL"
            placeholder="https://api.example.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <Input
            label="X-WHAM-Subject"
            placeholder="your-subject-id"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Input
            label="X-WHAM-Api-Key"
            type="password"
            placeholder="••••••••••••"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Btn loading={loading} onClick={handleConnect}>
            🔌 Connect & Test Ping
          </Btn>
          {status && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: status.ok ? "#0a1a1066" : "#1a0a0a66",
                border: `1px solid ${status.ok ? "#10b98144" : "#ef444444"}`,
                color: status.ok ? "#6ee7b7" : "#fca5a5",
                fontSize: 12,
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {status.ok ? "✓ " : "✗ "}
              {status.msg}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Upload Page ──────────────────────────────────────────────────────────────

function UploadPage({ client, onUploaded, toast }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  function handleFile(f) {
    if (f) setFile(f);
  }

  async function handleUpload() {
    if (!file || !client) return;
    setLoading(true);
    setProgress(0);
    try {
      const timer = setInterval(() => setProgress((p) => Math.min(p + 8, 88)), 180);
      const res = await client.uploadVideo(file);
      clearInterval(timer);
      setProgress(100);
      setResult(res);
      onUploaded(res);
      toast(`Video uploaded: ${res.video_id}`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionTitle icon="📤" title="Upload Video" sub="Upload a source video to process with pose estimation" />
      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "#7c3aed" : "#2a2a40"}`,
            borderRadius: 12,
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            background: dragOver ? "#7c3aed11" : "transparent",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <div style={{ color: "#8b7cf8", fontWeight: 600, fontSize: 15 }}>
            {file ? file.name : "Drop video here or click to browse"}
          </div>
          {file && (
            <div style={{ color: "#6b6b8a", fontSize: 12, marginTop: 6 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>

        {loading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8b7cf8", marginBottom: 6 }}>
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: "#1a1a30", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#7c3aed,#4f46e5)", borderRadius: 999, transition: "width 0.2s" }} />
            </div>
          </div>
        )}

        <Btn loading={loading} disabled={!file || !client} onClick={handleUpload}>
          📤 Upload Video
        </Btn>

        {result && (
          <div style={{ marginTop: 20, padding: 16, background: "#0a1a1044", borderRadius: 10, border: "1px solid #10b98133" }}>
            <div style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 700, marginBottom: 10 }}>✓ Upload Successful</div>
            <InfoRow label="Video ID" value={result.video_id} mono />
            <InfoRow label="Filename" value={result.filename} />
            <InfoRow label="Status" value={result.status} />
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Submit Job Page ──────────────────────────────────────────────────────────

function SubmitJobPage({ client, lastVideoId, toast }) {
  const [videoId, setVideoId] = useState(lastVideoId || "");
  const [type, setType] = useState("pose2d");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (lastVideoId) setVideoId(lastVideoId); }, [lastVideoId]);

  async function handleSubmit() {
    if (!client || !videoId) return;
    setLoading(true);
    try {
      let res;
      if (type === "pose2d") res = await client.submitPose2d(videoId.trim());
      else if (type === "pose3d") res = await client.submitPose3d(videoId.trim());
      else res = await client.submitCustomV1(videoId.trim());
      setResult(res);
      toast(`Job submitted: ${res.job_id}`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const typeInfo = {
    pose2d: { label: "Pose 2D", icon: "🦴", desc: "2D skeleton estimation via GPU Docker job" },
    pose3d: { label: "Pose 3D", icon: "🧊", desc: "3D pose estimation with preprocessing reuse" },
    custom_v1: { label: "Custom V1", icon: "🔬", desc: "WHAM custom demo pipeline" },
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionTitle icon="🚀" title="Submit Job" sub="Launch a pose estimation job on an uploaded video" />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Source Video ID"
            placeholder="e.g. vid_abc123"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
          />

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b7cf8", display: "block", marginBottom: 10 }}>
              Job Type
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {TRANSFORM_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    borderRadius: 10,
                    border: `2px solid ${type === t ? "#7c3aed" : "#1e1e35"}`,
                    background: type === t ? "#7c3aed22" : "#0d0d1f",
                    color: type === t ? "#c4b5fd" : "#6b6b8a",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{typeInfo[t].icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{typeInfo[t].label}</div>
                </button>
              ))}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6b6b8a" }}>{typeInfo[type].desc}</p>
          </div>

          <Btn loading={loading} disabled={!videoId || !client} onClick={handleSubmit}>
            🚀 Submit Job
          </Btn>

          {result && (
            <div style={{ marginTop: 4, padding: 16, background: "#0a0a2044", borderRadius: 10, border: "1px solid #4f46e533" }}>
              <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, marginBottom: 10 }}>Job Accepted</div>
              <InfoRow label="Job ID" value={result.job_id} mono />
              <InfoRow label="Job Name" value={result.job_name} />
              <InfoRow label="Type" value={result.transform_type} />
              <InfoRow label="Status" value={<StatusBadge status={result.status} />} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Jobs List Page ───────────────────────────────────────────────────────────

function JobsPage({ client, toast }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "", job_type: "", source_video_id: "", limit: 50, offset: 0 });
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async (f = filters) => {
    if (!client) return;
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const res = await client.listJobs(params);
      setJobs(res.jobs);
      setTotal(res.total);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [client, filters]);

  useEffect(() => { load(); }, [client]);

  function setFilter(k, v) {
    const f = { ...filters, [k]: v, offset: 0 };
    setFilters(f);
    load(f);
  }

  async function handleCancel(jobId) {
    setActionLoading((a) => ({ ...a, [jobId]: "cancel" }));
    try {
      const res = await client.cancelJob(jobId);
      toast(`Job ${jobId} cancelled`);
      setJobs((js) => js.map((j) => (j.job_id === jobId ? res : j)));
      if (selected?.job_id === jobId) setSelected(res);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setActionLoading((a) => ({ ...a, [jobId]: null }));
    }
  }

  async function handleRefreshJob(jobId) {
    setActionLoading((a) => ({ ...a, [jobId]: "refresh" }));
    try {
      const res = await client.getJob(jobId);
      setJobs((js) => js.map((j) => (j.job_id === jobId ? res : j)));
      if (selected?.job_id === jobId) setSelected(res);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setActionLoading((a) => ({ ...a, [jobId]: null }));
    }
  }

  async function handleDownloadArtifacts(jobId) {
    setActionLoading((a) => ({ ...a, [jobId]: "dl" }));
    try {
      const blob = await client.downloadArtifacts(jobId);
      downloadBlob(blob, `artifacts-${jobId}.zip`);
      toast("Artifacts downloaded");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setActionLoading((a) => ({ ...a, [jobId]: null }));
    }
  }

  return (
    <div>
      <SectionTitle icon="📋" title="Jobs" sub={`${total} total jobs`} />
      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <Select label="Status" options={JOB_STATUS} value={filters.status} onChange={(e) => setFilter("status", e.target.value)} />
          <Select label="Type" options={TRANSFORM_TYPES} value={filters.job_type} onChange={(e) => setFilter("job_type", e.target.value)} />
          <Input
            label="Source Video ID"
            placeholder="Filter by video ID"
            value={filters.source_video_id}
            onChange={(e) => setFilter("source_video_id", e.target.value)}
          />
          <Btn variant="ghost" loading={loading} onClick={() => load()}>↺ Refresh</Btn>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {jobs.length === 0 && !loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#3a3a55" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div>No jobs found</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e35" }}>
                  {["Job Name", "Type", "Status", "Source Video", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b6b8a", letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr
                    key={job.job_id}
                    onClick={() => setSelected(job)}
                    style={{
                      borderBottom: "1px solid #12122088",
                      background: selected?.job_id === job.job_id ? "#16163066" : i % 2 === 0 ? "#0d0d1f" : "#0a0a1a",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                  >
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#e2e0ff", fontSize: 12 }}>{job.job_name}</div>
                      <div style={{ fontSize: 10, color: "#4a4a6a", fontFamily: "monospace" }}>{job.job_id.slice(0, 16)}…</div>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontSize: 11, background: "#1a1a30", padding: "3px 8px", borderRadius: 6, color: "#a78bfa" }}>{job.transform_type || "—"}</span>
                    </td>
                    <td style={{ padding: "11px 16px" }}><StatusBadge status={job.status} /></td>
                    <td style={{ padding: "11px 16px", fontSize: 11, fontFamily: "monospace", color: "#6b6b8a" }}>
                      {job.source_video_id ? job.source_video_id.slice(0, 12) + "…" : "—"}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "#6b6b8a" }}>{fmtRelative(job.created_at)}</td>
                    <td style={{ padding: "11px 16px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 11 }} loading={actionLoading[job.job_id] === "refresh"} onClick={() => handleRefreshJob(job.job_id)}>↺</Btn>
                        {(job.status === "queued" || job.status === "running") && (
                          <Btn variant="danger" style={{ padding: "5px 10px", fontSize: 11 }} loading={actionLoading[job.job_id] === "cancel"} onClick={() => handleCancel(job.job_id)}>✕</Btn>
                        )}
                        {job.status === "succeeded" && (
                          <Btn variant="secondary" style={{ padding: "5px 10px", fontSize: 11 }} loading={actionLoading[job.job_id] === "dl"} onClick={() => handleDownloadArtifacts(job.job_id)}>⬇</Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Job Detail Panel */}
      {selected && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#e2e0ff" }}>Job Detail</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
            <InfoRow label="Job ID" value={selected.job_id} mono />
            <InfoRow label="Job Name" value={selected.job_name} />
            <InfoRow label="Status" value={<StatusBadge status={selected.status} />} />
            <InfoRow label="Type" value={selected.transform_type || "—"} />
            <InfoRow label="Source Video" value={selected.source_video_id || "—"} mono />
            <InfoRow label="Result Video" value={selected.result_video_id || "—"} mono />
            <InfoRow label="Container" value={selected.container_name || "—"} />
            <InfoRow label="Pod" value={selected.pod_name || "—"} />
            <InfoRow label="Backend" value={selected.execution_backend || "—"} />
            <InfoRow label="Exit Code" value={selected.exit_code ?? "—"} />
            <InfoRow label="Created" value={fmtDate(selected.created_at)} />
            <InfoRow label="Updated" value={fmtDate(selected.updated_at)} />
          </div>
          {selected.error_summary && (
            <div style={{ marginTop: 12, padding: 12, background: "#1a080844", border: "1px solid #7f1d1d44", borderRadius: 8, fontSize: 12, color: "#fca5a5", fontFamily: "monospace" }}>
              {selected.error_summary}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Associations Page ────────────────────────────────────────────────────────

function AssociationsPage({ client, lastVideoId, toast }) {
  const [videoId, setVideoId] = useState(lastVideoId || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (lastVideoId) setVideoId(lastVideoId); }, [lastVideoId]);

  async function handleFetch() {
    if (!client || !videoId) return;
    setLoading(true);
    try {
      const res = await client.getAssociations(videoId.trim());
      setResult(res);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <SectionTitle icon="🔗" title="Video Lineage" sub="View derived videos and job associations for a source video" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Source Video ID"
              placeholder="e.g. vid_abc123"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
            />
          </div>
          <Btn loading={loading} disabled={!videoId || !client} onClick={handleFetch}>
            🔍 Fetch Lineage
          </Btn>
        </div>
      </Card>

      {result && (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: "#6b6b8a", textTransform: "uppercase", fontWeight: 700 }}>Source Video</span>
            <div style={{ fontFamily: "monospace", color: "#a78bfa", fontSize: 14, marginTop: 4 }}>{result.source_video_id}</div>
          </div>
          {result.derived_videos.length === 0 ? (
            <div style={{ color: "#3a3a55", textAlign: "center", padding: 24 }}>No derived videos found</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.derived_videos.map((d, i) => (
                <div key={i} style={{ padding: 14, background: "#0a0a1a", borderRadius: 10, border: "1px solid #1e1e35", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                  <InfoRow label="Result Video" value={d.result_video_id.slice(0, 16) + "…"} mono />
                  <InfoRow label="Transform" value={d.transform_type} />
                  <InfoRow label="Job ID" value={d.job_id.slice(0, 12) + "…"} mono />
                  <InfoRow label="Status" value={<StatusBadge status={d.status} />} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Download Page ────────────────────────────────────────────────────────────

function DownloadPage({ client, toast }) {
  const [videoId, setVideoId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDownloadVideo() {
    if (!client || !videoId) return;
    setLoading(true);
    try {
      const blob = await client.downloadVideo(videoId.trim());
      downloadBlob(blob, `video-${videoId.trim()}`);
      toast("Video download started");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadArtifacts() {
    if (!client || !jobId) return;
    setLoading(true);
    try {
      const blob = await client.downloadArtifacts(jobId.trim());
      downloadBlob(blob, `artifacts-${jobId.trim()}.zip`);
      toast("Artifacts download started");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionTitle icon="⬇️" title="Downloads" sub="Download videos and job artifacts" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", color: "#c4b5fd", fontSize: 15 }}>🎬 Download Video</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input label="Video ID" placeholder="vid_abc123" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
            </div>
            <Btn loading={loading} disabled={!videoId || !client} onClick={handleDownloadVideo}>⬇ Download</Btn>
          </div>
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 16px", color: "#c4b5fd", fontSize: 15 }}>📦 Download Job Artifacts</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input label="Job ID" placeholder="job_xyz789" value={jobId} onChange={(e) => setJobId(e.target.value)} />
            </div>
            <Btn loading={loading} disabled={!jobId || !client} onClick={handleDownloadArtifacts}>⬇ Download ZIP</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, color: "#4a4a6a", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#c4b5fd", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "upload", label: "Upload", icon: "📤" },
  { id: "submit", label: "Submit Job", icon: "🚀" },
  { id: "jobs", label: "Jobs", icon: "📋" },
  { id: "associations", label: "Lineage", icon: "🔗" },
  { id: "downloads", label: "Downloads", icon: "⬇️" },
];

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("settings");
  const [client, setClient] = useState(null);
  const [lastVideoId, setLastVideoId] = useState(null);
  const { toasts, toast, remove } = useToast();

  function handleConnect(c) {
    setClient(c);
    setTimeout(() => setPage("upload"), 600);
  }

  function handleUploaded(res) {
    setLastVideoId(res.video_id);
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #07071a; color: #e2e0ff; font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=DM+Mono&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d1f; }
        ::-webkit-scrollbar-thumb { background: #2a2a50; border-radius: 3px; }
        select option { background: #0f0f1a; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <nav style={{
          width: 220,
          background: "#09091f",
          borderRight: "1px solid #1a1a35",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ padding: "0 20px 28px" }}>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", color: "#e2e0ff" }}>
              <span style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>WHAM</span>
            </div>
            <div style={{ fontSize: 11, color: "#3a3a55", marginTop: 2, letterSpacing: "0.1em" }}>MEDIA + POSE API</div>
          </div>

          {/* Connection indicator */}
          <div style={{ margin: "0 12px 20px", padding: "8px 12px", borderRadius: 8, background: client ? "#0a1a1033" : "#1a0a0a33", border: `1px solid ${client ? "#10b98122" : "#7f1d1d22"}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: client ? "#10b981" : "#4b1818", boxShadow: client ? "0 0 6px #10b981" : "none" }} />
            <span style={{ fontSize: 11, color: client ? "#6ee7b7" : "#6b3a3a" }}>{client ? "Connected" : "Disconnected"}</span>
          </div>

          {/* Nav items */}
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                margin: "1px 8px",
                borderRadius: 8,
                border: "none",
                background: page === n.id ? "#7c3aed22" : "transparent",
                color: page === n.id ? "#c4b5fd" : "#4a4a7a",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: page === n.id ? 600 : 400,
                transition: "all 0.15s",
                borderLeft: page === n.id ? "3px solid #7c3aed" : "3px solid transparent",
                textAlign: "left",
              }}
            >
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto", minWidth: 0 }}>
          {page === "settings" && <SettingsPage client={client} onConnect={handleConnect} toast={toast} />}
          {page === "upload" && <UploadPage client={client} onUploaded={handleUploaded} toast={toast} />}
          {page === "submit" && <SubmitJobPage client={client} lastVideoId={lastVideoId} toast={toast} />}
          {page === "jobs" && <JobsPage client={client} toast={toast} />}
          {page === "associations" && <AssociationsPage client={client} lastVideoId={lastVideoId} toast={toast} />}
          {page === "downloads" && <DownloadPage client={client} toast={toast} />}
        </main>
      </div>

      <Toast toasts={toasts} remove={remove} />
    </>
  );
}
