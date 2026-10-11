import type { Aesthetics, Candidate, SlotText } from '../types';
import type { Focus } from '../crop';
import { placeText, type StoryRole } from '../storyLayout';
import { CroppedImage } from './CroppedImage';

/**
 * Story 1080×1920: tam sayfa fotoğraf üzerinde metin. Siyah zemin, bant veya metin paneli YOK; metin
 * ölçülmüş sakin bölgeye, krem veya bordo mürekkep ve gerekirse hafif gölgeyle yerleştirilir.
 * Yazı boyutları tuval genişliğine bağlıdır (cqw), 1080 px tuvaldeki oranı korur.
 */
export function StoryCanvas({ c, focus, zoom, text, role, aesthetics }: {
  c: Candidate; focus: Focus; zoom: number; text: SlotText | null; role: StoryRole; aesthetics?: Aesthetics;
}) {
  const p = placeText(aesthetics);
  const showHeadline = role === 'headline' && !!text?.headline;
  const showBody = role !== 'none' && !!text?.body;
  return (
    <div className="story-canvas" data-testid="story-canvas" data-role={role}>
      <CroppedImage c={c} format="story" focus={focus} zoom={zoom} />
      {(showHeadline || showBody) && (
        <div
          className={`storytext zone-${p.zone} ink-${p.ink}`}
          data-testid="storytext"
          data-zone={p.zone}
          data-ink={p.ink}
          data-calm={p.calm ? 'evet' : 'hayır'}
          style={p.shadow ? { textShadow: '0 0 6px rgba(0,0,0,.55)' } : undefined}
        >
          {showHeadline && <p className="h">{text!.headline}</p>}
          {showBody && <p className="b">{text!.body}</p>}
        </div>
      )}
    </div>
  );
}
