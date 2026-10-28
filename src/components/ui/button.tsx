import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary: "bg-gold text-[#17140e] hover:bg-gold-strong shadow-[0_0_0_1px_rgb(214_189_141/0.4)]",
        secondary: "bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong",
        ghost: "text-text-2 hover:text-text hover:bg-surface-2",
        outline: "border border-border text-text hover:border-gold-dim hover:bg-surface-2",
        danger: "bg-danger/15 text-[#e7a3a3] border border-danger/40 hover:bg-danger/25",
        link: "text-gold underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
