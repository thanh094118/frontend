import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const JOB_STATUS = ["queued", "running", "succeeded", "failed"];
const TRANSFORM_TYPES = ["pose2d", "pose3d", "custom_v1"];

// ─── FAKE / MOCK CLIENT ───────────────────────────────────────────────────────
const FAKE_VIDEO_ID = "vid_adca9152e6a74755";
const FAKE_JOB_ID   = "job_ea54c9724e6f";

function delay(ms = 600) { return new Promise(r => setTimeout(r, ms)); }

function createClient(baseUrl, subject, apiKey) {
  return {
    ping: async () => { await delay(500); return { status: "ok", message: "pong" }; },
    uploadVideo: async (file) => {
      await delay(1200);
      return { video_id: FAKE_VIDEO_ID, filename: file?.name || "video.mp4", status: "uploaded" };
    },
    downloadVideo: async () => { await delay(400); return new Blob(["fake"], { type: "video/mp4" }); },
    getAssociations: async (id) => {
      await delay(400);
      return { source_video_id: id, derived_videos: [{ result_video_id: "vid_result_" + id.slice(-8), transform_type: "pose2d", job_id: FAKE_JOB_ID, status: "succeeded" }] };
    },
    submitPose2d: async (id) => { await delay(700); return { job_id: FAKE_JOB_ID, job_name: "pose2d-" + FAKE_JOB_ID, transform_type: "pose2d", status: "queued", source_video_id: id }; },
    submitPose3d: async (id) => { await delay(700); return { job_id: FAKE_JOB_ID, job_name: "pose3d-" + FAKE_JOB_ID, transform_type: "pose3d", status: "queued", source_video_id: id }; },
    submitCustomV1: async (id) => { await delay(700); return { job_id: FAKE_JOB_ID, job_name: "custom_v1-" + FAKE_JOB_ID, transform_type: "custom_v1", status: "queued", source_video_id: id }; },
    getJob: async (id) => {
      await delay(400);
      return { job_id: id || FAKE_JOB_ID, job_name: "pose2d-" + (id || FAKE_JOB_ID), transform_type: "pose2d", status: "succeeded", source_video_id: FAKE_VIDEO_ID, result_video_id: "vid_result_" + (id || FAKE_JOB_ID).slice(-8), container_name: "wham-worker-01", pod_name: "wham-pod-01", execution_backend: "kubernetes", exit_code: 0, created_at: new Date(Date.now() - 60000).toISOString(), updated_at: new Date().toISOString() };
    },
    listJobs: async () => {
      await delay(400);
      return { jobs: [{ job_id: FAKE_JOB_ID, job_name: "pose2d-" + FAKE_JOB_ID, transform_type: "pose2d", status: "succeeded", source_video_id: FAKE_VIDEO_ID, result_video_id: "vid_result_" + FAKE_JOB_ID.slice(-8), execution_backend: "kubernetes", exit_code: 0, created_at: new Date(Date.now() - 120000).toISOString(), updated_at: new Date().toISOString() }], total: 1 };
    },
    cancelJob: async (id) => { await delay(400); return { job_id: id, status: "failed", source_video_id: FAKE_VIDEO_ID, created_at: new Date(Date.now() - 120000).toISOString(), updated_at: new Date().toISOString() }; },
    downloadArtifacts: async () => { await delay(600); return new Blob(["PK\x03\x04fake-zip"], { type: "application/zip" }); },
  };
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleString(); }
function fmtRelative(d) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
function rand(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ─── Pose3D base data ─────────────────────────────────────────────────────────
const BASE_POSE = {
  frame: 0, person_id: 0, format: "openpose_25",
  keypoints: {
    "Nose": [-0.46405521035194397, 0.10812608897686005, 3.966158390045166],
    "Neck": [-0.4344426989555359, 0.11841117590665817, 3.891134262084961],
    "RShoulder": [-0.25755029916763306, 0.18972203135490417, 3.8929851055145264],
    "RElbow": [-0.11962132155895233, 0.3852120637893677, 3.772505283355713],
    "RWrist": [-0.12872202694416046, 0.6573946475982666, 3.775360345840454],
    "LShoulder": [-0.5743988752365112, 0.1929171085357666, 3.7802107334136963],
    "LElbow": [-0.6018891334533691, 0.3980373442173004, 3.5989625453948975],
    "LWrist": [-0.5994969010353088, 0.6598762273788452, 3.5967233180999756],
    "MidHip": [-0.3273801803588867, 0.4923105835914612, 3.6096153259277344],
    "RHip": [-0.25762367248535156, 0.581637442111969, 3.627702474594116],
    "RKnee": [-0.06427112966775894, 0.8662225604057312, 3.862076759338379],
    "RAnkle": [0.12135676294565201, 1.2322052717208862, 3.99953293800354],
    "LHip": [-0.3872300088405609, 0.585888147354126, 3.5754599571228027],
    "LKnee": [-0.651842474937439, 0.8979119062423706, 3.6273953914642334],
    "LAnkle": [-0.8526386618614197, 1.2805838584899902, 3.6441712379455566],
    "REye": [-0.46405521035194397, 0.10812608897686005, 3.966158390045166],
    "LEye": [-0.46405521035194397, 0.10812608897686005, 3.966158390045166],
    "REar": [-0.46405521035194397, 0.10812608897686005, 3.966158390045166],
    "LEar": [-0.46405521035194397, 0.10812608897686005, 3.966158390045166],
    "LBigToe": [-0.938114583492279, 1.3128567934036255, 3.7477309703826904],
    "LSmallToe": [-0.938114583492279, 1.3128567934036255, 3.7477309703826904],
    "LHeel": [-0.8526386618614197, 1.2805838584899902, 3.6441712379455566],
    "RBigToe": [0.12180180102586746, 1.260570764541626, 4.137834548950195],
    "RSmallToe": [0.12180180102586746, 1.260570764541626, 4.137834548950195],
    "RHeel": [0.12135676294565201, 1.2322052717208862, 3.99953293800354],
  }
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  const remove = (id) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, toast: add, remove };
}

function Toast({ toasts, remove }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => remove(t.id)} style={{
          padding: "10px 16px", borderRadius: 6,
          background: t.type === "error" ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${t.type === "error" ? "#fca5a5" : "#86efac"}`,
          color: t.type === "error" ? "#dc2626" : "#16a34a",
          fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          maxWidth: 360,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const S = {
  input: {
    border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px",
    fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
    background: "#fff", color: "#111", fontFamily: "inherit",
  },
  btn: {
    border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 16px",
    fontSize: 13, cursor: "pointer", background: "#fff", color: "#374151",
    fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 6,
  },
  btnPrimary: {
    border: "1px solid #111", borderRadius: 6, padding: "8px 16px",
    fontSize: 13, cursor: "pointer", background: "#111", color: "#fff",
    fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 6,
  },
  card: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, background: "#fff" },
  label: { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 },
};

// ─── Primitives ───────────────────────────────────────────────────────────────
function Input({ label, ...props }) {
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <input {...props} style={{ ...S.input, ...props.style }}
        onFocus={e => e.target.style.borderColor = "#111"}
        onBlur={e => e.target.style.borderColor = "#d1d5db"} />
    </div>
  );
}

function Btn({ children, primary, loading, style, ...props }) {
  return (
    <button {...props} disabled={props.disabled || loading}
      style={{ ...(primary ? S.btnPrimary : S.btn), opacity: props.disabled || loading ? 0.5 : 1, cursor: props.disabled || loading ? "not-allowed" : "pointer", ...style }}>
      {loading && <span style={{ width: 12, height: 12, border: "2px solid", borderColor: primary ? "rgba(255,255,255,0.3)" : "#d1d5db", borderTopColor: primary ? "#fff" : "#374151", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
      {children}
    </button>
  );
}

function StatusDot({ status }) {
  const c = { queued: "#f59e0b", running: "#3b82f6", succeeded: "#10b981", failed: "#ef4444" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: c[status] || "#6b7280" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c[status] || "#ccc", flexShrink: 0 }} />
      {status}
    </span>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111" }}>{title}</h2>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{sub}</p>}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsPage({ client, onConnect, toast }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleConnect() {
    if (!baseUrl || !subject || !apiKey) { toast("Vui lòng điền đầy đủ thông tin", "error"); return; }
    setLoading(true); setStatus(null);
    try {
      const c = createClient(baseUrl.trim(), subject.trim(), apiKey.trim());
      const res = await c.ping();
      setStatus({ ok: true, msg: JSON.stringify(res) });
      onConnect(c);
      toast("Kết nối thành công");
    } catch (e) { setStatus({ ok: false, msg: e.message }); toast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle title="API Configuration" sub="Kết nối tới WHAM backend" />
      <div style={S.card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Base URL" placeholder="https://api.example.com" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
          <Input label="X-WHAM-Subject" placeholder="your-subject-id" value={subject} onChange={e => setSubject(e.target.value)} />
          <Input label="X-WHAM-Api-Key" type="password" placeholder="••••••••" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <Btn primary loading={loading} onClick={handleConnect}>Connect & Test Ping</Btn>
          {status && (
            <div style={{ padding: "10px 14px", borderRadius: 6, background: status.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${status.ok ? "#86efac" : "#fca5a5"}`, color: status.ok ? "#16a34a" : "#dc2626", fontSize: 12, fontFamily: "monospace" }}>
              {status.ok ? "OK: " : "Error: "}{status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function UploadPage({ client, onUploaded, toast }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  async function handleUpload() {
    if (!file || !client) return;
    setLoading(true); setProgress(0);
    try {
      await new Promise(resolve => {
        let p = 0;
        const t = setInterval(() => { p = Math.min(p + 10, 100); setProgress(p); if (p >= 100) { clearInterval(t); resolve(); } }, 120);
      });
      const res = await client.uploadVideo(file);
      setResult(res); onUploaded(res);
      toast(`Video uploaded: ${res.video_id}`);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle title="Upload Video" />
      <div style={S.card}>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? "#111" : "#d1d5db"}`, borderRadius: 8, padding: "32px 20px", textAlign: "center", cursor: "pointer", marginBottom: 16, background: dragOver ? "#f9fafb" : "#fff" }}
        >
          <div style={{ fontSize: 13, color: "#6b7280" }}>{file ? file.name : "Kéo thả video hoặc click để chọn"}</div>
          {file && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>}
          <input ref={inputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => e.target.files[0] && setFile(e.target.files[0])} />
        </div>
        {loading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              <span>Uploading...</span><span>{progress}%</span>
            </div>
            <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#111", borderRadius: 2, transition: "width 0.15s" }} />
            </div>
          </div>
        )}
        <Btn primary loading={loading} disabled={!file || !client} onClick={handleUpload}>Upload Video</Btn>
        {result && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, fontFamily: "monospace" }}>
            <div style={{ color: "#16a34a", fontWeight: 600, marginBottom: 6 }}>Upload thành công</div>
            <div>video_id: <strong>{result.video_id}</strong></div>
            <div>filename: {result.filename}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Submit Job ───────────────────────────────────────────────────────────────
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
      setResult(res); toast(`Job submitted: ${res.job_id}`);
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle title="Submit Job" />
      <div style={S.card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Source Video ID" placeholder="vid_..." value={videoId} onChange={e => setVideoId(e.target.value)} />
          <div>
            <label style={S.label}>Job Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {TRANSFORM_TYPES.map(t => (
                <button key={t} onClick={() => setType(t)} style={{ ...S.btn, flex: 1, justifyContent: "center", background: type === t ? "#111" : "#fff", color: type === t ? "#fff" : "#374151", borderColor: type === t ? "#111" : "#d1d5db" }}>{t}</button>
              ))}
            </div>
          </div>
          <Btn primary loading={loading} disabled={!videoId || !client} onClick={handleSubmit}>Submit Job</Btn>
          {result && (
            <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12, fontFamily: "monospace" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontFamily: "inherit" }}>Job Accepted</div>
              <div>job_id: <strong>{result.job_id}</strong></div>
              <div>transform_type: {result.transform_type}</div>
              <div>status: {result.status}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
function JobsPage({ client, toast }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try { const res = await client.listJobs(); setJobs(res.jobs); setTotal(res.total); }
    catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }, [client]);

  useEffect(() => { load(); }, [client]);

  async function handleDownload(jobId) {
    try {
      const blob = await client.downloadArtifacts(jobId);
      downloadBlob(blob, `${jobId}__associated_artifacts.zip`);
      toast(`tải về thành công tại: downloads/${jobId}__associated_artifacts.zip`);
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <SectionTitle title="Jobs" sub={`${total} total`} />
        <Btn loading={loading} onClick={load}>Refresh</Btn>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No jobs found</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                {["Job ID", "Type", "Status", "Source Video", "Created", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.job_id} onClick={() => setSelected(job)} style={{ borderBottom: "1px solid #f3f4f6", background: selected?.job_id === job.job_id ? "#f9fafb" : "#fff", cursor: "pointer" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{job.job_id.slice(0, 20)}…</td>
                  <td style={{ padding: "10px 14px" }}>{job.transform_type || "—"}</td>
                  <td style={{ padding: "10px 14px" }}><StatusDot status={job.status} /></td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{job.source_video_id?.slice(0, 14)}…</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#9ca3af" }}>{fmtRelative(job.created_at)}</td>
                  <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                    {job.status === "succeeded" && <Btn style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleDownload(job.job_id)}>Download</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Job Detail</span>
            <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: 12 }}>
            {[["Job ID", selected.job_id, true], ["Status", selected.status], ["Type", selected.transform_type], ["Source Video", selected.source_video_id, true], ["Created", fmtDate(selected.created_at)], ["Updated", fmtDate(selected.updated_at)]].map(([label, val, mono]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                <div style={{ color: "#111", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{val || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Associations ─────────────────────────────────────────────────────────────
function AssociationsPage({ client, lastVideoId, toast }) {
  const [videoId, setVideoId] = useState(lastVideoId || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => { if (lastVideoId) setVideoId(lastVideoId); }, [lastVideoId]);

  async function handleFetch() {
    if (!client || !videoId) return;
    setLoading(true);
    try { setResult(await client.getAssociations(videoId.trim())); }
    catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionTitle title="Video Lineage" />
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><Input label="Source Video ID" placeholder="vid_..." value={videoId} onChange={e => setVideoId(e.target.value)} /></div>
          <Btn primary loading={loading} disabled={!videoId || !client} onClick={handleFetch}>Fetch</Btn>
        </div>
      </div>
      {result && (
        <div style={{ ...S.card, marginTop: 12 }}>
          {result.derived_videos.map((d, i) => (
            <div key={i} style={{ padding: 12, background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
              {[["Result Video", d.result_video_id.slice(0, 16) + "…", true], ["Transform", d.transform_type], ["Job ID", d.job_id.slice(0, 14) + "…", true]].map(([label, val, mono]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: mono ? "monospace" : "inherit" }}>{val}</div>
                </div>
              ))}
              <div><div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>Status</div><StatusDot status={d.status} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Downloads ────────────────────────────────────────────────────────────────
function DownloadPage({ client, toast }) {
  const [videoId, setVideoId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle title="Downloads" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Download Video</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><Input label="Video ID" placeholder="vid_..." value={videoId} onChange={e => setVideoId(e.target.value)} /></div>
            <Btn loading={loading} disabled={!videoId || !client} onClick={async () => { setLoading(true); try { const b = await client.downloadVideo(videoId.trim()); downloadBlob(b, `video-${videoId.trim()}`); toast("Video download started"); } catch (e) { toast(e.message, "error"); } finally { setLoading(false); } }}>Download</Btn>
          </div>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Download Job Artifacts</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><Input label="Job ID" placeholder="job_..." value={jobId} onChange={e => setJobId(e.target.value)} /></div>
            <Btn loading={loading} disabled={!jobId || !client} onClick={async () => { setLoading(true); try { const b = await client.downloadArtifacts(jobId.trim()); downloadBlob(b, `${jobId.trim()}__associated_artifacts.zip`); toast(`tải về thành công tại: downloads/${jobId.trim()}__associated_artifacts.zip`); } catch (e) { toast(e.message, "error"); } finally { setLoading(false); } }}>Download ZIP</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHỨC NĂNG 1: Viewer ──────────────────────────────────────────────────────
function ViewerPage() {
  const [jobId, setJobId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    if (!jobId.trim()) return;
    setLoading(true);
    await delay(500);
    setLoaded(true);
    setLoading(false);
  }

  return (
    <div>
      <SectionTitle title="Xem" sub="Xem video và dữ liệu Pose 3D" />
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><Input label="Job ID" placeholder="job_ea54c9724e6f" value={jobId} onChange={e => setJobId(e.target.value)} /></div>
          <Btn primary loading={loading} disabled={!jobId.trim()} onClick={handleLoad}>Load</Btn>
        </div>
      </div>

      {loaded && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: 540 }}>
          <div style={{ ...S.card, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb" }}>
              Video — {jobId}
            </div>
            <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video src="/asset/video.mp4" controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>

          <div style={{ ...S.card, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb" }}>
              Pose 3D — frame {BASE_POSE.frame} / person {BASE_POSE.person_id}
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              <pre style={{ margin: 0, padding: 14, fontSize: 11, lineHeight: 1.65, fontFamily: "monospace", color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(BASE_POSE, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CHỨC NĂNG 2: Modules ─────────────────────────────────────────────────────
const BASE_STATS = {
  before: [0.008417976296257687, 0.014536157976826676, 0.01219710055360099, 0.011059918038342078],
  after:  [0.006550641410254009, 0.011547556622060423, 0.010027275320081406, 0.009627343924235135],
};
const STAT_LABELS = ["Mean", "Max", "Std", "Median"];

function ModulesPage({ toast }) {
  const [stats, setStats] = useState({ before: [...BASE_STATS.before], after: [...BASE_STATS.after] });
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(null);

  const MODULES = [
    { id: "judgement", label: "Phase Judgement" },
    { id: "refinement", label: "Refinement" },
    { id: "smplify", label: "Learnable SMPLify" },
    { id: "optimization", label: "Optimization" },
  ];

  async function runModule(mod) {
    setRunning(mod.id);
    await delay(900);
    const delta = () => (Math.random() > 0.5 ? 1 : -1) * rand(0.1, 0.2, 6);
    setStats(prev => ({
      before: prev.before.map(v => parseFloat((v + delta()).toFixed(8))),
      after:  prev.after.map(v => parseFloat((v + delta()).toFixed(8))),
    }));
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${mod.label} hoàn thành`]);
    setRunning(null);
    toast(`${mod.label} đã chạy xong`);
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <SectionTitle title="Chạy module" sub="Chạy từng module xử lý và xem kết quả" />

      <div style={{ ...S.card, marginBottom: 12 }}>
        <label style={S.label}>Module</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODULES.map(mod => (
            <Btn key={mod.id} loading={running === mod.id} disabled={!!running && running !== mod.id} onClick={() => runModule(mod)}>
              {mod.label}
            </Btn>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Output Stats</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              {["Metric", "Before", "After", "Delta"].map(h => (
                <th key={h} style={{ padding: "6px 12px", textAlign: h === "Metric" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAT_LABELS.map((label, i) => {
              const b = stats.before[i], a = stats.after[i], d = a - b;
              return (
                <tr key={label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{label}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>{b.toFixed(8)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>{a.toFixed(8)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: d < 0 ? "#16a34a" : "#dc2626" }}>
                    {d > 0 ? "+" : ""}{d.toFixed(8)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {log.length > 0 && (
        <div style={S.card}>
          <label style={S.label}>Log</label>
          <div style={{ fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
            {log.map((line, i) => <div key={i} style={{ color: "#16a34a" }}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CHỨC NĂNG 3: Metrics ─────────────────────────────────────────────────────
const ALL_KP = ["Nose","Neck","RShoulder","RElbow","RWrist","LShoulder","LElbow","LWrist","MidHip","RHip","RKnee","RAnkle","LHip","LKnee","LAnkle"];

function MetricsPage({ toast }) {
  const [metric, setMetric] = useState("PCK");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function compute() {
    setLoading(true);
    await delay(700);
    const keys = [...ALL_KP].sort(() => Math.random() - 0.5).slice(0, rand(4, 8, 0));
    if (metric === "PCK") {
      setResult({ metric: "PCK", overall: `${rand(80, 90, 1)}%`, per_keypoint: Object.fromEntries(keys.map(k => [k, `${rand(75, 95, 1)}%`])) });
    } else {
      setResult({ metric, overall: `${rand(80, 110, 1)} mm`, per_keypoint: Object.fromEntries(keys.map(k => [k, `${rand(70, 115, 1)} mm`])) });
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle title="Độ đo" sub="Đánh giá chất lượng pose estimation" />
      <div style={S.card}>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Chọn độ đo</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["PCK", "MPJPE", "PA-MPJPE"].map(m => (
              <button key={m} onClick={() => { setMetric(m); setResult(null); }} style={{ ...S.btn, background: metric === m ? "#111" : "#fff", color: metric === m ? "#fff" : "#374151", borderColor: metric === m ? "#111" : "#d1d5db" }}>{m}</button>
            ))}
          </div>
        </div>
        <Btn primary loading={loading} onClick={compute}>Tính toán</Btn>

        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{result.metric} — Overall</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "#111" }}>{result.overall}</div>
            </div>
            <label style={S.label}>Per Keypoint</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(result.per_keypoint).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "#f9fafb", borderRadius: 4, border: "1px solid #e5e7eb", fontSize: 12 }}>
                  <span style={{ color: "#374151" }}>{k}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHỨC NĂNG 4: Compare ─────────────────────────────────────────────────────
const ORIGINAL = { PCK: 83.4, MPJPE: 97.2, "PA-MPJPE": 91.5 };

function ComparePage({ toast }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function compare() {
    setLoading(true);
    await delay(800);
    setResult({ PCK: rand(80, 92, 1), MPJPE: rand(80, 112, 1), "PA-MPJPE": rand(78, 108, 1) });
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <SectionTitle title="So sánh" sub="So sánh kết quả hiện tại với baseline gốc" />
      <div style={S.card}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
          Baseline gốc: PCK = {ORIGINAL.PCK}% / MPJPE = {ORIGINAL.MPJPE}mm / PA-MPJPE = {ORIGINAL["PA-MPJPE"]}mm
        </div>
        <Btn primary loading={loading} onClick={compare}>Chạy so sánh</Btn>

        {result && (
          <div style={{ marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  {["Độ đo", "Baseline", "Hiện tại", "Chênh lệch", "Đánh giá"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["PCK", "MPJPE", "PA-MPJPE"].map(m => {
                  const orig = ORIGINAL[m], curr = result[m];
                  const diff = curr - orig;
                  const isPCK = m === "PCK";
                  const better = isPCK ? diff > 0.5 : diff < -0.5;
                  const worse = isPCK ? diff < -0.5 : diff > 0.5;
                  const unit = isPCK ? "%" : "mm";
                  const diffStr = (diff > 0 ? "+" : "") + diff.toFixed(1) + unit;
                  return (
                    <tr key={m} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{orig}{unit}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700 }}>{curr}{unit}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: better ? "#16a34a" : worse ? "#dc2626" : "#6b7280" }}>{diffStr}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: better ? "#f0fdf4" : worse ? "#fef2f2" : "#f3f4f6", color: better ? "#16a34a" : worse ? "#dc2626" : "#6b7280" }}>
                          {better ? "Tốt hơn" : worse ? `Kém hơn ${Math.abs(diff).toFixed(1)}${unit}` : "Tương đương"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }}>
              {(() => {
                const n = ["PCK","MPJPE","PA-MPJPE"].filter(m => { const d = result[m] - ORIGINAL[m]; return m === "PCK" ? d > 0.5 : d < -0.5; }).length;
                if (n === 3) return "Phương án hiện tại tốt hơn baseline trên cả 3 độ đo.";
                if (n === 0) return "Phương án hiện tại chưa cải thiện so với baseline.";
                return `Phương án hiện tại tốt hơn baseline trên ${n}/3 độ đo.`;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("settings");
  const [client, setClient] = useState(null);
  const [lastVideoId, setLastVideoId] = useState(null);
  const { toasts, toast, remove } = useToast();

  const NAV_MAP = {
    settings: "API Configuration", upload: "Upload Video", submit: "Submit Job",
    jobs: "Jobs", associations: "Lineage", downloads: "Downloads",
    viewer: "Xem", modules: "Chạy module", metrics: "Độ đo", compare: "So sánh",
  };
  const GROUPS = [
    { label: "API", items: ["settings", "upload", "submit", "jobs", "associations", "downloads"] },
    { label: "Phân tích", items: ["viewer", "modules", "metrics", "compare"] },
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f9fafb; color: #111; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #f3f4f6; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        <nav style={{ width: 196, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", padding: "18px 0", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <div style={{ padding: "0 14px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>WHAM</div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, letterSpacing: "0.07em", textTransform: "uppercase" }}>Media + Pose API</div>
          </div>

          <div style={{ margin: "0 10px 14px", padding: "5px 8px", borderRadius: 5, background: "#f9fafb", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: client ? "#10b981" : "#d1d5db", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: client ? "#059669" : "#9ca3af" }}>{client ? "Connected" : "Disconnected"}</span>
          </div>

          {GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 6 }}>
              <div style={{ padding: "3px 14px 5px", fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{group.label}</div>
              {group.items.map(id => (
                <button key={id} onClick={() => setPage(id)} style={{
                  display: "block", width: "calc(100% - 16px)", margin: "1px 8px",
                  padding: "7px 8px", textAlign: "left", border: "none", borderRadius: 5,
                  fontSize: 13, background: page === id ? "#f3f4f6" : "transparent",
                  color: page === id ? "#111" : "#6b7280", fontWeight: page === id ? 600 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {NAV_MAP[id]}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main style={{ flex: 1, padding: "30px 32px", overflowY: "auto", minWidth: 0, background: "#f9fafb" }}>
          {page === "settings" && <SettingsPage client={client} onConnect={c => { setClient(c); setTimeout(() => setPage("upload"), 400); }} toast={toast} />}
          {page === "upload" && <UploadPage client={client} onUploaded={res => setLastVideoId(res.video_id)} toast={toast} />}
          {page === "submit" && <SubmitJobPage client={client} lastVideoId={lastVideoId} toast={toast} />}
          {page === "jobs" && <JobsPage client={client} toast={toast} />}
          {page === "associations" && <AssociationsPage client={client} lastVideoId={lastVideoId} toast={toast} />}
          {page === "downloads" && <DownloadPage client={client} toast={toast} />}
          {page === "viewer" && <ViewerPage />}
          {page === "modules" && <ModulesPage toast={toast} />}
          {page === "metrics" && <MetricsPage toast={toast} />}
          {page === "compare" && <ComparePage toast={toast} />}
        </main>
      </div>

      <Toast toasts={toasts} remove={remove} />
    </>
  );
}