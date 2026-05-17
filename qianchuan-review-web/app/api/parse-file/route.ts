import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let text = "";

    if (filename.endsWith(".txt") || filename.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else if (filename.endsWith(".docx")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (filename.endsWith(".pdf")) {
      text = "[暂不支持 PDF 格式，请转为 .docx 或 .txt 后上传]";
    } else if (filename.endsWith(".pages")) {
      const JSZip = require("jszip");
      const snappyjs = require("snappyjs");
      const zip = await JSZip.loadAsync(buffer);
      const iwaFile = zip.file("Index/Document.iwa");
      if (!iwaFile) {
        text = "[.pages 文件格式异常，未找到文档内容]";
      } else {
        const iwaData = await iwaFile.async("nodebuffer");
        let decompressed: Buffer;
        try {
          decompressed = Buffer.from(snappyjs.uncompress(iwaData.slice(4)));
        } catch {
          decompressed = iwaData;
        }
        const raw = decompressed.toString("utf-8", 0, decompressed.length);
        const segments = raw.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、；：""''（）【】《》a-zA-Z0-9\s%.+\-·\/\u2026]{10,}/g) || [];
        text = segments
          .map(s => s.trim())
          .filter(s => {
            const chineseCount = (s.match(/[\u4e00-\u9fff]/g) || []).length;
            if (chineseCount < 5) return false;
            if (/星期[一二三四五六日][BJR]/.test(s)) return false;
            if (/^[一二三四五六七八九十]+月/.test(s) && s.length < 20) return false;
            if (/第[一二三四]季度/.test(s) && s.length < 20) return false;
            if (/^公元/.test(s) && s.length < 10) return false;
            return true;
          })
          .join("\n");
      }
    } else {
      text = buffer.toString("utf-8");
    }

    return NextResponse.json({ text, filename: file.name });
  } catch (err) {
    console.error("parse-file error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}
