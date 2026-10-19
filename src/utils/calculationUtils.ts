export const calculateTotalSales = (invoices: any[]) => {
  return (invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
};

export const calculateTotalDebts = (subscribers: any[]) => {
  return (subscribers || [])
    .filter((s) => s.paymentStatus === 'debt')
    .reduce((sum, s) => sum + (s.amount || 0), 0);
};

export const calculateAgentSales = (agentId: string, invoices: any[]) => {
  return (invoices || [])
    .filter((inv) => inv.agentId === agentId)
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
};

export const calculateAgentDebt = (agentId: string, subscribers: any[]) => {
  return (subscribers || [])
    .filter((s) => s.agentId === agentId && s.paymentStatus === 'debt')
    .reduce((sum, s) => sum + (s.amount || 0), 0);
};
