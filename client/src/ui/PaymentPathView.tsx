import React from 'react';
import { Text, View } from 'react-native';
import type { LedgerId } from '../adapters';
import type { FoafUiTheme } from './theme';

export function PaymentPathView(props: {
  path: LedgerId[];
  theme: FoafUiTheme;
  labelFor?: (id: LedgerId) => string;
}) {
  const labelFor = props.labelFor ?? String;
  return (
    <View accessibilityLabel="Payment path" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {props.path.map((id, index) => (
        <Text key={`${id}-${index}`} style={{ color: props.theme.colors.mutedText }}>
          {index > 0 ? ' → ' : ''}
          {labelFor(id)}
        </Text>
      ))}
    </View>
  );
}
