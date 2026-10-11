import type { Candidate, FormatId } from '../types';
import { FORMATS } from '../types';
import { cropRect, ratioOf, type Focus } from '../crop';
import { useImageSrc } from './imageSource';

/**
 * Seçili formatta kırpılmış görüntüyü, cropRect sonucuna (kaynak pikselleri) dayanarak çizer.
 * Feed hücresi, Story karesi ve inspector önizlemesi aynı kırpmayı gösterir.
 * Fotoğraf yüzeyi sabit oranlıdır; düğmeler bu yüzeyin dışında durur.
 */
export function CroppedImage({ c, format, focus, zoom }: { c: Candidate; format: FormatId; focus: Focus; zoom: number }) {
  const url = useImageSrc(c);
  const rc = cropRect(c.dims, ratioOf(format), focus, zoom);
  const f = FORMATS[format];
  return (
    <div className="surface" style={{ aspectRatio: `${f.w}/${f.h}` }} data-testid="cropped" data-crop={`${rc.x},${rc.y},${rc.w},${rc.h}`}>
      {url && <img
        src={url}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          width: `${(c.dims.w / rc.w) * 100}%`,
          height: `${(c.dims.h / rc.h) * 100}%`,
          left: `${(-rc.x / rc.w) * 100}%`,
          top: `${(-rc.y / rc.h) * 100}%`,
          maxWidth: 'none',
        }}
      />}
    </div>
  );
}
