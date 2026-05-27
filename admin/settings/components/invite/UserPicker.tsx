import React, { useState, useMemo } from 'react';
import { Search, User as UserIcon, X } from 'lucide-react';
import { User } from '@/shared/types/user';

interface UserPickerProps {
  users: User[];
  value?: string;
  onChange: (uid: string | undefined) => void;
  placeholder?: string;
}

const UserPicker: React.FC<UserPickerProps> = ({ users, value, onChange, placeholder = 'Seçim yapın...' }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.displayName?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const selected = users.find((u) => u.uid === value);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center justify-between px-3 py-2.5 border border-neutral-200 rounded-xl bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
              <span className="font-grotesk text-xs font-bold text-[#171717]">
                {(selected.displayName || selected.email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-grotesk text-sm text-[#171717] truncate">{selected.displayName || selected.email}</p>
              <p className="font-grotesk text-xs text-neutral-500 truncate">{selected.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-1 hover:bg-neutral-100 rounded-md"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white"
            />
          </div>
          {open && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-lg">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <UserIcon className="w-5 h-5 text-neutral-300 mx-auto mb-1" />
                  <p className="font-grotesk text-xs text-neutral-500">Kullanıcı bulunamadı</p>
                </div>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(u.uid);
                      setSearch('');
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                      <span className="font-grotesk text-xs font-bold text-[#171717]">
                        {(u.displayName || u.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-grotesk text-sm text-[#171717] truncate">{u.displayName || u.email}</p>
                      <p className="font-grotesk text-xs text-neutral-500 truncate">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserPicker;
