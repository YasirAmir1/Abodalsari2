import { PricingRow, SubscriptionDuration } from '../types';

export const getPriceByDuration = (
  agentId: string,
  duration: SubscriptionDuration,
  pricing: PricingRow[]
): number => {
  const agentPricing = pricing.find((p) => p.agentId === agentId) || pricing[0]; // Fallback to first if not found
  if (!agentPricing) return 22000; // Default fallback

  switch (duration) {
    case '1 شهر': return agentPricing.oneMonthPrice;
    case 'شهرين': return agentPricing.twoMonthsPrice;
    case '3 أشهر': return agentPricing.threeMonthsPrice;
    case '6 أشهر': return agentPricing.sixMonthsPrice;
    case 'سنة': return agentPricing.oneYearPrice;
    default: return 22000;
  }
};
