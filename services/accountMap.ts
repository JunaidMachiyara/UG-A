// Centralized account mapping for Firestore account IDs
// Update this mapping as needed when account codes/IDs change

export const ACCOUNT_MAP: Record<string, string> = {
  // General Ledger Accounts
  '105': 'zE14u3BjLK5pKlzfhPPn', // Inventory - Finished Goods
  '301': 'NM7IJ9ef3YDinfamzPQ0', // Capital
  'AR-001': '1WwtxcjnvRRab7vvLxn6', // Accounts Receivable
  // Add more mappings as needed

  // Example: '3000': 'actualFirestoreIdFor3000',
};

export function getAccountId(codeOrName: string): string {
  // Try direct code lookup
  if (ACCOUNT_MAP[codeOrName]) return ACCOUNT_MAP[codeOrName];
  // Optionally, add logic to search by name if needed
  // For now, fallback to codeOrName itself
  return codeOrName;
}
