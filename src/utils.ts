import { plans } from './catalog';

export const planLookup = new Map(plans.map((plan) => [plan.id, plan]));

export function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}
