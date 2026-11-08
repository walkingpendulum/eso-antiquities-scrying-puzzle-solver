export async function imagePixels(source, maxSide = 2000) {
  const image = new Image();
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("The image has no readable dimensions.");
    const scale = Math.min(
      1,
      maxSide / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    throw Error(
      `Could not read this image. Try JPEG, PNG or WebP. ${error.message}`,
    );
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
export function photoDataURL(photo) {
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(
        new Uint8ClampedArray(photo.pixels),
        photo.width,
        photo.height,
      ),
      0,
      0,
    );
  return canvas.toDataURL("image/jpeg", 0.88);
}
export function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function downloadPNG(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1520;
    canvas.height = 1340;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("PNG export failed.");
    download("scrying-solution.png", blob, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
