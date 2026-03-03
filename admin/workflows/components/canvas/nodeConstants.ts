import {
  Play,
  ClipboardList,
  Bot,
  Eye,
  CheckCircle,
  Flag,
  GitBranch,
  Bell,
  Square,
  Network,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface PaletteItem {
  type: string;
  label: string;
  icon: ElementType;
  bg: string;
  text: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'start', label: 'Baslangic', icon: Play, bg: 'bg-green-100', text: 'text-green-700' },
  { type: 'task', label: 'Gorev', icon: ClipboardList, bg: 'bg-blue-100', text: 'text-blue-700' },
  { type: 'ai_task', label: 'AI Gorev', icon: Bot, bg: 'bg-violet-100', text: 'text-violet-700' },
  { type: 'review', label: 'Review', icon: Eye, bg: 'bg-amber-100', text: 'text-amber-700' },
  { type: 'approval', label: 'Onay', icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { type: 'milestone', label: 'Milestone', icon: Flag, bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { type: 'condition', label: 'Kosul', icon: GitBranch, bg: 'bg-orange-100', text: 'text-orange-700' },
  { type: 'notification', label: 'Bildirim', icon: Bell, bg: 'bg-pink-100', text: 'text-pink-700' },
  { type: 'subprocess', label: 'Alt Surec', icon: Network, bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { type: 'end', label: 'Bitis', icon: Square, bg: 'bg-red-100', text: 'text-red-700' },
];

export interface PresetColor {
  value: string | null;
  label: string;
}

export const PRESET_NODE_COLORS: PresetColor[] = [
  { value: '#fecaca', label: 'Kirmizi' },
  { value: '#fed7aa', label: 'Turuncu' },
  { value: '#fef08a', label: 'Sari' },
  { value: '#bbf7d0', label: 'Yesil' },
  { value: '#bfdbfe', label: 'Mavi' },
  { value: '#ddd6fe', label: 'Mor' },
  { value: '#fbcfe8', label: 'Pembe' },
  { value: null, label: 'Varsayilan' },
];
