import { cn } from "@/lib/utils";

type StrapiRichTextProps = {
  html: string;
  className?: string;
};

export function StrapiRichText({ html, className }: StrapiRichTextProps) {
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:marker:text-primary [&_p]:text-muted-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
