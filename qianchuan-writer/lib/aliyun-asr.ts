import crypto from "crypto";

const ASR_URL = "https://filetrans.cn-shanghai.aliyuncs.com";

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, "%2B")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function sign(secret: string, stringToSign: string): string {
  return crypto
    .createHmac("sha1", secret + "&")
    .update(stringToSign)
    .digest("base64");
}

function buildParams(action: string, extra?: Record<string, string>): Record<string, string> {
  const params: Record<string, string> = {
    Format: "JSON",
    Version: "2018-08-17",
    AccessKeyId: (process.env.ALIYUN_ACCESS_KEY_ID || "").trim(),
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
  };
  if (extra) Object.assign(params, extra);
  return params;
}

function addSignature(params: Record<string, string>, method: string): Record<string, string> {
  const sortedKeys = Object.keys(params).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const stringToSign = `${method}&${percentEncode("/")}&${percentEncode(canonicalQuery)}`;
  params["Signature"] = sign((process.env.ALIYUN_ACCESS_KEY_SECRET || "").trim(), stringToSign);
  return params;
}

// Submit transcription task, return taskId
export async function submitTranscription(videoUrl: string): Promise<string> {
  const task = JSON.stringify({
    appkey: (process.env.ALIYUN_APPKEY || "").trim(),
    file_link: videoUrl,
    version: "4.0",
    enable_words: false,
    enable_sample_rate_adaptive: true,
  });

  const params = addSignature(buildParams("SubmitTask", { Task: task }), "POST");
  const formBody = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(ASR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody,
  });

  const json = await res.json();
  if (json.StatusCode !== 21050000) {
    throw new Error(`ASR submit failed: ${JSON.stringify(json)}`);
  }
  return json.TaskId;
}

// Poll transcription result. Returns { status: 'processing' } or { status: 'done', text: '...' } or throws
export async function pollTranscription(taskId: string): Promise<{ status: 'processing' | 'done'; text?: string }> {
  const params = addSignature(buildParams("GetTaskResult", { TaskId: taskId }), "GET");
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(`${ASR_URL}?${qs}`, { method: "GET" });
  const json = await res.json();
  const status = json.StatusCode;

  if (status === 21050000) {
    let result = json.Result;
    if (typeof result === "string") result = JSON.parse(result);
    const sentences = result?.Sentences ?? [];
    return { status: 'done', text: sentences.map((s: { Text: string }) => s.Text).join(" ") };
  }

  if (status === 21050001 || status === 21050002 || status === 21050003) {
    return { status: 'processing' };
  }

  throw new Error(`ASR error: ${JSON.stringify(json)}`);
}
