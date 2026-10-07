"use client";

import { useEffect, useRef, useState } from "react";
import { coverHeight, coverWidth, dragCoverPosition, drawCoverCrop, type CropPosition } from "@/lib/cover-crop";
import { useLanguage } from "./store";

const initialPosition: CropPosition = { zoom: 1, x: 0.5, y: 0.5 };

export function CoverCropDialog({ file, onClose, onUpload }: {
  file: File;
  onClose: () => void;
  onUpload: (cropped: File) => Promise<string | null>;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const smallCanvas = useRef<HTMLCanvasElement>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState(initialPosition);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState<"decode" | "dimensions" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    setImage(null);
    setImageError(null);
    const reader = new FileReader();
    const source = new Image();
    source.onload = () => {
      if (!active) return;
      if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > 40_000_000)
        setImageError("dimensions");
      else setImage(source);
    };
    source.onerror = () => { if (active) setImageError("decode"); };
    reader.onload = () => {
      if (active && typeof reader.result === "string") source.src = reader.result;
      else if (active) setImageError("decode");
    };
    reader.onerror = () => { if (active) setImageError("decode"); };
    reader.readAsDataURL(file);
    return () => { active = false; source.onload = null; source.onerror = null; reader.abort(); };
  }, [file]);

  useEffect(() => {
    if (!image) return;
    for (const element of [canvas.current, smallCanvas.current]) {
      const context = element?.getContext("2d");
      if (context) drawCoverCrop(context, image, image.naturalWidth, image.naturalHeight, position);
    }
  }, [image, position]);

  function movePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!image || !lastPointer.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setPosition((current) => dragCoverPosition(current,
      dx, dy,
      bounds.width, bounds.height, image.naturalWidth, image.naturalHeight));
  }

  async function save() {
    if (!image || saving) return;
    setSaving(true); setError("");
    try {
      const output = document.createElement("canvas");
      output.width = coverWidth; output.height = coverHeight;
      const context = output.getContext("2d");
      if (!context) throw new Error(t("এই ব্রাউজারে ছবি কাটা যাচ্ছে না।", "This browser cannot crop the image."));
      drawCoverCrop(context, image, image.naturalWidth, image.naturalHeight, position);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob || blob.size > 5 * 1024 * 1024)
        throw new Error(t("কাটা ছবিটি ৫ MB-এর বেশি। ছোট ছবি বেছে নিন।", "The cropped image exceeds 5 MB. Choose a smaller image."));
      const cropped = new File([blob], `${file.name.replace(/\.[^.]+$/, "").slice(0, 80)}-cover.jpg`, { type: "image/jpeg" });
      const problem = await onUpload(cropped);
      if (problem) setError(problem);
      else dialog.current?.close();
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="cover-crop-dialog" onClose={onClose}
    onCancel={(event) => { if (saving) event.preventDefault(); }} aria-labelledby="cover-crop-title">
    <div className="preview-heading">
      <div><h2 id="cover-crop-title">{t("প্রচ্ছদের ছবি বেছে নিন", "Choose your cover crop")}</h2>
        <p>{t("ছবি টেনে সরান বা নিচের নিয়ন্ত্রণ ব্যবহার করুন। ফ্রেমে যা দেখছেন, সেটিই প্রচ্ছদ হবে।", "Drag the image or use the controls. What you see in the frame is the cover that will be saved.")}</p></div>
      <button type="button" className="button secondary" disabled={saving} onClick={() => dialog.current?.close()}>{t("বাতিল", "Cancel")}</button>
    </div>
    <div className="cover-crop-layout">
      <div>
        <canvas ref={canvas} width={400} height={565} className="cover-crop-canvas"
          aria-label={t("কাটা প্রচ্ছদের পূর্বরূপ; আঙুল বা মাউস দিয়ে ছবি সরান", "Cover crop preview; drag to move the image")}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); lastPointer.current = { x: event.clientX, y: event.clientY }; }}
          onPointerMove={movePointer}
          onPointerUp={() => { lastPointer.current = null; }}
          onPointerCancel={() => { lastPointer.current = null; }} />
      </div>
      <div className="cover-crop-controls">
        <canvas ref={smallCanvas} width={160} height={226} aria-label={t("দোকানে যেমন দেখাবে", "Catalogue-size cover preview")} />
        <p className="field-help">{t("দোকানে প্রচ্ছদ যেমন দেখাবে", "How the cover will look in the shop")}</p>
        <label>{t("জুম", "Zoom")} <span>{position.zoom.toFixed(1)}×</span>
          <input type="range" min="1" max="3" step="0.1" value={position.zoom}
            onChange={(event) => setPosition((current) => ({ ...current, zoom: Number(event.target.value) }))} />
        </label>
        <label>{t("বাম / ডান", "Left / right")}
          <input type="range" min="0" max="100" value={Math.round(position.x * 100)}
            onChange={(event) => setPosition((current) => ({ ...current, x: Number(event.target.value) / 100 }))} />
        </label>
        <label>{t("উপরে / নিচে", "Up / down")}
          <input type="range" min="0" max="100" value={Math.round(position.y * 100)}
            onChange={(event) => setPosition((current) => ({ ...current, y: Number(event.target.value) / 100 }))} />
        </label>
        <button type="button" className="button secondary" disabled={saving} onClick={() => setPosition(initialPosition)}>{t("মাঝখানে ফিরুন", "Reset to centre")}</button>
      </div>
    </div>
    {!image && !imageError && <p role="status">{t("ছবি খোলা হচ্ছে…", "Opening image…")}</p>}
    {imageError && <p className="notice error" role="alert">{imageError === "dimensions"
      ? t("ছবির মাপ খুব বড় বা ভুল। ৪ কোটি পিক্সেলের কম ছবি বেছে নিন।", "Image dimensions are invalid or too large. Choose an image under 40 megapixels.")
      : t("ব্রাউজার এই ছবিটি পড়তে পারেনি। ছবিটি খুলে দেখুন, তারপর JPG বা PNG হিসেবে আবার সংরক্ষণ করে চেষ্টা করুন।", "The browser could not decode this image. Check that it opens, then re-save it as JPG or PNG and try again.")}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={!image || saving} onClick={() => void save()}>
      {saving ? t("প্রচ্ছদ আপলোড হচ্ছে…", "Uploading cover…") : t("এই অংশটি প্রচ্ছদ হিসেবে সংরক্ষণ করুন", "Save this crop as the cover")}
    </button></div>
  </dialog>;
}
