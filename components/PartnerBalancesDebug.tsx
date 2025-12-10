import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';

const PartnerBalancesDebug = () => {
  const { state } = useData();

  useEffect(() => {
    const partnerBalances = state.partners.map(p => ({
      name: p.name,
      type: p.type,
      balance: p.balance
    }));
    console.log('Partner Balances:', partnerBalances);
  }, [state.partners]);

  return null; // Only logs to console
};

export default PartnerBalancesDebug;
