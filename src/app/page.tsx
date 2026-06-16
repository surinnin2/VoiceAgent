"use client";

import { useState } from "react";
import { Recorder } from "@/components/Recorder";
import { RecordingList } from "@/components/RecordingList";
import { EnrollmentPanel } from "@/components/EnrollmentPanel";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main>
      <h1>VoiceAgent</h1>
      <p className="subtle" style={{ marginBottom: 20 }}>
        Record voice, transcribe it with accuracy-optimized engines, and retry across engines
        when you&apos;re not satisfied.
      </p>
      <Recorder onUploaded={() => setRefreshKey((k) => k + 1)} />
      <EnrollmentPanel />
      <RecordingList refreshKey={refreshKey} />
    </main>
  );
}
