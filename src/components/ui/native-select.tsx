import { cn } from "cn";

// Native <select> styled like <Input>: accessible and simpler than the Base UI Select.
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}
