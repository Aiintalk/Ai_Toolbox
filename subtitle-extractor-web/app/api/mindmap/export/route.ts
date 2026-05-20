import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

interface MindmapBranch {
  title: string;
  children: string[];
}

interface MindmapData {
  rootTitle: string;
  summary?: string;
  branches: MindmapBranch[];
}

function uid() {
  return Math.random().toString(36).slice(2, 12);
}

function buildContentXml(data: MindmapData): string {
  const ts = Date.now().toString();

  const branchesXml = data.branches
    .map((branch) => {
      const childrenXml = branch.children
        .map(
          (child) =>
            `<topic id="${uid()}" timestamp="${ts}"><title>${escapeXml(child)}</title></topic>`
        )
        .join("\n");

      return `<topic id="${uid()}" timestamp="${ts}">
          <title>${escapeXml(branch.title)}</title>
          ${
            childrenXml
              ? `<children><topics type="attached">${childrenXml}</topics></children>`
              : ""
          }
        </topic>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xmap-content version="2.0"
  xmlns="urn:xmind:xmap:xmlns:content:2.0"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <sheet id="${uid()}" timestamp="${ts}">
    <topic id="${uid()}" timestamp="${ts}">
      <title>${escapeXml(data.rootTitle)}</title>
      ${
        branchesXml
          ? `<children><topics type="attached">${branchesXml}</topics></children>`
          : ""
      }
    </topic>
    <title>Sheet 1</title>
  </sheet>
</xmap-content>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<manifest xmlns="urn:xmind:xmap:xmlns:manifest:1.0">
  <file-entry full-path="content.xml" media-type="text/xml"/>
  <file-entry full-path="META-INF/" media-type=""/>
  <file-entry full-path="META-INF/manifest.xml" media-type="text/xml"/>
</manifest>`;

const META_XML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<meta xmlns="urn:xmind:xmap:xmlns:meta:2.0" Author="subtitle-extractor"/>`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mindmap = body as MindmapData;

    if (!mindmap?.rootTitle || !Array.isArray(mindmap?.branches)) {
      return NextResponse.json({ error: "无效的思维导图数据" }, { status: 400 });
    }

    const zip = new JSZip();
    zip.file("content.xml", buildContentXml(mindmap));
    zip.file("meta.xml", META_XML);
    zip.folder("META-INF")!.file("manifest.xml", MANIFEST_XML);

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const filename = encodeURIComponent(`mindmap_${Date.now()}.xmind`);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    console.error("xmind export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "导出失败" },
      { status: 500 }
    );
  }
}
