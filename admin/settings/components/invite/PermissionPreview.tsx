import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { ROLES } from '@/lib/rbac/roles';
import { UserRole } from '@/shared/types/user';
import { categorizePermissions } from '@/lib/rbac/permissionCategories';

interface PermissionPreviewProps {
  role: UserRole;
}

const PermissionPreview: React.FC<PermissionPreviewProps> = ({ role }) => {
  const [open, setOpen] = useState(false);

  const { count, groups } = useMemo(() => {
    const perms = ROLES[role]?.permissions || [];
    return {
      count: perms.length,
      groups: categorizePermissions(perms),
    };
  }, [role]);

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-neutral-500" />
          <span className="font-grotesk text-sm font-medium text-[#171717]">
            Bu rolün yetkileri
          </span>
          <span className="px-2 py-0.5 text-xs font-grotesk rounded-full bg-neutral-100 text-neutral-600">
            {count} adet
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-neutral-100 overflow-hidden"
          >
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.category}>
                  <h4 className="font-grotesk text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    {group.label}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {group.permissions.map((p) => (
                      <span
                        key={p.key}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] font-grotesk text-neutral-700"
                      >
                        {p.actionLabel}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="font-grotesk text-xs text-neutral-500 text-center py-4">
                  Bu rol için tanımlı yetki yok.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PermissionPreview;
