"use client";

import { useTransition } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createUserFileSignedUrl } from "../actions";

export function SignedDownloadButton({ path }: { path: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      try {
        const url = await createUserFileSignedUrl(path);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "URL 生成に失敗しました");
      }
    });
  };

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      size="sm"
      variant="outline"
    >
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <ExternalLinkIcon data-icon="inline-start" />
      )}
      {pending ? "URL 生成中..." : "署名付き URL"}
    </Button>
  );
}
