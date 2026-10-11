/**
 * @types/react-dom kurulu değil (package.json'da yok); `react-dom/client` içe aktarımı bu yüzden örtük `any` oluyordu.
 * Yalnız kullanılan yüzey bildirilir. @types/react-dom ileride eklenirse bu dosya silinebilir (ikisi uyumlu birleşir).
 */
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface RootOptions {
    identifierPrefix?: string;
    onRecoverableError?: (error: unknown) => void;
  }
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;
  export function hydrateRoot(container: Element | Document, initialChildren: ReactNode, options?: RootOptions): Root;
}
