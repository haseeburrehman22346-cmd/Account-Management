import { PageHeader } from "@/components/shared/page-header";
import { VoiceEntry } from "@/components/voice/voice-entry";

export default function AdminVoicePage() {
  return (
    <>
      <PageHeader title="Voice Entry" description="Say an expense to save it, or create a new category by voice" />
      <VoiceEntry />
    </>
  );
}
