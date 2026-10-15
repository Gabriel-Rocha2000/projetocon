declare module "pdf-parse" {
  type PDFData = { text: string; numpages?: number; info?: Record<string, unknown> };
  export default function pdf(buffer: Buffer | Uint8Array): Promise<PDFData>;
}
