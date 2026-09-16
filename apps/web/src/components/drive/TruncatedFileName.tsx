import { imageFileLabel } from "@/lib/image-name";
import { cn } from "@/lib/utils";

type TruncatedFileNameProps = {
  name: string;
  mimeType?: string;
  className?: string;
  as?: "span" | "p";
};

export function TruncatedFileName({
  name,
  mimeType,
  className,
  as: Component = "span",
}: TruncatedFileNameProps) {
  const label = imageFileLabel(name, mimeType);

  return (
    <Component
      className={cn(
        "min-w-0 max-w-full truncate",
        Component === "span" ? "inline-block" : "block w-full",
        className,
      )}
      title={label}
    >
      {label}
    </Component>
  );
}
