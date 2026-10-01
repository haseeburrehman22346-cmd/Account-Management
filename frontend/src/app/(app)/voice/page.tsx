import { PageHeader } from "@/components/shared/page-header";
import { VoiceEntry } from "@/components/voice/voice-entry";

export default function VoicePage() {
  return (
    <>
      <PageHeader title="Voice Entry" description="Say an expense and it's saved to the matching category" />
      <VoiceEntry />
    </>
  );
}
