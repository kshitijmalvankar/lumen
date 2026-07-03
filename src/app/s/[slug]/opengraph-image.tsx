import { ImageResponse } from "next/og";
import { getSharedArticle } from "@/lib/share/queries";

export const alt = "A cited article on Lumen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Truncate to something that reads well at OG-image scale.
function clampTitle(title: string): string {
  return title.length > 110 ? `${title.slice(0, 107)}…` : title;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getSharedArticle(slug);
  const title = clampTitle(article?.title ?? "Research, distilled");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0e0b1a 0%, #1a1430 55%, #241a45 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}
          >
            ✦
          </div>
          <div style={{ color: "#ffffff", fontSize: "30px", fontWeight: 700 }}>
            Lumen
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: "60px",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>

        {/* Footer tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#c4b5fd",
            fontSize: "26px",
          }}
        >
          <span>A cited, source-backed article</span>
          <span style={{ color: "#6d5bd0" }}>·</span>
          <span>Made with Lumen</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
