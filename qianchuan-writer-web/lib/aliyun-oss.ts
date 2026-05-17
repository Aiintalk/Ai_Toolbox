import crypto from "crypto";

const ALIYUN_ACCESS_KEY_ID = (process.env.ALIYUN_ACCESS_KEY_ID || "").trim();
const ALIYUN_ACCESS_KEY_SECRET = (process.env.ALIYUN_ACCESS_KEY_SECRET || "").trim();
const BUCKET = "hersystem-media-tmp";
const ENDPOINT = "oss-cn-shanghai.aliyuncs.com";

function hmacSha1(key: string, data: string): string {
  return crypto.createHmac("sha1", key).update(data).digest("base64");
}

export async function uploadToOSS(
  buffer: Buffer,
  objectKey: string,
  contentType: string = "application/octet-stream"
): Promise<void> {
  const date = new Date().toUTCString();
  const stringToSign = `PUT\n\n${contentType}\n${date}\n/${BUCKET}/${objectKey}`;
  const signature = hmacSha1(ALIYUN_ACCESS_KEY_SECRET, stringToSign);

  const url = `https://${BUCKET}.${ENDPOINT}/${objectKey}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Date: date,
      Authorization: `OSS ${ALIYUN_ACCESS_KEY_ID}:${signature}`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OSS upload failed: ${response.status} ${text}`);
  }
}

export function getSignedUrl(objectKey: string, expireSeconds: number): string {
  const expires = Math.floor(Date.now() / 1000) + expireSeconds;
  const stringToSign = `GET\n\n\n${expires}\n/${BUCKET}/${objectKey}`;
  const signature = hmacSha1(ALIYUN_ACCESS_KEY_SECRET, stringToSign);

  const encodedSignature = encodeURIComponent(signature);
  return `https://${BUCKET}.${ENDPOINT}/${objectKey}?OSSAccessKeyId=${encodeURIComponent(ALIYUN_ACCESS_KEY_ID)}&Expires=${expires}&Signature=${encodedSignature}`;
}
