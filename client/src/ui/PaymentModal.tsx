import React, { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { ActionButton, FieldLabel } from './primitives';
import type { FoafUiTheme } from './theme';

export function PaymentModal(props: {
  visible: boolean;
  counterpartyName: string;
  theme: FoafUiTheme;
  pending?: boolean;
  onCancel: () => void;
  onSubmit: (amount: number, memo?: string) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const parsed = Number(amount);
  return (
    <Modal
      animationType="slide"
      onRequestClose={props.onCancel}
      transparent
      visible={props.visible}
    >
      <View
        style={{
          backgroundColor: props.theme.colors.background,
          gap: props.theme.spacing.md,
          margin: props.theme.spacing.lg,
          marginTop: 'auto',
          padding: props.theme.spacing.lg,
        }}
      >
        <Text style={{ color: props.theme.colors.text }}>
          Pay {props.counterpartyName}
        </Text>
        <View>
          <FieldLabel theme={props.theme}>Amount</FieldLabel>
          <TextInput
            accessibilityLabel="Payment amount"
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            style={{ borderColor: props.theme.colors.border, borderWidth: 1, color: props.theme.colors.text }}
            value={amount}
          />
        </View>
        <View>
          <FieldLabel theme={props.theme}>Memo</FieldLabel>
          <TextInput
            accessibilityLabel="Payment memo"
            onChangeText={setMemo}
            style={{ borderColor: props.theme.colors.border, borderWidth: 1, color: props.theme.colors.text }}
            value={memo}
          />
        </View>
        <ActionButton
          disabled={!Number.isFinite(parsed) || parsed <= 0 || props.pending}
          label={props.pending ? 'Sending…' : 'Send payment'}
          onPress={() => void props.onSubmit(parsed, memo || undefined)}
          theme={props.theme}
        />
        <ActionButton label="Cancel" onPress={props.onCancel} theme={props.theme} />
      </View>
    </Modal>
  );
}
