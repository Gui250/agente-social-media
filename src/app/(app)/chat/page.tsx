import { Suspense } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPanel />
    </Suspense>
  );
}
