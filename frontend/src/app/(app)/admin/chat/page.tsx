import { PageHeader } from "@/components/shared/page-header";
import { VoiceChat } from "@/components/voice/voice-chat";

export default function AdminChatPage() {
  return (
    <>
      <PageHeader title="AI Chat" description="Type or speak to the assistant about your categories and expenses" />
      <VoiceChat />
    </>
  );
}
