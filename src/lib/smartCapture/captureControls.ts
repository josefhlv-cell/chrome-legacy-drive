/** Safari may omit playing/loadeddata events after resuming an existing stream. */
export function watchCameraReady(video: HTMLVideoElement, onReady: () => void, onTimeout: () => void) {
  let finished = false;
  const check = () => {
    if (!finished && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
      finished = true; onReady();
    }
  };
  const poll = setInterval(check, 100);
  const timeout = setTimeout(() => { check(); if (!finished) { finished = true; onTimeout(); } }, 10000);
  video.addEventListener("loadeddata", check); video.addEventListener("playing", check);
  check();
  return () => {
    finished = true; clearInterval(poll); clearTimeout(timeout);
    video.removeEventListener("loadeddata", check); video.removeEventListener("playing", check);
  };
}

/** A missing canvas callback must not keep the shutter locked indefinitely. */
export function captureJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Pořízení snímku trvá příliš dlouho. Zkuste spoušť znovu.")), 10000);
    try {
      canvas.toBlob(blob => {
        clearTimeout(timeout);
        if (blob) resolve(blob);
        else reject(new Error("Snímek se nevytvořil. Zkuste spoušť znovu."));
      }, "image/jpeg", 0.92);
    } catch (error) { clearTimeout(timeout); reject(error); }
  });
}