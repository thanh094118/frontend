# WHAM UI — Frontend Dashboard

Frontend React cho WHAM Media + Pose API.

## Cấu trúc thư mục

```
wham-ui/
├── index.html                  # Entry HTML
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                # React entry point
    ├── App.jsx                 # Main app component (all pages)
    │
    ├── types/
    │   └── index.ts            # TypeScript types từ OpenAPI spec
    │
    ├── api/
    │   └── client.ts           # API client (gọi tất cả endpoints)
    │
    ├── store/
    │   └── auth.ts             # Zustand store: lưu config + client instance
    │
    └── hooks/
        ├── useJobs.ts          # Hook: submit/list/cancel/download jobs
        └── useVideos.ts        # Hook: upload/download/associations
```

## Cài đặt & chạy

```bash
# 1. Cài dependencies
npm install

# 2. Chạy dev server
npm run dev
# → http://localhost:3000

# 3. Build production
npm run build
```

## Hướng dẫn sử dụng

### Bước 1 — Kết nối API (trang Settings)
- Nhập **Base URL** (VD: `https://api.example.com`)
- Nhập **X-WHAM-Subject** header
- Nhập **X-WHAM-Api-Key** header
- Nhấn **Connect & Test Ping** → kiểm tra `/ping`

### Bước 2 — Upload Video (trang Upload)
- Kéo thả hoặc chọn file video
- Nhấn **Upload Video** → gọi `POST /v1/videos/upload`
- Sau khi xong: `video_id` tự động truyền sang trang Submit Job

### Bước 3 — Submit Job (trang Submit Job)
- `Source Video ID` tự điền từ bước 2
- Chọn loại job: **Pose 2D** / **Pose 3D** / **Custom V1**
- Nhấn **Submit Job** → gọi endpoint tương ứng

### Bước 4 — Theo dõi Jobs (trang Jobs)
- Xem danh sách tất cả jobs với filter: status, type, video ID
- Click vào row để xem chi tiết
- Nút **↺** refresh status một job
- Nút **✕** cancel job đang chạy
- Nút **⬇** download artifacts (job succeeded)

### Bước 5 — Xem Lineage (trang Lineage)
- Nhập `video_id` → xem tất cả derived videos từ video gốc
- Hiển thị transform type, job ID, status của từng derived video

### Bước 6 — Downloads (trang Downloads)
- Download video gốc theo `video_id`
- Download zip artifacts theo `job_id`

## Authentication

Tất cả requests (trừ `/ping`) đều tự động đính kèm:
```
X-WHAM-Subject: <subject>
X-WHAM-Api-Key: <api_key>
```

Config được lưu vào `localStorage` qua Zustand persist.

## API Endpoints được tích hợp

| Method | Path | Chức năng |
|--------|------|-----------|
| GET | /ping | Health check |
| POST | /v1/videos/upload | Upload video |
| GET | /v1/videos/{id}/download | Download video |
| GET | /v1/videos/{id}/associations | Xem lineage |
| POST | /v1/pose2d/jobs | Submit Pose2D job |
| POST | /v1/pose3d/jobs | Submit Pose3D job |
| POST | /v1/custom_v1/jobs | Submit Custom V1 job |
| GET | /v1/jobs | List jobs (có filter) |
| GET | /v1/jobs/{id} | Get job status |
| POST | /v1/jobs/{id}/cancel | Cancel job |
| GET | /v1/jobs/{id}/artifacts/download | Download artifacts |
