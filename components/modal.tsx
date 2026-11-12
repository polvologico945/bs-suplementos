"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Problema: drawers permitiam foco fora do pedido e não fechavam por teclado.
 * Foco fica no diálogo e volta ao botão de origem. Data: 2026-11-12. @author Carla Evelyn */
export function Modal({
  children,
  label,
  className,
  onClose,
}: {
  children: ReactNode;
  label: string;
  className: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Problema: aria-modal sozinho não impede leitura/cliques atrás da galeria.
    // Isola os irmãos de cada ancestral e restaura seus estados ao fechar.
    // Data: 2026-11-12. @author Carla Evelyn
    const isolated: { element: HTMLElement; inert: boolean }[] = [];
    let ancestor: HTMLElement | null = ref.current;
    while (ancestor && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement?.children || []) {
        if (sibling !== ancestor && sibling instanceof HTMLElement) {
          isolated.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      ancestor = ancestor.parentElement;
    }
    const getFocusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) || [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && !element.closest("[inert]"),
      );
    (getFocusable()[0] || ref.current)?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = getFocusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function keepFocus(event: FocusEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        (getFocusable()[0] || ref.current)?.focus();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", keepFocus);
      isolated.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className={className}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
