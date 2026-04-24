import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ChatLauncher() {
  return (
    <Button
      asChild
      size="icon"
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-portal"
      aria-label="Открыть чат ассистента"
    >
      <Link href="/chat">
        <MessageCircle className="h-6 w-6" />
      </Link>
    </Button>
  );
}
