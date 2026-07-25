import React, { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { ActionButton, FieldLabel } from './primitives';
import type { FoafUiTheme } from './theme';

export function CreateTrustlineModal(props: {
  visible: boolean;
  counterpartyName: string;
  theme: FoafUiTheme;
  pending?: boolean;
  onCancel: () => void;
  onSubmit: (given: number, received: number) => void | Promise<void>;
}) {
  const [given, setGiven] = useState('');
  const [received, setReceived] = useState('');
  const givenNumber = Number(given);
  const receivedNumber = Number(received);
  const valid = givenNumber >= 0 && receivedNumber >= 0 && (givenNumber > 0 || receivedNumber > 0);
  return (
    <Modal onRequestClose={props.onCancel} transparent visible={props.visible}>
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
          Trustline with {props.counterpartyName}
        </Text>
        <View>
          <FieldLabel theme={props.theme}>Credit I give</FieldLabel>
          <TextInput
            accessibilityLabel="Credit I give"
            keyboardType="decimal-pad"
            onChangeText={setGiven}
            style={{ borderColor: props.theme.colors.border, borderWidth: 1, color: props.theme.colors.text }}
            value={given}
          />
        </View>
        <View>
          <FieldLabel theme={props.theme}>Credit I receive</FieldLabel>
          <TextInput
            accessibilityLabel="Credit I receive"
            keyboardType="decimal-pad"
            onChangeText={setReceived}
            style={{ borderColor: props.theme.colors.border, borderWidth: 1, color: props.theme.colors.text }}
            value={received}
          />
        </View>
        <ActionButton
          disabled={!valid || props.pending}
          label={props.pending ? 'Saving…' : 'Create trustline'}
          onPress={() => void props.onSubmit(givenNumber, receivedNumber)}
          theme={props.theme}
        />
        <ActionButton label="Cancel" onPress={props.onCancel} theme={props.theme} />
      </View>
    </Modal>
  );
}
