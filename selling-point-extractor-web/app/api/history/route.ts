import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = "/opt/selling-point-extractor/data/history";

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// GET: 返回所有历史记录，或带 ?id=xxx 返回单条完整记录
export async function GET(request: NextRequest) {
  try {
    ensureDir();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // 单条完整记录
    if (id) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const record = JSON.parse(raw);
      return NextResponse.json({ record });
    }

    // 列表（摘要）
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const list = files
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
          const record = JSON.parse(raw);
          const summary = record.result
            ? record.result.slice(0, 100).replace(/\n/g, " ") + "..."
            : "";
          return {
            id: record.id,
            productName: record.productName || "未命名产品",
            createdAt: record.createdAt,
            summary,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ records: list });
  } catch (err) {
    console.error("history GET error:", err);
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }
}

// POST: 保存一条新记录
export async function POST(request: NextRequest) {
  try {
    ensureDir();
    const body = await request.json();
    const { id, productName, result, chatHistory, briefFiles, scriptFiles, createdAt } = body;

    if (!id || !result) {
      return NextResponse.json(
        { error: "id and result are required" },
        { status: 400 }
      );
    }

    const record = {
      id,
      productName: productName || "未命名产品",
      result,
      chatHistory: chatHistory || [],
      briefFiles: briefFiles || [],
      scriptFiles: scriptFiles || [],
      createdAt: createdAt || new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(DATA_DIR, `${id}.json`),
      JSON.stringify(record, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("history POST error:", err);
    return NextResponse.json(
      { error: "Failed to save history" },
      { status: 500 }
    );
  }
}

// DELETE: 删除指定 id 的记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("history DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete history" },
      { status: 500 }
    );
  }
}
