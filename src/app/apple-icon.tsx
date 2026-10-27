import { ImageResponse } from "next/og";
import { MARK_PATHS } from "@/components/brand/BrandMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#05070a" }}>
        <svg width="180" height="180" viewBox="0 0 64 64" fill="none">
          <path d={MARK_PATHS.house} stroke="#f1ece2" strokeWidth="3.5" strokeLinejoin="round" />
          <path d={MARK_PATHS.pulse} stroke="#ffd166" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
