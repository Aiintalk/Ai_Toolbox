import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getPersonasDir() {
  return path.join(process.cwd(), "data", "personas");
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_").slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { persona, title, likes, source, type, content } = await request.json();

    if (!persona || !title || !content) {
      return NextResponse.json({ error: "persona, title, content 为必填" }, { status: 400 });
    }

    const refsDir = path.join(getPersonasDir(), persona, "references");
    if (!fs.existsSync(refsDir)) {
      fs.mkdirSync(refsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFilename(title);
    const filename = `${timestamp}-${safeName}.md`;
    const filePath = path.join(refsDir, filename);

    const frontmatter = [
      "---",
      `title: ${title}`,
      likes ? `likes: ${likes}` : null,
      source ? `source: ${source}` : null,
      type ? `type: ${type}` : null,
      `date: ${timestamp}`,
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    fs.writeFileSync(filePath, `${frontmatter}\n\n${content}`, "utf-8");

    return NextResponse.json({ success: true, filename });
  } catch (err) {
    console.error("references POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { persona, filename } = await request.json();

    if (!persona || !filename) {
      return NextResponse.json({ error: "persona, filename 为必填" }, { status: 400 });
    }

    // Prevent path traversal
    if (filename.includes("/") || filename.includes("..")) {
      return NextResponse.json({ error: "非法文件名" }, { status: 400 });
    }

    const filePath = path.join(getPersonasDir(), persona, "references", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("references DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
