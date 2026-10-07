export const coverWidth = 800;
export const coverHeight = 1130;

export type CropPosition = { zoom: number; x: number; y: number };

export function coverSourceRect(imageWidth: number, imageHeight: number, position: CropPosition) {
  if (!(imageWidth > 0 && imageHeight > 0) || !Number.isFinite(position.zoom))
    throw new Error("Invalid cover image dimensions.");
  const zoom = Math.min(3, Math.max(1, position.zoom));
  const scale = Math.max(coverWidth / imageWidth, coverHeight / imageHeight) * zoom;
  const width = coverWidth / scale;
  const height = coverHeight / scale;
  const x = Math.min(1, Math.max(0, position.x));
  const y = Math.min(1, Math.max(0, position.y));
  return { sx: (imageWidth - width) * x, sy: (imageHeight - height) * y, width, height };
}

export function drawCoverCrop(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  position: CropPosition,
) {
  const { sx, sy, width, height } = coverSourceRect(imageWidth, imageHeight, position);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.drawImage(image, sx, sy, width, height, 0, 0, context.canvas.width, context.canvas.height);
}

export function dragCoverPosition(
  position: CropPosition,
  dx: number,
  dy: number,
  viewWidth: number,
  viewHeight: number,
  imageWidth: number,
  imageHeight: number,
): CropPosition {
  const { width, height } = coverSourceRect(imageWidth, imageHeight, position);
  const horizontalTravel = viewWidth * (imageWidth / width - 1);
  const verticalTravel = viewHeight * (imageHeight / height - 1);
  return {
    ...position,
    x: horizontalTravel > 0 ? Math.min(1, Math.max(0, position.x - dx / horizontalTravel)) : position.x,
    y: verticalTravel > 0 ? Math.min(1, Math.max(0, position.y - dy / verticalTravel)) : position.y,
  };
}
