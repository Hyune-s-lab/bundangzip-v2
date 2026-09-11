// Export the drawn diagram, with resolved styles, as a self-contained raster.
export async function capturePlan(svg: SVGSVGElement): Promise<string> {
  await document.fonts.ready;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  const properties = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
    "dominant-baseline",
    "paint-order",
    "letter-spacing",
    "visibility",
    "display",
  ];
  originals.forEach((original, i) => {
    const style = getComputedStyle(original);
    for (const property of properties) {
      const value = style
        .getPropertyValue(property)
        .replace(/url\(["']?[^#)]*#([^"')]+)["']?\)/g, "url(#$1)");
      (copies[i] as SVGElement).style.setProperty(property, value);
    }
  });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1176");
  copy.setAttribute("height", "1082");
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1176;
    canvas.height = 1082;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
