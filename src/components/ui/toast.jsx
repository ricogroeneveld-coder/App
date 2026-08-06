import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="pointer-events-none fixed bottom-0 z-[100] flex max-h-screen w-full flex-col p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:right-0 sm:flex-col md:max-w-[420px]"
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="pointer-events-none fixed bottom-0 z-[100] flex max-h-screen w-full flex-col p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:right-0 sm:flex-col md:max-w-[420px]"
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "toast-in group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-3 pr-11 transition-all",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900/95 backdrop-blur-md ring-1 ring-[#6d28d9]/60 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6),0_0_12px_-6px_rgba(109,40,217,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
        destructive:
          "destructive group bg-gradient-to-b from-rose-500 to-rose-800 ring-1 ring-rose-300/40 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6),0_0_16px_-6px_rgba(244,63,94,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {children}
    </div>
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-1 top-1/2 -translate-y-1/2 rounded-xl p-2.5 text-white/60 transition-colors hover:text-white hover:bg-white/10 focus:outline-none active:scale-95",
      className
    )}
    toast-close=""
    aria-label="Dismiss"
    {...props}
  >
    <X className="h-5 w-5" strokeWidth={2.5} />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-bold leading-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs font-medium opacity-80 leading-snug", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};