import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcribe",
  description:
    "Convert audio to timestamped subtitles in your browser. Runs entirely client-side via Whisper — your audio never leaves your device. Export as SRT, VTT, LRC, plain text, or JSON.",
  keywords: [
    "audio transcription",
    "whisper browser",
    "subtitle generator",
    "speech to text web",
    "client-side transcription",
    "srt vtt lrc export",
    "private transcription",
  ],
  openGraph: {
    title: "Transcribe | Wenqian Zhang",
    description:
      "Audio → timestamped subtitles, runs entirely in your browser. Whisper in WebGPU. Export SRT / VTT / LRC / TXT / JSON.",
    images: [
      {
        url: "/api/og?title=Transcribe&subtitle=Audio%20%E2%86%92%20subtitles%2C%20runs%20entirely%20in%20your%20browser&tag=tool",
        width: 1200,
        height: 630,
        alt: "Transcribe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transcribe | Wenqian Zhang",
    description:
      "Audio → timestamped subtitles, runs entirely in your browser. Whisper in WebGPU.",
    images: [
      "/api/og?title=Transcribe&subtitle=Audio%20%E2%86%92%20subtitles%2C%20runs%20entirely%20in%20your%20browser&tag=tool",
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Transcribe",
  description:
    "Client-side audio transcription tool. Uploads audio (MP3/WAV/M4A/OGG/video), runs Whisper in the browser via WebGPU/WebAssembly, and produces timestamped subtitles. Export to SRT, VTT, LRC, plain text, or JSON. Audio never leaves the device.",
  url: "https://wenqian.dev/transcribe",
  applicationCategory: "MultimediaApplication",
  genre: "Tool",
  operatingSystem: "Any",
  browserRequirements:
    "Requires a modern web browser; WebGPU recommended for fastest performance",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: {
    "@type": "Person",
    name: "Wenqian Zhang",
    url: "https://wenqian.dev",
  },
};

export default function TranscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
