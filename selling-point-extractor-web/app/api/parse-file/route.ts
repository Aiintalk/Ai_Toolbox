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
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(buffer);
      text = result.text;
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
            return chineseCount >= 5;
          })
          .join("\n");
      }
    } else if (filename.endsWith(".doc")) {
      text = "[.doc 格式暂不支持，请转换为 .docx 或 .pdf 后上传]";
    } else {
      // Try reading as text
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
