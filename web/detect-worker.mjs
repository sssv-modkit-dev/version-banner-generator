import { detectCells } from "./detect.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: detectCells(
        new Uint8ClampedArray(data.pixels),
        data.width,
        data.height,
      ),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
