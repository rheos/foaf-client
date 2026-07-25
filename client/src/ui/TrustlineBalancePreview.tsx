import React from 'react';
import { Text, View } from 'react-native';
import type { FoafUiTheme } from './theme';

export function TrustlineBalancePreview(props: {
  balance: number;
  creditlineGiven: number;
  creditlineReceived: number;
  theme: FoafUiTheme;
  formatAmount?: (amount: number) => string;
  labels?: {
    balance?: string | ((balance: number) => string);
    given?: string;
    received?: string;
  };
}) {
  const format = props.formatAmount ?? ((amount: number) => amount.toFixed(2));
  const balanceLabel = typeof props.labels?.balance === 'function'
    ? props.labels.balance(props.balance)
    : props.labels?.balance ?? 'Balance';
  return (
    <View
      accessibilityLabel="Trustline balance"
      style={{ flexDirection: 'row', gap: props.theme.spacing.md }}
    >
      <Text style={{ color: props.theme.colors.text }}>{balanceLabel} {format(props.balance)}</Text>
      <Text style={{ color: props.theme.colors.mutedText }}>
        {props.labels?.given ?? 'Give'} {format(props.creditlineGiven)}
      </Text>
      <Text style={{ color: props.theme.colors.mutedText }}>
        {props.labels?.received ?? 'Receive'} {format(props.creditlineReceived)}
      </Text>
    </View>
  );
}
