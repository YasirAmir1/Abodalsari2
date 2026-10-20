import { PricingRow, SubscriptionDuration } from '../types';

export const getPriceByDuration = (
  agentId: string,
  duration: SubscriptionDuration,
  pricing: PricingRow[] = []
): number => {
  const safePricing = Array.isArray(pricing) ? pricing : [];
  const agentPricing = safePricing.find((p) => p && p.agentId === agentId) || safePricing[0];
  if (!agentPricing) return 22000;

  switch (duration) {
    case '1 شهر': return agentPricing.oneMonthPrice || 22000;
    case 'شهرين': return agentPricing.twoMonthsPrice || 44000;
    case '3 أشهر': return agentPricing.threeMonthsPrice || 60000;
    default: return 22000;
  }
};
