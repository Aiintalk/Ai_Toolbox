import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { readJob, findJobByCode } from "@/lib/batch-store";

const STATUS_LABEL: Record<string, string> = {
  success: "成功",
  failed: "失败",
  processing: "处理中",
  pending: "等待中",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const code = searchParams.get("code");

    if (!jobId && !code) {
      return NextResponse.json(
        { error: "jobId 或 code 必须提供其中一个" },
        { status: 400 }
      );
    }

    const job = code ? findJobByCode(code) : readJob(jobId!);
    if (!job) {
      return NextResponse.json({ error: "任务不存在，请确认访问码是否正确" }, { status: 404 });
    }

    // Build Excel rows: 5 fixed columns
    const header = ["视频标题", "抖音链接", "转换的内容", "转化的状态", "失败的原因"];
    const dataRows = job.items.map((item) => [
      item.title,
      item.originalUrl,
      item.transcript,
      STATUS_LABEL[item.status] ?? item.status,
      item.error,
    ]);

    const worksheetData = [header, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 40 }, // 视频标题
      { wch: 50 }, // 抖音链接
      { wch: 80 }, // 转换的内容
      { wch: 12 }, // 转化的状态
      { wch: 40 }, // 失败的原因
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "字幕结果");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="subtitles_${job.accessCode ?? job.jobId}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("batch export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
