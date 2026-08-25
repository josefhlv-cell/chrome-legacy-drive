/**
 * Web Worker pro kompresi GLB.
 *
 * Bez workeru běžela meshopt komprese v hlavním vlákně a admin UI na
 * 20–60 sekund zamrzlo (nešlo klikat, animace stály). Tady běží mimo,
 * takže admin vidí plynulý progress bar a může mezitím pracovat.
 */
import { compressGLBBuffer, type CompressProgress } from "./compressPipeline";

type Incoming = { buffer: ArrayBuffer };
type Outgoing =
  | { type: "progress"; progress: CompressProgress }
  | { type: "done"; buffer: ArrayBuffer | null }
  | { type: "error"; message: string };

const post = (message: Outgoing, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(message, transfer ?? []);

self.onmessage = async (event: MessageEvent<Incoming>) => {
  try {
    const result = await compressGLBBuffer(event.data.buffer, (progress) =>
      post({ type: "progress", progress }),
    );
    post({ type: "done", buffer: result }, result ? [result] : []);
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : "Neznámá chyba" });
  }
};
