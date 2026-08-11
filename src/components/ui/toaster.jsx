import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // ToastProvider is the single fixed live-region viewport (it wraps the
  // toasts). We no longer also render a separate <ToastViewport>, which
  // previously stacked a second empty fixed container over this one.
  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Errors interrupt — announce them assertively. This nested
        // live region overrides the wrapper's polite setting for its
        // own subtree.
        const isDestructive = props.variant === "destructive";
        return (
          <Toast
            key={id}
            role={isDestructive ? "alert" : "status"}
            aria-live={isDestructive ? "assertive" : "polite"}
            aria-atomic="true"
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
    </ToastProvider>
  );
}