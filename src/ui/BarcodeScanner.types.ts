export interface BarcodeScannerProps {
  onCode: (code: string) => void;
  /** Receiving counts carton after carton, so the camera keeps reading instead of pausing after one code. */
  continuous?: boolean;
  height?: number;
}
