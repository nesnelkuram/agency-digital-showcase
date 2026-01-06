import React from 'react';
import { CheckSquare } from 'lucide-react';

const ApprovalsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
          Onaylar
        </h1>
        <p className="font-grotesk text-neutral-600 mt-1">
          Icerik onay sureclerini yonetin.
        </p>
      </div>

      <div className="bg-white rounded-xl p-12 text-center border border-neutral-100">
        <CheckSquare className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-400 mb-2">
          Onay Sistemi
        </h3>
        <p className="font-grotesk text-neutral-400">
          Bu modul yakin zamanda aktif olacak.
        </p>
      </div>
    </div>
  );
};

export default ApprovalsPage;
