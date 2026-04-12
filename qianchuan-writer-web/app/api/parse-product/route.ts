import { NextRequest, NextResponse } from "next/server";
import { chatStream } from "@/lib/yunwu";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { extractText } from "unpdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    // Extract text from all files
    const allTexts: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = "";

      if (file.name.endsWith(".pdf")) {
        try {
          const { text: pdfText } = await extractText(new Uint8Array(buffer));
          // unpdf returns an array of page texts, join them
          if (Array.isArray(pdfText)) {
            text = pdfText.join("\n");
          } else {
            text = pdfText || "";
          }
        } catch (pdfErr) {
          console.error("pdf extract error:", pdfErr);
          text = "";
        }
      } else if (file.name.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheets.push(`[${sheetName}]\n${csv}`);
        }
        text = sheets.join("\n\n");
      } else if (file.name.endsWith(".pptx")) {
        text = await extractPptxText(buffer);
      } else {
        text = buffer.toString("utf-8");
      }

      if (text.trim()) {
        allTexts.push(`=== 文件: ${file.name} ===\n${text}`);
      }
    }

    const textContent = allTexts.join("\n\n");
    console.log("[parse-product] extracted text length:", textContent.length, "preview:", textContent.slice(0, 200));

    if (!textContent.trim() || textContent.trim().length < 10) {
      return NextResponse.json(
        { error: "无法从文件中提取有效文字内容，请尝试复制文档内容手动粘贴" },
        { status: 400 }
      );
    }

    // Limit text length to avoid token overflow
    const truncated = textContent.slice(0, 8000);

    // Use AI to extract structured product info
    const systemPrompt = `你是一个产品信息提取专家。从以下文档内容中提取产品信息，严格按JSON格式返回，不要返回其他内容。

返回格式（如果某个字段文档中没有提到，留空字符串）：
{
  "name": "产品名称",
  "category": "产品品类",
  "price": "价格或价格区间",
  "sellingPoints": "核心卖点，用换行分隔多个卖点",
  "targetAudience": "目标人群",
  "scenario": "使用场景",
  "medicalAestheticAnchor": "医美锚定建议，一句话，格式：项目名(价格区间)，效果关联说明"
}

注意：
- 核心卖点要提炼关键信息，不要照搬原文大段内容
- 每个卖点一行，简洁有力
- medicalAestheticAnchor 必须是一句话，不要换行，不要用引号，例如："薇旖美Colnet注射(单次约12.8万)，同为重组胶原蛋白促生"
- 所有字段值中不要包含双引号，用单引号或顿号代替
- 只返回JSON，不要加任何解释

## 医美锚定规则
识别产品的核心功效（如胶原促生、紧致提拉、淡纹抗皱、美白等），检索医美院线中指向同一效果的项目（单次1万-2万+的项目）。如果能匹配上，填写锚定建议。如果匹配不上，留空字符串。`;

    const messages = [{ role: "user", content: truncated }];

    // Collect full response (non-streaming)
    const stream = chatStream(messages, systemPrompt);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    // Parse JSON from response
    console.log("[parse-product] AI result length:", result.length, "preview:", result.slice(0, 300));
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI 未能提取到结构化产品信息，请手动填写" },
        { status: 422 }
      );
    }

    let productInfo;
    try {
      productInfo = JSON.parse(jsonMatch[0]);
    } catch {
      // AI output may have unescaped characters; try to clean up
      const cleaned = jsonMatch[0]
        .replace(/[\r\n]+/g, " ")
        .replace(/,\s*}/g, "}");
      productInfo = JSON.parse(cleaned);
    }
    return NextResponse.json({ ...productInfo, _rawText: truncated });
  } catch (err) {
    console.error("parse-product error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "解析失败" },
      { status: 500 }
    );
  }
}

// Extract text from PPTX (which is a zip of XML files)
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  // PPTX slides are in ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async("string");
    // Extract text from <a:t> tags
    const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideTexts = textMatches.map(m => m.replace(/<\/?a:t>/g, "")).filter(Boolean);
      texts.push(slideTexts.join(" "));
    }
  }

  return texts.join("\n");
}
