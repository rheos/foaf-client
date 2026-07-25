import type { TrustlineRow, ViewerBalance } from './types';

function decimal(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return '0';
}

/**
 * Projects a protocol trustline row into the requested viewer's perspective.
 * Protocol rows are creditor-oriented; the counterparty sees every sign/limit
 * reversed. Strings are retained so applications do not lose decimal precision.
 */
export function viewerBalance(
  row: TrustlineRow,
  viewerAddress: string,
  rowOwnerAddress: string,
): ViewerBalance {
  const balance = decimal(row.balance);
  const given = decimal(row.creditlineGiven ?? row.creditline_given);
  const received = decimal(row.creditlineReceived ?? row.creditline_received);
  if (viewerAddress.toLowerCase() === rowOwnerAddress.toLowerCase()) {
    return { balance, creditlineGiven: given, creditlineReceived: received };
  }
  const flipped = balance.startsWith('-') ? balance.slice(1) : `-${balance}`;
  return {
    balance: flipped === '-0' ? '0' : flipped,
    creditlineGiven: received,
    creditlineReceived: given,
  };
}
