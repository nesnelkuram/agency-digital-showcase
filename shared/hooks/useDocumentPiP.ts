import { useState, useCallback, useRef, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { ReactNode } from 'react';

// Chrome 116+ Document Picture-in-Picture API types
declare global {
  interface DocumentPictureInPictureOptions {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }

  interface DocumentPictureInPicture {
    requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
    window: Window | null;
  }

  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

interface UseDocumentPiPReturn {
  /** Whether the Document PiP API is available in this browser */
  isPiPSupported: boolean;
  /** Whether the PiP window is currently open */
  isPiPOpen: boolean;
  /** Open a PiP window and render React content into it */
  openPiP: (content: ReactNode) => Promise<boolean>;
  /** Close the PiP window */
  closePiP: () => void;
  /** Update the content rendered in the PiP window */
  updatePiPContent: (content: ReactNode) => void;
}

export function useDocumentPiP(onPiPClose?: () => void): UseDocumentPiPReturn {
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const reactRootRef = useRef<Root | null>(null);
  const onPiPCloseRef = useRef(onPiPClose);

  // Keep callback ref up to date
  onPiPCloseRef.current = onPiPClose;

  const isPiPSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const closePiP = useCallback(() => {
    if (reactRootRef.current) {
      reactRootRef.current.unmount();
      reactRootRef.current = null;
    }
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    setIsPiPOpen(false);
  }, []);

  const openPiP = useCallback(async (content: ReactNode): Promise<boolean> => {
    if (!isPiPSupported || !window.documentPictureInPicture) {
      return false;
    }

    // Close existing PiP window if any
    closePiP();

    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 360,
        height: 80,
      });

      pipWindowRef.current = pipWindow;

      // Copy stylesheets from the main document to PiP window
      const allStyles = [...document.styleSheets];
      for (const sheet of allStyles) {
        try {
          if (sheet.href) {
            // External stylesheet — create a <link>
            const link = pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            // Inline stylesheet — copy rules
            const style = pipWindow.document.createElement('style');
            const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
            style.textContent = rules;
            pipWindow.document.head.appendChild(style);
          }
        } catch {
          // CORS may block access to some stylesheet rules — skip
        }
      }

      // Set up body styling
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.padding = '0';
      pipWindow.document.body.style.overflow = 'hidden';
      pipWindow.document.body.style.background = '#171717';

      // Create React root and render content
      const container = pipWindow.document.createElement('div');
      container.id = 'pip-root';
      pipWindow.document.body.appendChild(container);

      const root = createRoot(container);
      reactRootRef.current = root;
      root.render(content);

      setIsPiPOpen(true);

      // Listen for PiP window close
      pipWindow.addEventListener('pagehide', () => {
        reactRootRef.current?.unmount();
        reactRootRef.current = null;
        pipWindowRef.current = null;
        setIsPiPOpen(false);
        onPiPCloseRef.current?.();
      });

      return true;
    } catch (err) {
      console.warn('[useDocumentPiP] Failed to open PiP window:', err);
      return false;
    }
  }, [isPiPSupported, closePiP]);

  const updatePiPContent = useCallback((content: ReactNode) => {
    if (reactRootRef.current) {
      reactRootRef.current.render(content);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reactRootRef.current) {
        reactRootRef.current.unmount();
        reactRootRef.current = null;
      }
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
      }
    };
  }, []);

  return {
    isPiPSupported,
    isPiPOpen,
    openPiP,
    closePiP,
    updatePiPContent,
  };
}
