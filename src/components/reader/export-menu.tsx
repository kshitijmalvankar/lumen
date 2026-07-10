"use client";

import { Download, FileDown, Copy, Printer, Lock, Quote } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildExportMarkdown,
  exportFilename,
  type ExportableArticle,
} from "@/lib/export/markdown";
import { buildBibTeX } from "@/lib/export/citations";
import type { Tier } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

/**
 * Export the article as Markdown (copy / download — all tiers) or a clean PDF
 * via the browser's print dialog (Pro/Max; free users are routed to upgrade).
 */
export function ExportMenu({
  article,
  tier,
}: {
  article: ExportableArticle;
  tier: Tier;
}) {
  const router = useRouter();
  const canPdf = tier === "pro" || tier === "max";

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(buildExportMarkdown(article));
      toast.success("Article copied as Markdown");
    } catch {
      toast.error("Couldn't copy — try downloading instead.");
    }
  }

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    download(
      buildExportMarkdown(article),
      exportFilename(article.title),
      "text/markdown;charset=utf-8",
    );
  }

  async function copyCitations() {
    if (article.sources.length === 0) {
      toast.info("No sources to cite for this article.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildBibTeX(article.sources));
      toast.success("Citations copied as BibTeX");
    } catch {
      toast.error("Couldn't copy — try downloading the .bib instead.");
    }
  }

  function downloadBibTeX() {
    if (article.sources.length === 0) {
      toast.info("No sources to cite for this article.");
      return;
    }
    const name = exportFilename(article.title).replace(/\.md$/, ".bib");
    download(buildBibTeX(article.sources), name, "application/x-bibtex;charset=utf-8");
  }

  function savePdf() {
    if (!canPdf) {
      toast.info("PDF export is a Pro feature — taking you to plans.");
      router.push("/app/upgrade");
      return;
    }
    window.print();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Export article"
        className={cn(buttonVariants({ variant: "outline", size: "default" }))}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyMarkdown}>
          <Copy className="h-4 w-4" />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadMarkdown}>
          <FileDown className="h-4 w-4" />
          Download .md
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyCitations}>
          <Quote className="h-4 w-4" />
          Copy citations (BibTeX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadBibTeX}>
          <FileDown className="h-4 w-4" />
          Download .bib
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={savePdf}>
          {canPdf ? (
            <Printer className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          Save as PDF
          {!canPdf && (
            <span className="ml-auto text-[0.65rem] font-semibold text-brand">
              Pro
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
