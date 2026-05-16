# subtitle-extractor-web — API 契约文档

**端口：** 3012  
**BasePath：** `/subtitle-extractor`  
**完整前缀：** `/subtitle-extractor/api/...`

> 本文档定义所有接口的 Request / Response JSON 格式，供前端工程师并行开发使用。  
> 所有接口均返回 `Content-Type: application/json`，除 `GET /api/batch/export` 返回 Excel 二进制流。

---

## 1. POST /api/parse-video

**用途：** 解析抖音分享链接，获取视频基本信息和播放地址。

### Request

```http
POST /subtitle-extractor/api/parse-video
Content-Type: application/json
```

```json
{
  "shareText": "4.82 z@t.Rk CXD:/ 10月11日 在视频的世界里... https://v.douyin.com/iRG6XXXXX/ 复制此链接"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| shareText | string | 抖音分享文本（完整粘贴文本或纯URL均可） |

### Response 200

```json
{
  "awemeId": "7345012345678901234",
  "title": "这个方法让你的账号涨粉10倍",
  "diggCount": 12500,
  "playUrl": "https://v26-web.douyinvod.com/xxx.mp4",
  "isSubtitled": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| awemeId | string | 抖音视频唯一ID |
| title | string | 视频标题/文案 |
| diggCount | number | 点赞数 |
| playUrl | string | 视频播放地址（用于后续上传ASR） |
| isSubtitled | number | 是否有平台字幕（0=无，1=有） |

### Response 400

```json
{ "error": "shareText is required" }
```

### Response 500

```json
{ "error": "TikHub API error: 401 Unauthorized" }
```

---

## 2. POST /api/transcribe/upload

**用途：** 下载视频 → 上传到阿里云 OSS → 提交阿里云 ASR 任务，返回 taskId 供轮询使用。

### Request

```http
POST /subtitle-extractor/api/transcribe/upload
Content-Type: application/json
```

```json
{
  "playUrl": "https://v26-web.douyinvod.com/xxx.mp4"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| playUrl | string | 视频播放地址（来自 parse-video 的 playUrl） |

### Response 200

```json
{
  "taskId": "asr-task-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | string | 阿里云 ASR 任务 ID，用于轮询 |

### Response 400

```json
{ "error": "playUrl is required" }
```

### Response 502

```json
{ "error": "视频下载失败: HTTP 403" }
```

### Response 500

```json
{ "error": "ASR submit failed: {\"StatusCode\":21050006}" }
```

---

## 3. GET /api/transcribe/poll

**用途：** 查询 ASR 转写进度，前端应每 3～5 秒轮询一次，直到 status 为 done。

### Request

```http
GET /subtitle-extractor/api/transcribe/poll?taskId=asr-task-xxxxxxxx
```

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string (query) | 上传接口返回的 taskId |

### Response 200 — 转写中

```json
{
  "status": "processing"
}
```

### Response 200 — 转写完成

```json
{
  "status": "done",
  "text": "今天给大家分享一个让账号快速涨粉的方法。首先你需要……"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| status | "processing" \| "done" | 当前状态 |
| text | string \| undefined | 转写完成时的字幕文本 |

### Response 400

```json
{ "error": "taskId is required" }
```

### Response 500

```json
{ "error": "ASR error: {\"StatusCode\":21050007}" }
```

---

## 4. POST /api/mindmap

**用途：** 基于字幕文本调用 AI，生成运营视角思维导图结构。

### Request

```http
POST /subtitle-extractor/api/mindmap
Content-Type: application/json
```

```json
{
  "transcript": "今天给大家分享一个让账号快速涨粉的方法。首先你需要……"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| transcript | string | 字幕文本（来自 poll 接口的 text） |

### Response 200

```json
{
  "rootTitle": "快速涨粉的核心方法论",
  "summary": "通过精准选题和持续输出，实现账号高速增长",
  "branches": [
    {
      "title": "开头钩子",
      "children": ["直接抛出结果：涨粉10倍", "制造好奇心：别人不知道的秘诀"]
    },
    {
      "title": "用户痛点",
      "children": ["内容发了没人看", "涨粉慢、粉丝质量低"]
    },
    {
      "title": "核心卖点",
      "children": ["精准选题公式", "黄金发布时间段"]
    },
    {
      "title": "内容逻辑",
      "children": ["选题 → 脚本 → 发布 → 复盘", "数据驱动迭代"]
    },
    {
      "title": "转化动作",
      "children": ["点赞收藏转发", "评论区互动引导"]
    },
    {
      "title": "可复用建议",
      "children": ["统一视觉风格", "固定更新频率"]
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| rootTitle | string | 视频核心主题 |
| summary | string | 一句话总结 |
| branches | array | 各维度分支 |
| branches[].title | string | 分支标题 |
| branches[].children | string[] | 子要点列表 |

### Response 400

```json
{ "error": "transcript is required" }
```

### Response 500

```json
{ "error": "AI service error" }
```

---

## 5. POST /api/batch/import

**用途：** 上传 Excel 文件，异步批量解析视频并提取字幕，返回 jobId 供进度查询使用。

**Excel 格式要求：** 第一列 (A列) 为抖音链接或分享文本，首行为标题行自动跳过。

### Request

```http
POST /subtitle-extractor/api/batch/import
Content-Type: multipart/form-data
```

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | Excel 文件（.xlsx / .xls），最多 200 条 |

### Response 200

```json
{
  "jobId": "job_20260516_143052_a3f8b2c1",
  "total": 15
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| jobId | string | 批量任务唯一 ID，用于查询进度和下载结果 |
| total | number | Excel 中识别到的有效链接条数 |

### Response 400

```json
{ "error": "file is required" }
```

```json
{ "error": "Excel 为空或未找到有效链接" }
```

```json
{ "error": "Excel 最多支持 200 条，当前 350 条" }
```

### Response 500

```json
{ "error": "Excel 解析失败" }
```

---

## 6. GET /api/batch/status

**用途：** 查询批量任务进度，前端应每 5 秒轮询一次。

### Request

```http
GET /subtitle-extractor/api/batch/status?jobId=job_20260516_143052_a3f8b2c1
```

| 参数 | 类型 | 说明 |
|------|------|------|
| jobId | string (query) | 批量任务 ID |

### Response 200

```json
{
  "jobId": "job_20260516_143052_a3f8b2c1",
  "status": "processing",
  "phase": "转写中",
  "total": 15,
  "success": 8,
  "failed": 1,
  "createdAt": "2026-05-16T06:30:52.000Z",
  "updatedAt": "2026-05-16T06:34:10.000Z",
  "items": [
    {
      "rowNumber": 1,
      "originalUrl": "https://v.douyin.com/iRG6XXXXX/",
      "title": "这个方法让你的账号涨粉10倍",
      "transcript": "今天给大家分享……",
      "status": "success",
      "error": ""
    },
    {
      "rowNumber": 2,
      "originalUrl": "https://v.douyin.com/iRG7YYYYY/",
      "title": "",
      "transcript": "",
      "status": "processing",
      "error": ""
    },
    {
      "rowNumber": 3,
      "originalUrl": "https://v.douyin.com/iRG8ZZZZZ/",
      "title": "",
      "transcript": "",
      "status": "failed",
      "error": "TikHub API error: 404"
    }
  ]
}
```

**status 枚举值：**

| status | 说明 |
|--------|------|
| processing | 任务处理中 |
| completed | 全部处理完成 |
| failed | 任务整体失败（罕见，一般单项失败不影响整体） |

**phase 说明：**

| phase | 说明 |
|-------|------|
| "初始化" | 任务刚创建 |
| "解析视频中" | 正在调用 TikHub |
| "转写中" | 正在提交/等待 ASR |
| "已完成" | 所有项目处理结束 |

**items[].status 枚举值：**

| status | 说明 |
|--------|------|
| pending | 等待处理 |
| processing | 处理中 |
| success | 成功 |
| failed | 失败，详见 error 字段 |

### Response 400

```json
{ "error": "jobId is required" }
```

### Response 404

```json
{ "error": "任务不存在" }
```

---

## 7. GET /api/batch/export

**用途：** 下载批量任务结果 Excel 文件，包含 5 列。

### Request

```http
GET /subtitle-extractor/api/batch/export?jobId=job_20260516_143052_a3f8b2c1
```

| 参数 | 类型 | 说明 |
|------|------|------|
| jobId | string (query) | 批量任务 ID |

### Response 200

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="subtitles_job_20260516_143052_a3f8b2c1.xlsx"
```

**Excel 列定义（固定 5 列）：**

| 列 | 字段名 | 说明 |
|----|--------|------|
| A | 视频标题 | 从 TikHub 获取的标题 |
| B | 抖音链接 | 原始输入链接 |
| C | 转换的内容 | 字幕文本，失败时为空 |
| D | 转化的状态 | "成功" / "失败" / "处理中" |
| E | 失败的原因 | 失败时的错误信息，成功时为空 |

### Response 400

```json
{ "error": "jobId is required" }
```

### Response 404

```json
{ "error": "任务不存在" }
```

---

## 错误码汇总

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 成功 |
| 400 | 参数缺失或格式错误 |
| 404 | 资源不存在（jobId 无效等） |
| 500 | 服务端错误（第三方接口异常等） |
| 502 | 上游服务返回错误（视频下载失败等） |

## 典型调用时序

### 单条视频提取

```
1. POST /api/parse-video     → { awemeId, playUrl, ... }
2. POST /api/transcribe/upload → { taskId }
3. GET  /api/transcribe/poll?taskId=xxx  (每3s轮询)
   → { status: "processing" }
   → { status: "processing" }
   → { status: "done", text: "字幕..." }
4. POST /api/mindmap         → { rootTitle, branches, ... }
```

### 批量 Excel 提取

```
1. POST /api/batch/import    → { jobId, total }
2. GET  /api/batch/status?jobId=xxx  (每5s轮询)
   → { status: "processing", success: 3, ... }
   → { status: "completed", success: 15, ... }
3. GET  /api/batch/export?jobId=xxx  → Excel 文件下载
```
