export const benchmarkSummary = {
  speedupRange: "10.6–13.0×",
  metrics: [
    {
      label: "Text (20 pages)",
      ours: "16.91 ms",
      napi: "220.45 ms",
      nodeCanvas: "328.14 ms",
    },
    {
      label: "Text + image (10 pages)",
      ours: "25.94 ms",
      napi: "276.26 ms",
      nodeCanvas: "n/a",
    },
  ],
};
