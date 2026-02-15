import React, { useState } from 'react';
import { MapPin, Users, Heart, Target, ChevronDown, ChevronUp } from 'lucide-react';
import type { AudienceTargeting } from '@/shared/types/marketing';

interface TargetingDisplayProps {
  targetingJson?: Record<string, any>;
  targeting?: Partial<AudienceTargeting>;
  collapsed?: boolean;
}

// Ulke kodu -> bayrak emoji + isim
const COUNTRY_MAP: Record<string, { flag: string; name: string }> = {
  TR: { flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkiye' },
  US: { flag: '\u{1F1FA}\u{1F1F8}', name: 'ABD' },
  GB: { flag: '\u{1F1EC}\u{1F1E7}', name: 'Ingiltere' },
  DE: { flag: '\u{1F1E9}\u{1F1EA}', name: 'Almanya' },
  FR: { flag: '\u{1F1EB}\u{1F1F7}', name: 'Fransa' },
  NL: { flag: '\u{1F1F3}\u{1F1F1}', name: 'Hollanda' },
  IT: { flag: '\u{1F1EE}\u{1F1F9}', name: 'Italya' },
  ES: { flag: '\u{1F1EA}\u{1F1F8}', name: 'Ispanya' },
  AZ: { flag: '\u{1F1E6}\u{1F1FF}', name: 'Azerbaycan' },
  SA: { flag: '\u{1F1F8}\u{1F1E6}', name: 'Suudi Arabistan' },
  AE: { flag: '\u{1F1E6}\u{1F1EA}', name: 'BAE' },
};

function getCountryDisplay(code: string): string {
  const entry = COUNTRY_MAP[code.toUpperCase()];
  if (entry) return `${entry.flag} ${entry.name}`;
  return code.toUpperCase();
}

function getGenderLabel(genders?: number[]): string {
  if (!genders || genders.length === 0) return 'Tumu';
  if (genders.length === 2) return 'Tumu';
  if (genders.includes(1) && genders.includes(2)) return 'Tumu';
  if (genders.includes(1)) return 'Erkek';
  if (genders.includes(2)) return 'Kadin';
  return 'Tumu';
}

function getGenderLabelFromStructured(genders?: ('male' | 'female' | 'all')[]): string {
  if (!genders || genders.length === 0) return 'Tumu';
  if (genders.includes('all')) return 'Tumu';
  const labels: string[] = [];
  if (genders.includes('male')) labels.push('Erkek');
  if (genders.includes('female')) labels.push('Kadin');
  return labels.length > 0 ? labels.join(', ') : 'Tumu';
}

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-commons rounded-full mr-1 mb-1">
    {children}
  </span>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-commons text-neutral-500 mb-1">{children}</p>
);

const TargetingDisplay: React.FC<TargetingDisplayProps> = ({
  targetingJson,
  targeting,
  collapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const hasJson = targetingJson && Object.keys(targetingJson).length > 0;
  const hasStructured = targeting && Object.keys(targeting).length > 0;

  if (!hasJson && !hasStructured) {
    return (
      <p className="text-xs font-commons text-neutral-400 italic">
        Hedefleme bilgisi mevcut degil
      </p>
    );
  }

  // ---- JSON'dan veri cikarma ----
  const jsonLocations: string[] = [];
  const jsonCities: string[] = [];
  let jsonAgeStr = '';
  let jsonGenderStr = '';
  const jsonInterests: string[] = [];
  const jsonBehaviors: string[] = [];
  const jsonCustomAudiences: string[] = [];
  const jsonPlacements: string[] = [];

  if (hasJson) {
    // Lokasyonlar
    const geo = targetingJson!.geo_locations;
    if (geo) {
      if (Array.isArray(geo.countries)) {
        geo.countries.forEach((c: string) => jsonLocations.push(getCountryDisplay(c)));
      }
      if (Array.isArray(geo.cities)) {
        geo.cities.forEach((city: any) => {
          if (city?.name) jsonCities.push(city.name);
        });
      }
      if (Array.isArray(geo.regions)) {
        geo.regions.forEach((region: any) => {
          if (region?.name) jsonCities.push(region.name);
        });
      }
    }

    // Yas & Cinsiyet
    const ageMin = targetingJson!.age_min;
    const ageMax = targetingJson!.age_max;
    if (ageMin || ageMax) {
      jsonAgeStr = `${ageMin ?? '?'}-${ageMax ?? '?'} yas`;
    }
    jsonGenderStr = getGenderLabel(targetingJson!.genders);

    // Ilgi Alanlari & Davranislar
    const flexSpec = targetingJson!.flexible_spec;
    if (Array.isArray(flexSpec)) {
      flexSpec.forEach((spec: any) => {
        if (Array.isArray(spec?.interests)) {
          spec.interests.forEach((i: any) => {
            if (i?.name) jsonInterests.push(i.name);
          });
        }
        if (Array.isArray(spec?.behaviors)) {
          spec.behaviors.forEach((b: any) => {
            if (b?.name) jsonBehaviors.push(b.name);
          });
        }
      });
    }

    // Ozel Kitleler
    if (Array.isArray(targetingJson!.custom_audiences)) {
      targetingJson!.custom_audiences.forEach((ca: any) => {
        if (ca?.name) jsonCustomAudiences.push(ca.name);
      });
    }

    // Yerlesimleri
    if (Array.isArray(targetingJson!.publisher_platforms)) {
      targetingJson!.publisher_platforms.forEach((p: string) => jsonPlacements.push(p));
    }
    if (Array.isArray(targetingJson!.facebook_positions)) {
      targetingJson!.facebook_positions.forEach((p: string) => jsonPlacements.push(`fb:${p}`));
    }
    if (Array.isArray(targetingJson!.instagram_positions)) {
      targetingJson!.instagram_positions.forEach((p: string) => jsonPlacements.push(`ig:${p}`));
    }
    if (Array.isArray(targetingJson!.device_platforms)) {
      targetingJson!.device_platforms.forEach((d: string) => jsonPlacements.push(d));
    }
  }

  // ---- Structured targeting'den veri cikarma ----
  const structLocations: string[] = [];
  let structAgeStr = '';
  let structGenderStr = '';
  const structInterests: string[] = [];
  const structBehaviors: string[] = [];
  const structCustomAudiences: string[] = [];
  const structPlacements: string[] = [];

  if (hasStructured) {
    // Lokasyonlar
    if (Array.isArray(targeting!.locations)) {
      targeting!.locations.forEach((loc) => structLocations.push(loc.name));
    }

    // Yas & Cinsiyet
    if (targeting!.ageRange) {
      structAgeStr = `${targeting!.ageRange.min}-${targeting!.ageRange.max} yas`;
    }
    structGenderStr = getGenderLabelFromStructured(targeting!.genders);

    // Meta-spesifik
    if (targeting!.meta) {
      if (Array.isArray(targeting!.meta.interests)) {
        targeting!.meta.interests.forEach((i) => structInterests.push(i));
      }
      if (Array.isArray(targeting!.meta.behaviors)) {
        targeting!.meta.behaviors.forEach((b) => structBehaviors.push(b));
      }
      if (Array.isArray(targeting!.meta.customAudiences)) {
        targeting!.meta.customAudiences.forEach((ca) => structCustomAudiences.push(ca));
      }
      if (Array.isArray(targeting!.meta.placements)) {
        targeting!.meta.placements.forEach((p) => structPlacements.push(p));
      }
    }
  }

  // Birlesik veriler (JSON oncelikli, structured fallback)
  const locations = jsonLocations.length > 0 || jsonCities.length > 0
    ? [...jsonLocations, ...jsonCities]
    : structLocations;
  const ageStr = jsonAgeStr || structAgeStr;
  const genderStr = jsonGenderStr || structGenderStr;
  const interests = jsonInterests.length > 0 ? jsonInterests : structInterests;
  const behaviors = jsonBehaviors.length > 0 ? jsonBehaviors : structBehaviors;
  const customAudiences = jsonCustomAudiences.length > 0 ? jsonCustomAudiences : structCustomAudiences;
  const placements = jsonPlacements.length > 0 ? jsonPlacements : structPlacements;

  const content = (
    <div className="space-y-3">
      {/* Lokasyon */}
      {locations.length > 0 && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Lokasyon</SectionLabel>
            <div className="flex flex-wrap">
              {locations.map((loc, idx) => (
                <Chip key={`${loc}-${idx}`}>{loc}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Yas & Cinsiyet */}
      {(ageStr || genderStr) && (
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Yas & Cinsiyet</SectionLabel>
            <div className="flex flex-wrap">
              {ageStr && <Chip>{ageStr}</Chip>}
              {genderStr && <Chip>{genderStr}</Chip>}
            </div>
          </div>
        </div>
      )}

      {/* Ilgi Alanlari */}
      {interests.length > 0 && (
        <div className="flex items-start gap-2">
          <Heart className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Ilgi Alanlari</SectionLabel>
            <div className="flex flex-wrap">
              {interests.map((interest, idx) => (
                <Chip key={`${interest}-${idx}`}>{interest}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Davranislar */}
      {behaviors.length > 0 && (
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Davranislar</SectionLabel>
            <div className="flex flex-wrap">
              {behaviors.map((behavior, idx) => (
                <Chip key={`${behavior}-${idx}`}>{behavior}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ozel Kitleler */}
      {customAudiences.length > 0 && (
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Ozel Kitleler</SectionLabel>
            <div className="flex flex-wrap">
              {customAudiences.map((ca, idx) => (
                <Chip key={`${ca}-${idx}`}>{ca}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Yerlesimleri */}
      {placements.length > 0 && (
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div>
            <SectionLabel>Yerlesimleri</SectionLabel>
            <div className="flex flex-wrap">
              {placements.map((placement, idx) => (
                <Chip key={`${placement}-${idx}`}>{placement}</Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Collapsed mod: toggle butonu ile acilip kapanir
  if (collapsed) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-xs font-commons text-indigo-600 hover:text-indigo-700 transition-colors mb-2"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Hedeflemeyi Gizle
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hedeflemeyi Goster
            </>
          )}
        </button>
        {isExpanded && content}
      </div>
    );
  }

  return content;
};

export default TargetingDisplay;
