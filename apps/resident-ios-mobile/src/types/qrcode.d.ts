/** The pure-JavaScript encoder inside `qrcode` (no canvas, no file system); the package ships no types. */
declare module 'qrcode/lib/core/qrcode' {
  export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
  export function create(data: string, options?: { errorCorrectionLevel?: ErrorCorrectionLevel }): { modules: { size: number; get(row: number, column: number): number } };
}
