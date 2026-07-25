import React from 'react';
import { Text } from 'react-native';
import type { CreditTrustline } from '../adapters';
import { ActionButton, Card } from './primitives';
import type { FoafUiTheme } from './theme';
import { TrustlineBalancePreview } from './TrustlineBalancePreview';

export function TrustlineCard(props: {
  trustline: CreditTrustline;
  theme: FoafUiTheme;
  onPress?: (trustline: CreditTrustline) => void;
  onPay?: (trustline: CreditTrustline) => void;
  title?: string;
  formatAmount?: (amount: number) => string;
  balanceLabels?: {
    balance?: string | ((balance: number) => string);
    given?: string;
    received?: string;
  };
  actions?: Array<{
    label: string;
    onPress: (trustline: CreditTrustline) => void;
    disabled?: boolean;
    danger?: boolean;
  }>;
}) {
  const name =
    props.title ??
    props.trustline.counterpartyName ??
    props.trustline.counterpartyAddress ??
    String(props.trustline.id);
  return (
    <Card theme={props.theme} accessibilityLabel={`Trustline with ${name}`}>
      <Text style={{ color: props.theme.colors.text, fontSize: props.theme.typography?.titleSize }}>
        {name}
      </Text>
      <TrustlineBalancePreview
        balance={props.trustline.balance}
        creditlineGiven={props.trustline.creditlineGiven}
        creditlineReceived={props.trustline.creditlineReceived}
        formatAmount={props.formatAmount}
        labels={props.balanceLabels}
        theme={props.theme}
      />
      {props.onPress ? (
        <ActionButton label="View trustline" onPress={() => props.onPress?.(props.trustline)} theme={props.theme} />
      ) : null}
      {props.onPay ? (
        <ActionButton label="Pay" onPress={() => props.onPay?.(props.trustline)} theme={props.theme} />
      ) : null}
      {props.actions?.map((action) => (
        <ActionButton
          key={action.label}
          danger={action.danger}
          disabled={action.disabled}
          label={action.label}
          onPress={() => action.onPress(props.trustline)}
          theme={props.theme}
        />
      ))}
    </Card>
  );
}
