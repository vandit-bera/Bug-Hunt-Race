import QRCode from "qrcode";

export interface QrMatrix {
  size: number;
  isDark: (x: number, y: number) => boolean;
}

/** Encodes `text` as a QR code in the browser; no network calls. */
export function createQrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return {
    size: modules.size,
    isDark: (x, y) => modules.get(x, y) === 1,
  };
}
