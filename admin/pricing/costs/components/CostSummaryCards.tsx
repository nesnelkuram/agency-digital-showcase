import React from 'react';

interface SummaryCard {
  label: string;
  value: number;
  suffix?: string;
  isCurrency?: boolean;
}

interface CostSummaryCardsProps {
  cards: SummaryCard[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const CostSummaryCards: React.FC<CostSummaryCardsProps> = ({ cards }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, index) => {
        const isCurrency = card.isCurrency !== false; // default true
        return (
          <div
            key={index}
            className="rounded-lg p-4"
            style={{ backgroundColor: '#DDD6FE' }}
          >
            <p className="font-commons text-xs text-[#171717]/70 mb-1">
              {card.label}
            </p>
            <p className="font-commons text-xl font-bold text-[#171717]">
              {isCurrency ? `${formatCurrency(card.value)} ${card.suffix || 'TL'}` : card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default CostSummaryCards;
