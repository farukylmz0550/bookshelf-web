// SPDX-License-Identifier: GPL-3.0-only
"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera } from "lucide-react";
import { selectCloseFocusCamera } from "@/lib/camera-selection";

interface BarcodeScannerProps {
  onDetected: (isbn: string) => void;
  title?: string;
}

export function BarcodeScanner({ onDetected, title = "Scan" }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<InstanceType<typeof import("html5-qrcode").Html5QrcodeScanner> | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let cancelled = false;
    let cameraListObserver: MutationObserver | null = null;
    let preferredCameraStarted = false;

    import("html5-qrcode")
      .then(({ Html5QrcodeScanner }) => {
        if (cancelled || !containerRef.current) return;

        const scanner = new Html5QrcodeScanner(
          "barcode-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.5,
            // A remembered selfie camera would otherwise start before the
            // close-focus camera selector below gets a chance to run.
            rememberLastUsedCamera: false,
          },
          false,
        );

        // html5-qrcode renders the camera list after permission is granted.
        // Select the macro/close-focus lens as soon as that list is available,
        // while leaving the selector enabled so the user can still switch.
        cameraListObserver = new MutationObserver(() => {
          const select = containerRef.current?.querySelector<HTMLSelectElement>("#html5-qrcode-select-camera");
          if (!select || select.options.length === 0) return;

          const preferred = selectCloseFocusCamera(
            Array.from(select.options, (option) => ({ id: option.value, label: option.text })),
          );
          if (!preferred) return;

          select.value = preferred.id;

          // Changing the select value does not switch an already running
          // stream. Start only after the preferred rear lens is selected.
          const startButton = containerRef.current?.querySelector<HTMLButtonElement>(
            "#html5-qrcode-button-camera-start",
          );
          if (!startButton || startButton.disabled || preferredCameraStarted) return;

          preferredCameraStarted = true;
          cameraListObserver?.disconnect();
          startButton.click();
        });
        cameraListObserver.observe(containerRef.current, { childList: true, subtree: true });

        scanner.render(
          (decodedText: string) => {
            const cleaned = decodedText.replace(/[^0-9Xx]/g, "");
            if (cleaned.length === 10 || cleaned.length === 13) {
              onDetected(cleaned);
              setIsOpen(false);
            } else {
              setError(`Invalid barcode: ${decodedText}`);
            }
          },
          () => {},
        );

        scannerRef.current = scanner;
      })
      .catch(() => {
        if (!cancelled) setError("Barcode scanner failed to load");
      });

    return () => {
      cancelled = true;
      cameraListObserver?.disconnect();
      if (scannerRef.current) {
        try {
          (scannerRef.current as { clear: () => void }).clear();
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [isOpen, onDetected]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError(null);
        }}
        className="flex-shrink-0 rounded-[8px] border border-border bg-secondary px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:hidden"
        title={title}
        aria-label={title}
      >
        <Camera size={16} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-card p-4">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute end-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              <X size={18} />
            </button>
            <h3 className="mb-3 text-sm font-medium">{title}</h3>
            {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
            <div ref={containerRef} id="barcode-reader" className="overflow-hidden rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}
